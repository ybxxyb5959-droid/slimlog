"""
학습 데이터 준비 — 라벨 JSON(AI Hub 등) → (이미지 경로, 멀티핫 벡터) 목록 + 그룹 분할
- 라벨 읽기는 0단계 inspect_labels.py 의 추출기를 그대로 쓴다 (스키마가 달라도 같은 방식)
- classes.json: 학습할 클래스 목록과 각 클래스의 SlimLog foods.food_id 연결 (예: {"쌀밥": "mfds-D101"})
- 분할: 같은 원본 사진(그룹)이 train/val/test 에 나뉘지 않게 이미지 ID 앞부분으로 묶어서 나눈다

torch 없이 동작 (단위 테스트 가능).
"""
from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path

from ai.scripts import inspect_labels as il


@dataclass
class Sample:
    image: Path
    labels: list[str]  # 클래스 이름 (classes.json 의 키)
    group: str


def load_class_map(path: Path) -> dict[str, str]:
    """{"클래스 이름": "food_id"} — food_id 가 비어 있으면 학습은 하되 앱 연결은 안 됨"""
    m = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(m, dict) or not m:
        raise ValueError("classes.json 은 {클래스이름: food_id} 형태여야 해요")
    return m


def group_of(image_id: str, pattern: str | None) -> str:
    """같은 촬영 묶음을 한 그룹으로. pattern 이 없으면 확장자·끝 번호를 뗀 이름"""
    stem = Path(image_id).stem
    if pattern:
        m = re.search(pattern, stem)
        if m:
            return m.group(1) if m.groups() else m.group(0)
    return re.sub(r"[_-]?\d+$", "", stem) or stem


def build_samples(label_root: Path, image_root: Path, classes: dict[str, str], group_pattern: str | None = None, extractor: str = "auto") -> tuple[list[Sample], dict]:
    recs, issues, n = il.load_labels(label_root, "**/*.json", il.EXTRACTORS[extractor], il.ExtractorConfig())
    wanted = set(classes)
    index = {p.name: p for p in image_root.rglob("*") if p.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp")}
    samples, missing_img, no_class = [], 0, 0
    seen: set[str] = set()
    for r in recs:
        if r.image_id in seen:
            continue
        seen.add(r.image_id)
        labels = sorted({l for l in r.labels if l in wanted})
        if not labels:
            no_class += 1
            continue
        img = index.get(Path(r.image_id).name) or index.get(Path(r.image_id).stem + ".jpg")
        if img is None:
            missing_img += 1
            continue
        samples.append(Sample(img, labels, group_of(r.image_id, group_pattern)))
    stats = {"label_files": n, "issues": len(issues), "samples": len(samples), "missing_image": missing_img, "no_target_class": no_class}
    return samples, stats


def split_groups(samples: list[Sample], ratios=(0.7, 0.15, 0.15), seed: str = "slimlog") -> dict[str, list[Sample]]:
    """그룹 이름의 해시로 결정적 분할 — 다시 돌려도 같은 결과, 같은 그룹은 같은 쪽"""
    out = {"train": [], "val": [], "test": []}
    for s in samples:
        h = int(hashlib.sha256(f"{seed}:{s.group}".encode()).hexdigest()[:8], 16) / 0xFFFFFFFF
        key = "train" if h < ratios[0] else "val" if h < ratios[0] + ratios[1] else "test"
        out[key].append(s)
    return out


def multi_hot(labels: list[str], class_names: list[str]) -> list[float]:
    idx = {c: i for i, c in enumerate(class_names)}
    v = [0.0] * len(class_names)
    for l in labels:
        v[idx[l]] = 1.0
    return v
