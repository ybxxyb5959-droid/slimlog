"""
멀티라벨 평가 — numpy 만 사용
- 클래스별 기준값(threshold)은 검증셋(val)에서 F1 이 가장 높은 값으로 정한다
- 테스트셋(test)은 마지막에 한 번만 평가한다 (기준값을 test 로 고르지 않음)
지표: Macro-F1, Micro-F1, 클래스별 Precision/Recall/F1, Exact match(모든 라벨이 정확히 맞은 비율), 클래스별 혼동표(TP/FP/FN/TN)
"""
from __future__ import annotations

import numpy as np


def sigmoid(x: np.ndarray) -> np.ndarray:
    return 1 / (1 + np.exp(-x))


def per_class_counts(y: np.ndarray, pred: np.ndarray) -> dict[str, np.ndarray]:
    y, pred = y.astype(bool), pred.astype(bool)
    return {"tp": (y & pred).sum(0), "fp": (~y & pred).sum(0), "fn": (y & ~pred).sum(0), "tn": (~y & ~pred).sum(0)}


def _f1(tp, fp, fn):
    p = np.divide(tp, tp + fp, out=np.zeros(tp.shape, float), where=(tp + fp) > 0)
    r = np.divide(tp, tp + fn, out=np.zeros(tp.shape, float), where=(tp + fn) > 0)
    f = np.divide(2 * p * r, p + r, out=np.zeros(tp.shape, float), where=(p + r) > 0)
    return p, r, f


def tune_thresholds(y_val: np.ndarray, scores_val: np.ndarray, grid=None) -> np.ndarray:
    """클래스마다 F1 최대인 기준값. 검증셋에 양성이 없으면 0.5"""
    grid = np.round(np.arange(0.1, 0.91, 0.05), 2) if grid is None else grid
    th = np.full(y_val.shape[1], 0.5)
    for c in range(y_val.shape[1]):
        if y_val[:, c].sum() == 0:
            continue
        best = -1.0
        for t in grid:
            c_ = per_class_counts(y_val[:, c : c + 1], scores_val[:, c : c + 1] >= t)
            f = _f1(c_["tp"], c_["fp"], c_["fn"])[2][0]
            if f > best + 1e-12:
                best, th[c] = f, t
    return th


def evaluate(y: np.ndarray, scores: np.ndarray, thresholds: np.ndarray, class_names: list[str]) -> dict:
    pred = scores >= thresholds
    c = per_class_counts(y, pred)
    p, r, f = _f1(c["tp"], c["fp"], c["fn"])
    tp, fp, fn = c["tp"].sum(), c["fp"].sum(), c["fn"].sum()
    micro_p = tp / (tp + fp) if tp + fp else 0.0
    micro_r = tp / (tp + fn) if tp + fn else 0.0
    support = y.sum(0)
    has = support > 0  # 테스트셋에 없는 클래스는 macro 평균에서 뺀다 (0 으로 깎지 않음)
    return {
        "n_images": int(len(y)),
        "macro_f1": float(f[has].mean()) if has.any() else None,
        "macro_precision": float(p[has].mean()) if has.any() else None,
        "macro_recall": float(r[has].mean()) if has.any() else None,
        "micro_f1": float(2 * micro_p * micro_r / (micro_p + micro_r)) if micro_p + micro_r else 0.0,
        "exact_match": float((pred == y.astype(bool)).all(1).mean()),
        "per_class": [
            {"class": n, "support": int(support[i]), "precision": float(p[i]), "recall": float(r[i]), "f1": float(f[i]), "threshold": float(thresholds[i]),
             "tp": int(c["tp"][i]), "fp": int(c["fp"][i]), "fn": int(c["fn"][i]), "tn": int(c["tn"][i])}
            for i, n in enumerate(class_names)
        ],
    }


def confusion_pairs(y: np.ndarray, pred: np.ndarray, class_names: list[str], top: int = 10) -> list[dict]:
    """'정답은 A 인데 B 로 잘못 켜진' 쌍 — 어떤 음식끼리 헷갈리는지 (멀티라벨용 혼동 분석)"""
    y, pred = y.astype(bool), pred.astype(bool)
    k = len(class_names)
    m = np.zeros((k, k), int)
    for yi, pi in zip(y, pred):
        missed, extra = np.where(yi & ~pi)[0], np.where(~yi & pi)[0]
        for a in missed:
            for b in extra:
                m[a, b] += 1
    pairs = [(m[a, b], a, b) for a in range(k) for b in range(k) if m[a, b]]
    return [{"true": class_names[a], "predicted": class_names[b], "count": int(n)} for n, a, b in sorted(pairs, reverse=True)[:top]]
