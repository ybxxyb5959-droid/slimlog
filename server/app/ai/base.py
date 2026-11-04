"""
식단 사진 음식 인식 — 공통 규격 (엔진을 바꿔도 이 모양은 그대로)

사용 범위 (docs/AI_Gemini_전환계획.md 0장, 바꾸지 말 것)
- 식단 관리에서 사용자가 올린 '음식 사진'의 음식 이름·종류·예상 인분만 다룬다
- 칼로리·영양성분 숫자는 엔진이 만들지 않는다 → 서버가 식약처 DB(foods)에서 계산
- 눈바디·인바디·체중·투약·건강 평가 등 다른 용도로 쓰지 않는다
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Protocol

Confidence = Literal["high", "medium", "low"]
CATEGORIES = ("korean", "western", "fastfood", "cafe", "other")
MAX_FOODS = 12
MAX_NAME = 40


@dataclass(frozen=True)
class MealPhoto:
    """엔진에 넘길 수 있는 유일한 입력. 식단 사진 경로(POST /meals/photo)에서만 만든다."""

    jpeg: bytes
    purpose: str

    def __post_init__(self):
        if self.purpose != "meal_photo":
            raise ValueError("음식 인식은 식단 사진에만 쓸 수 있어요")
        if not self.jpeg:
            raise ValueError("빈 사진")


@dataclass
class FoodGuess:
    name_ko: str
    name_en: str = ""
    category: str = "other"
    servings: float = 1.0  # 1인분(1회 제공량) = 1
    portion_text: str = ""
    confidence: Confidence = "low"
    needs_review: bool = True
    reason: str = ""


@dataclass
class AnalysisResult:
    provider: str
    model: str
    is_food_photo: bool
    foods: list[FoodGuess] = field(default_factory=list)
    input_tokens: int | None = None
    output_tokens: int | None = None
    latency_ms: int | None = None


class AnalysisError(Exception):
    """엔진 실패 — code 는 화면 안내와 ai_requests.error_code 에 쓴다"""

    def __init__(self, code: str, message: str, latency_ms: int | None = None):
        super().__init__(message)
        self.code = code  # TIMEOUT | RATE_LIMITED | UPSTREAM | BAD_RESPONSE | BLOCKED | NOT_CONFIGURED
        self.message = message
        self.latency_ms = latency_ms


class FoodPhotoAnalyzer(Protocol):
    provider: str
    model: str

    def analyze(self, photo: MealPhoto) -> AnalysisResult: ...


def _num(v, default: float) -> float:
    try:
        x = float(v)
    except (TypeError, ValueError):
        return default
    return x if x == x else default  # NaN 제외


def sanitize(data: object) -> tuple[bool, list[FoodGuess]]:
    """엔진 응답(JSON)을 정해진 칸만 남겨 정리. 영양 수치 등 스키마 밖의 칸은 버린다."""
    if not isinstance(data, dict):
        raise AnalysisError("BAD_RESPONSE", "AI 응답 형식이 올바르지 않아요")
    is_food = bool(data.get("is_food_photo", True))
    raw = data.get("foods") or []
    if not isinstance(raw, list):
        raise AnalysisError("BAD_RESPONSE", "AI 응답 형식이 올바르지 않아요")
    out: list[FoodGuess] = []
    seen: set[str] = set()
    for f in raw:
        if not isinstance(f, dict):
            continue
        name = str(f.get("name_ko") or "").strip()[:MAX_NAME]
        if not name or name in seen:
            continue
        seen.add(name)
        servings = _num(f.get("servings"), 1.0)
        if not 0.25 <= servings <= 10:
            servings = 1.0  # 이상한 값이면 1인분
        conf = f.get("confidence") if f.get("confidence") in ("high", "medium", "low") else "low"
        cat = f.get("category") if f.get("category") in CATEGORIES else "other"
        needs = bool(f.get("needs_review", conf != "high")) or conf == "low"
        out.append(
            FoodGuess(
                name_ko=name,
                name_en=str(f.get("name_en") or "").strip()[:MAX_NAME],
                category=cat,
                servings=round(servings, 2),
                portion_text=str(f.get("portion_text") or "").strip()[:20],
                confidence=conf,
                needs_review=needs,
                reason=str(f.get("reason") or "").strip()[:80],
            )
        )
        if len(out) >= MAX_FOODS:
            break
    if not is_food:
        out = []
    return is_food, out
