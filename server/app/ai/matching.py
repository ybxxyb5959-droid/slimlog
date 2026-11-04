"""
AI가 말한 음식 이름 → 식약처 영양 DB(foods, 공용 음식만) 연결
순서: 별칭 사전 → 이름 정확히 일치 → 이름에 포함(비슷한 이름) 후보
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
_UNSAFE = re.compile(r"[%*,()\\\"']")


@lru_cache
def _aliases() -> tuple[dict[str, list[str]], frozenset[str]]:
    j = json.loads((Path(__file__).parent / "food_aliases.json").read_text(encoding="utf-8"))
    norm = {_key(k): v for k, v in j["aliases"].items()}
    return norm, frozenset(_key(x) for x in j.get("review", []))


def _key(name: str) -> str:
    return re.sub(r"\s+", "", name).lower()


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
        if n and n not in names:
            names.append(n)

    found: list[str] = []
    for n in names:  # 정확히 같은 이름
        rows = db.select("foods", select="food_id", owner_id="is.null", name=f"eq.{n}", limit="1")
        if rows and rows[0]["food_id"] not in found:
            found.append(rows[0]["food_id"])
    term = _UNSAFE.sub("", guess.name_ko.replace(" ", ""))[:20]
    if term and len(found) < MAX_CANDIDATES:  # 이름에 포함 → 짧은 이름(더 비슷함) 먼저
        rows = db.select("foods", select="food_id,name", owner_id="is.null", name=f"ilike.*{term}*", limit="20")
        for r in sorted(rows, key=lambda r: len(r["name"])):
            if r["food_id"] not in found:
                found.append(r["food_id"])
    found = found[:MAX_CANDIDATES]
    return Match(found[0] if found else None, found, always_review=k in review)
