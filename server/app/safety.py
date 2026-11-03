"""
커뮤니티 안전 검사 (계획서 6.8) — src/lib/communitySafety.ts 와 같은 규칙.
띄어쓰기·특수문자를 지우고 비교한다 ('양 도' → '양도'). 키워드 검사는 보조 수단이다.
"""
from __future__ import annotations

import unicodedata
from dataclasses import dataclass

RULES = [
    ("BLOCKED", "판매·구매", ["판매", "팝니다", "삽니다", "구매원해", "구합니다", "직거래", "택배거래"]),
    ("BLOCKED", "양도·나눔", ["양도", "나눔", "드려요", "드립니다", "무료로드", "쪽지주세요", "연락주세요"]),
    ("BLOCKED", "처방전 없이 구매", ["처방전없이", "처방없이", "처방안받고"]),
    ("REVIEW", "용량·증량 권유", ["올리세요", "증량하세요", "늘리세요", "부터올리", "용량추천", "알려드릴게", "맞으세요", "줄이세요"]),
    ("REVIEW", "병원·약국 상호", ["의원", "약국", "병원", "클리닉"]),
]


@dataclass
class Match:
    rule: str
    level: str
    start: int
    end: int
    text: str


def _skip(ch: str) -> bool:
    cat = unicodedata.category(ch)
    return ch.isspace() or cat.startswith("P") or cat.startswith("S")


def normalize(text: str) -> tuple[str, list[int]]:
    out, idx = [], []
    for i, ch in enumerate(text):
        if _skip(ch):
            continue
        out.append(ch.lower())
        idx.append(i)
    return "".join(out), idx


def check(*parts: str) -> tuple[str, list[Match]]:
    text = "\n".join(parts)
    norm, idx = normalize(text)
    matches: list[Match] = []
    for level, rule, words in RULES:
        for w in words:
            frm = 0
            while (i := norm.find(w, frm)) >= 0:
                s, e = idx[i], idx[i + len(w) - 1] + 1
                matches.append(Match(rule, level, s, e, text[s:e]))
                frm = i + len(w)
    level = "BLOCKED" if any(m.level == "BLOCKED" for m in matches) else ("REVIEW" if matches else "LOW")
    return level, sorted(matches, key=lambda m: m.start)
