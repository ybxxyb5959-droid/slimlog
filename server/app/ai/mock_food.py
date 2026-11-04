"""목업 엔진 — API 키가 없을 때 시연용 고정 예시. 사진 내용을 보지 않고, 외부로 아무것도 보내지 않는다."""
from __future__ import annotations

from .base import AnalysisResult, FoodGuess, MealPhoto

MOCK_MODEL = "mock-0"

MOCK_FOODS = [
    FoodGuess("김치찌개", "kimchi stew", "korean", 1, "1그릇", "high", False),
    FoodGuess("쌀밥", "steamed rice", "korean", 1, "1공기", "high", False),
    FoodGuess("배추김치", "kimchi", "korean", 1, "1접시", "medium", False),
    FoodGuess("시금치나물", "seasoned spinach", "korean", 1, "1접시", "low", True, "다른 나물과 비슷해 보여요"),
    FoodGuess("계란말이", "rolled omelette", "korean", 1, "2조각", "medium", True, "가려져서 일부만 보여요"),
]


class MockFoodAnalyzer:
    provider = "mock"
    model = MOCK_MODEL

    def analyze(self, photo: MealPhoto) -> AnalysisResult:
        return AnalysisResult("mock", MOCK_MODEL, True, [FoodGuess(**f.__dict__) for f in MOCK_FOODS], latency_ms=0)
