#!/usr/bin/env python3
"""
SlimLog 음식 멀티라벨 분류 학습 — EfficientNet-B0 전이학습 (사용자 PC 에서 실행)

실험
  A: 사전학습 몸통은 고정, 마지막 분류층만 학습      --exp A
  B: 마지막 블록 N 개까지 풀어서 미세조정             --exp B --unfreeze 2
  C: MobileNetV3-Large 비교                          --exp C

흐름: 데이터 준비 → train/val/test 그룹 분할 → 학습(BCEWithLogits) → val 로 조기 종료·클래스별 기준값 결정
     → test 한 번 평가 → 결과 JSON + 모델(.pt) 저장 → export_onnx.py 로 서버용 변환

실행 예 (CPU 도 됨, 20종 × 수백 장 기준 수 시간 — 실측 필요)
  pip install -r ai/train/requirements.txt
  python -m ai.train.train --labels D:/aihub/labels --images D:/aihub/images --classes ai/train/classes.json --exp A --epochs 10 --out runs/A

원칙: 실제로 돌린 결과만 저장한다. 테스트셋은 기준값을 고르는 데 쓰지 않는다.
"""
from __future__ import annotations

import argparse
import json
import random
import time
from pathlib import Path

import numpy as np

from ai.train.data import build_samples, load_class_map, multi_hot, split_groups
from ai.train.metrics import confusion_pairs, evaluate, sigmoid, tune_thresholds

MEAN, STD, SIZE = [0.485, 0.456, 0.406], [0.229, 0.224, 0.225], 224


def build_model(exp: str, n_classes: int, unfreeze: int, pretrained: bool):
    import timm

    name = "mobilenetv3_large_100" if exp == "C" else "efficientnet_b0"
    model = timm.create_model(name, pretrained=pretrained, num_classes=n_classes)
    for p in model.parameters():
        p.requires_grad = False
    for p in model.get_classifier().parameters():
        p.requires_grad = True
    if exp == "B" and unfreeze > 0 and hasattr(model, "blocks"):
        for blk in list(model.blocks)[-unfreeze:]:
            for p in blk.parameters():
                p.requires_grad = True
        for mod in ("conv_head", "bn2"):
            for p in getattr(model, mod, None).parameters() if hasattr(model, mod) else []:
                p.requires_grad = True
    return model, name


class FoodDataset:
    def __init__(self, samples, class_names, train: bool):
        from torchvision import transforms as T

        self.s, self.c = samples, class_names
        aug = [T.RandomResizedCrop(SIZE, scale=(0.7, 1.0)), T.RandomHorizontalFlip(), T.ColorJitter(0.2, 0.2, 0.2)] if train else [T.Resize(256), T.CenterCrop(SIZE)]
        self.tf = T.Compose([*aug, T.ToTensor(), T.Normalize(MEAN, STD)])

    def __len__(self):
        return len(self.s)

    def __getitem__(self, i):
        import torch
        from PIL import Image

        s = self.s[i]
        return self.tf(Image.open(s.image).convert("RGB")), torch.tensor(multi_hot(s.labels, self.c))


def run_epoch(model, loader, loss_fn, opt=None):
    import torch

    model.train(opt is not None)
    total, n, all_y, all_s = 0.0, 0, [], []
    with torch.set_grad_enabled(opt is not None):
        for x, y in loader:
            logits = model(x)
            loss = loss_fn(logits, y)
            if opt:
                opt.zero_grad()
                loss.backward()
                opt.step()
            total += float(loss) * len(x)
            n += len(x)
            all_y.append(y.numpy())
            all_s.append(sigmoid(logits.detach().numpy()))
    return total / max(n, 1), np.concatenate(all_y), np.concatenate(all_s)


def cpu_latency_ms(model, runs: int = 20) -> float:
    import torch

    model.eval()
    x = torch.randn(1, 3, SIZE, SIZE)
    with torch.no_grad():
        for _ in range(3):
            model(x)
        t = time.perf_counter()
        for _ in range(runs):
            model(x)
    return (time.perf_counter() - t) / runs * 1000


