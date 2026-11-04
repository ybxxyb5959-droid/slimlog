"""
식단 사진 음식 인식 모듈. 엔진은 AI_PROVIDER 로 고른다 (gemini | mock).
다른 엔진으로 바꾸려면 FoodPhotoAnalyzer 규격(base.py)을 따르는 클래스를 하나 추가하면 된다.
이 모듈은 routers/meals.py 의 POST /meals/photo 에서만 쓴다 (테스트로 확인).
"""
from __future__ import annotations

from functools import lru_cache

from ..config import Settings
from .base import FoodPhotoAnalyzer
from .mock_food import MockFoodAnalyzer


def provider_of(s: Settings) -> str:
    """키가 없으면 목업 — 외부로 아무것도 보내지 않는다"""
    return "gemini" if s.ai_provider == "gemini" and s.gemini_api_key else "mock"


@lru_cache(maxsize=4)
def _build(provider: str, model: str, key: str) -> FoodPhotoAnalyzer:
    if provider == "gemini":
        from .gemini_food import GeminiFoodAnalyzer

        return GeminiFoodAnalyzer(key, model)
    return MockFoodAnalyzer()


def get_analyzer(s: Settings) -> FoodPhotoAnalyzer:
    p = provider_of(s)
    return _build(p, s.gemini_model, s.gemini_api_key) if p == "gemini" else _build("mock", "mock-0", "")
