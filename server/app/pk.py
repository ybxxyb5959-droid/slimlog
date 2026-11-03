"""
참고용 상대 잔존 곡선 (계획서 6.3) — src/lib/pk/residual.ts 모델 A 와 같은 계산.
r(t) = Σ D_i · (1/2)^((t − t_i)/t½), 표시 기간 최댓값 = 100 인 상대값만 돌려준다.
흡수·생체이용률을 반영하지 않으므로 mg·혈중농도·약효로 표현하지 않는다.
"""
from __future__ import annotations

import math

HOUR_MS = 3600 * 1000


def exponential_sum(doses: list[tuple[int, float]], half_life_h: float, t: int) -> float:
    ke = math.log(2) / half_life_h
    return sum(mg * math.exp(-ke * (t - ti) / HOUR_MS) for ti, mg in doses if ti <= t)


def sample_times(frm: int, to: int, doses: list[tuple[int, float]], step_h: float = 3) -> list[int]:
    ts = set(range(frm, to + 1, int(step_h * HOUR_MS)))
    ts.add(to)
    for ti, _ in doses:
        if frm < ti <= to:
            ts.add(ti - 1)
            ts.add(ti)
    return sorted(ts)


def relative_curve(doses: list[tuple[int, float]], half_life_h: float | None, frm: int, to: int, step_h: float = 3) -> list[dict]:
    if not half_life_h or half_life_h <= 0:
        return []
    raw = [(t, exponential_sum(doses, half_life_h, t)) for t in sample_times(frm, to, doses, step_h)]
    mx = max([0.0] + [v for _, v in raw])
    if mx == 0:
        return []
    return [{"t": t, "relative": v / mx * 100} for t, v in raw]
