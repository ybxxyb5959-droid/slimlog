"""
음식 사진 인식 — 멀티라벨 분류 (사진 한 장에서 음식 여러 개를 '있다/없다'로 판단)
- 모델 파일(ONNX)과 라벨 파일이 있으면 실제 추론 (mode='model')
- 없으면 고정 예시 결과 (mode='mock') — 화면에 '목업 인식 결과'로 표시되고 사진 내용과 관계없다
클래스별 기준값(threshold) 이상 → recognized('인식 결과'), 기준값의 0.6배 이상 → review('확인 필요')
점수는 내부 저장만 하고 화면에 % 로 보여주지 않는다.
"""
from __future__ import annotations

import io
import json
from dataclasses import dataclass
from pathlib import Path


@dataclass
class Label:
    food_id: str
    status: str  # recognized | review
    score: float | None
    threshold: float | None
    candidates: list[str]


@dataclass
class Result:
    mode: str  # model | mock
    model_status: str  # ready | not_loaded | mock
    model_version: str
    labels: list[Label]


MOCK_VERSION = "mock-0"
# 프론트 src/services/mealAi.ts 와 같은 고정 예시 (실제 점수 아님)
MOCK_LABELS = [
    Label("kimchi-jjigae", "recognized", 0.91, 0.5, ["kimchi-jjigae", "sundubu", "doenjang-jjigae"]),
    Label("rice", "recognized", 0.88, 0.5, ["rice", "multigrain-rice"]),
    Label("kimchi", "recognized", 0.74, 0.55, ["kimchi", "kkakdugi"]),
    Label("spinach", "review", 0.41, 0.55, ["spinach", "kongnamul", "myeolchi"]),
    Label("gyeranmari", "review", 0.37, 0.5, ["gyeranmari", "boiled-egg"]),
]


class Recognizer:
    def __init__(self, model_path: str):
        self.path = Path(model_path)
        self.session = None
        self.meta: dict = {}
        meta_path = self.path.with_suffix(".json")
        if self.path.exists() and meta_path.exists():
            try:
                import onnxruntime as ort  # 설치·모델이 있을 때만

                self.session = ort.InferenceSession(str(self.path), providers=["CPUExecutionProvider"])
                self.meta = json.loads(meta_path.read_text(encoding="utf-8"))
            except Exception:  # 모델 손상·패키지 없음 → 목업으로
                self.session = None

    @property
    def status(self) -> str:
        if self.session is not None:
            return "ready"
        return "not_loaded" if self.path.exists() else "mock"

    def predict(self, jpeg: bytes) -> Result:
        if self.session is None:
            return Result("mock", self.status, MOCK_VERSION, [Label(**l.__dict__) for l in MOCK_LABELS])
        import numpy as np
        from PIL import Image

        size = int(self.meta.get("input_size", 224))
        mean = np.array(self.meta.get("mean", [0.485, 0.456, 0.406]), dtype=np.float32)
        std = np.array(self.meta.get("std", [0.229, 0.224, 0.225]), dtype=np.float32)
        img = Image.open(io.BytesIO(jpeg)).convert("RGB").resize((size, size))
        x = (np.asarray(img, dtype=np.float32) / 255.0 - mean) / std
        x = x.transpose(2, 0, 1)[None]
        logits = self.session.run(None, {self.session.get_inputs()[0].name: x})[0][0]
        scores = 1 / (1 + np.exp(-logits))
        classes: list[str] = self.meta["classes"]  # foodId 목록 (학습 순서)
        thresholds: list[float] = self.meta.get("thresholds", [0.5] * len(classes))
        confusable: dict = self.meta.get("confusable", {})
        labels = []
        for i in np.argsort(-scores):
            sc, th, fid = float(scores[i]), float(thresholds[i]), classes[i]
            if sc >= th:
                st = "recognized"
            elif sc >= th * 0.6:
                st = "review"
            else:
                continue
            labels.append(Label(fid, st, round(sc, 4), th, [fid, *confusable.get(fid, [])][:3]))
        return Result("model", "ready", str(self.meta.get("model_version", self.path.stem)), labels)
