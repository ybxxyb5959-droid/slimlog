"""
AI가 말한 음식 이름 → 식약처 영양 DB(foods, 공용 음식만) 연결
순서: 별칭 사전 → 이름 정확히 일치 → 이름에 포함(비슷한 이름) 후보
우선순위: 식약처 '음식'(mfds-D…) → '원재료'(mfds-R…) → 그 외 제조사 없는 것 → 가공식품(제조사 있음)은 마지막
  (클라우드 foods 에 가공식품이 31만 개라, 그냥 찾으면 '○○ 김치찌개 라면' 같은 제품이 먼저 걸린다)
못 찾으면 food_id 없음 → 화면에서 검색·직접 입력. 영양 수치를 만들지 않는다.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from ..db import Supabase
from .base import FoodGuess

MAX_CANDIDATES = 4
_UNSAFE = re.compile(r"[%*,()\\\"'.:]")


@lru_cache
def _aliases() -> tuple[dict[str, list[str]], frozenset[str]]:
    j = json.loads((Path(__file__).parent / "food_aliases.json").read_text(encoding="utf-8"))
    norm = {_key(k): v for k, v in j["aliases"].items()}
    return norm, frozenset(_key(x) for x in j.get("review", []))


def _key(name: str) -> str:
    return re.sub(r"\s+", "", name).lower()


def _rank(row: dict) -> tuple[int, int]:
    fid = str(row.get("food_id", ""))
    src = 0 if fid.startswith("mfds-D") else 1 if fid.startswith("mfds-R") else 2 if not row.get("brand") else 3
    return src, len(str(row.get("name", "")))


@dataclass
class Match:
    food_id: str | None
    candidates: list[str] = field(default_factory=list)
    always_review: bool = False


def match_food(db: Supabase, guess: FoodGuess) -> Match:
    aliases, review = _aliases()
    k = _key(guess.name_ko)
    names: list[str] = []
    for n in [*aliases.get(k, []), guess.name_ko, guess.name_ko.replace(" ", "")]:
        n = _UNSAFE.sub("", n).strip()
        if n and n not in names:
            names.append(n)

    found: list[str] = []

    def add(rows: list[dict]):
        for r in sorted(rows, key=_rank):
            if r["food_id"] not in found:
                found.append(r["food_id"])

    # 1) 이름이 정확히 같은 것 (별칭 순서대로)
    for n in names:
        add(db.select("foods", select="food_id,name,brand", owner_id="is.null", name=f"eq.{n}", limit="5"))
    # 2) 이름에 포함 — 식약처 '음식' 먼저, 그다음 제조사 없는 것
    term = names[-1][:20] if names else ""
    if term and len(found) < MAX_CANDIDATES:
        add(db.select("foods", select="food_id,name,brand", owner_id="is.null", food_id="like.mfds-D*", name=f"ilike.*{term}*", limit="30"))
    if term and len(found) < MAX_CANDIDATES:
        add(db.select("foods", select="food_id,name,brand", owner_id="is.null", brand="is.null", name=f"ilike.*{term}*", limit="30"))
    found = found[:MAX_CANDIDATES]
    return Match(found[0] if found else None, found, always_review=k in review)