def main(argv=None):
    import torch
    from torch.utils.data import DataLoader

    ap = argparse.ArgumentParser()
    ap.add_argument("--labels", type=Path, required=True)
    ap.add_argument("--images", type=Path, required=True)
    ap.add_argument("--classes", type=Path, required=True)
    ap.add_argument("--exp", choices=["A", "B", "C"], default="A")
    ap.add_argument("--unfreeze", type=int, default=2)
    ap.add_argument("--epochs", type=int, default=10)
    ap.add_argument("--batch", type=int, default=32)
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--patience", type=int, default=3)
    ap.add_argument("--group-pattern", default=None, help="같은 촬영 묶음을 찾는 정규식 (예: '^(\\w+)_\\d+$')")
    ap.add_argument("--no-pretrained", action="store_true", help="사전학습 가중치 없이 (오프라인 시험용)")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", type=Path, default=Path("runs/exp"))
    a = ap.parse_args(argv)

    random.seed(a.seed)
    np.random.seed(a.seed)
    torch.manual_seed(a.seed)
    a.out.mkdir(parents=True, exist_ok=True)

    cmap = load_class_map(a.classes)
    names = list(cmap)
    samples, stats = build_samples(a.labels, a.images, cmap, a.group_pattern)
    parts = split_groups(samples)
    print("데이터:", stats, {k: len(v) for k, v in parts.items()})
    if min(len(v) for v in parts.values()) == 0:
        raise SystemExit("train/val/test 중 비어 있는 쪽이 있어요. 데이터가 너무 적어요.")

    model, arch = build_model(a.exp, len(names), a.unfreeze, not a.no_pretrained)
    y_train = np.array([multi_hot(s.labels, names) for s in parts["train"]])
    pos = y_train.sum(0)
    pos_weight = torch.tensor(np.clip((len(y_train) - pos) / np.maximum(pos, 1), 1, 20), dtype=torch.float32)  # 드문 클래스 보정
    loss_fn = torch.nn.BCEWithLogitsLoss(pos_weight=pos_weight)
    opt = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=a.lr, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=a.epochs)
    dl = lambda part, train: DataLoader(FoodDataset(parts[part], names, train), batch_size=a.batch, shuffle=train, num_workers=2)  # noqa: E731
    train_dl, val_dl, test_dl = dl("train", True), dl("val", False), dl("test", False)

    best, bad, history = -1.0, 0, []
    for ep in range(1, a.epochs + 1):
        tl, _, _ = run_epoch(model, train_dl, loss_fn, opt)
        vl, yv, sv = run_epoch(model, val_dl, loss_fn)
        sched.step()
        th = tune_thresholds(yv, sv)
        vm = evaluate(yv, sv, th, names)["macro_f1"] or 0.0
        history.append({"epoch": ep, "train_loss": tl, "val_loss": vl, "val_macro_f1": vm})
        print(f"[{ep}] train {tl:.4f} · val {vl:.4f} · val macro-F1 {vm:.4f}")
        if vm > best:
            best, bad = vm, 0
            torch.save(model.state_dict(), a.out / "best.pt")
        else:
            bad += 1
            if bad >= a.patience:
                print("조기 종료")
                break

    model.load_state_dict(torch.load(a.out / "best.pt"))
    _, yv, sv = run_epoch(model, val_dl, loss_fn)
    thresholds = tune_thresholds(yv, sv)  # 기준값은 val 에서만
    _, yt, st = run_epoch(model, test_dl, loss_fn)  # test 는 여기서 한 번
    result = {
        "experiment": a.exp,
        "arch": arch,
        "pretrained": not a.no_pretrained,
        "classes": names,
        "food_ids": [cmap[c] for c in names],
        "data": {**stats, **{k: len(v) for k, v in parts.items()}},
        "history": history,
        "thresholds": thresholds.tolist(),
        "val": evaluate(yv, sv, thresholds, names),
        "test": evaluate(yt, st, thresholds, names),
        "test_confusions": confusion_pairs(yt, st >= thresholds, names),
        "cpu_latency_ms": cpu_latency_ms(model),
    }
    (a.out / "result.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print("test macro-F1:", result["test"]["macro_f1"], "· 저장:", a.out / "result.json")


if __name__ == "__main__":
    main()
