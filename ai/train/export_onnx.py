#!/usr/bin/env python3
"""
학습한 모델(.pt) → 서버용 ONNX + 정보 파일(.json)
server/app/recognizer.py 가 읽는 형식: classes(=food_id 목록), thresholds, mean, std, input_size, model_version, metrics
python -m ai.train.export_onnx --run runs/A --out server/models/food_multilabel.onnx
"""
from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path


def build_meta(result: dict, version: str) -> dict:
    """result.json → 서버 정보 파일. food_id 가 빈 클래스는 앱에서 음식을 찾을 수 없어 경고만 남긴다"""
    ids = result["food_ids"]
    missing = [c for c, f in zip(result["classes"], ids) if not f]
    return {
        "model_version": version,
        "arch": result["arch"],
        "experiment": result["experiment"],
        "classes": [f or c for c, f in zip(result["classes"], ids)],
        "class_names": result["classes"],
        "thresholds": result["thresholds"],
        "input_size": 224,
        "mean": [0.485, 0.456, 0.406],
        "std": [0.229, 0.224, 0.225],
        "confusable": {},
        "metrics": {k: result["test"].get(k) for k in ("macro_f1", "macro_precision", "macro_recall", "micro_f1", "exact_match")} | {"cpu_latency_ms": result.get("cpu_latency_ms")},
        "warnings": [f"food_id 없음: {', '.join(missing)}"] if missing else [],
    }


def main(argv=None):
    import torch

    from ai.train.train import build_model

    ap = argparse.ArgumentParser()
    ap.add_argument("--run", type=Path, required=True, help="train.py 의 --out 폴더")
    ap.add_argument("--out", type=Path, default=Path("server/models/food_multilabel.onnx"))
    ap.add_argument("--version", default=None)
    a = ap.parse_args(argv)
    result = json.loads((a.run / "result.json").read_text(encoding="utf-8"))
    model, _ = build_model(result["experiment"], len(result["classes"]), 0, pretrained=False)
    model.load_state_dict(torch.load(a.run / "best.pt", map_location="cpu"))
    model.eval()
    a.out.parent.mkdir(parents=True, exist_ok=True)
    torch.onnx.export(model, torch.randn(1, 3, 224, 224), a.out, input_names=["image"], output_names=["logits"], dynamic_axes={"image": {0: "batch"}}, opset_version=17)
    version = a.version or f"effb0-{result['experiment']}-{date.today():%Y%m%d}"
    a.out.with_suffix(".json").write_text(json.dumps(build_meta(result, version), ensure_ascii=False, indent=2), encoding="utf-8")
    print("저장:", a.out, a.out.with_suffix(".json"))


if __name__ == "__main__":
    main()
