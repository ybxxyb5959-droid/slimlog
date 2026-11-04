"""
Gemini 음식 사진 인식 — SlimLog 에서 Gemini API 를 부르는 유일한 파일

- 식단 사진(MealPhoto, purpose='meal_photo')만 받는다
- 보내는 것: EXIF 를 지운 사진(긴 변 1024px) + 고정 지시문. 사용자 이름·ID·건강정보는 보내지 않는다
- 받는 것: 음식 이름·종류·예상 인분·확실성 (JSON). 칼로리·영양 칸은 스키마에 없다
- API 키는 서버 환경변수(GEMINI_API_KEY)에서만 읽는다
"""
from __future__ import annotations

import base64
import io
import json
import time

import httpx
from PIL import Image

from .base import CATEGORIES, AnalysisError, AnalysisResult, MealPhoto, sanitize

API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
SEND_MAX_SIDE = 1024

PROMPT = """너는 식단 기록 앱의 음식 사진 인식기다. 사진에 보이는 음식만 찾아 정해진 JSON으로 답한다.
규칙:
1. 서로 다른 음식은 각각 한 항목으로 나눈다. 같은 음식이 여러 그릇이면 한 항목에 servings 로 합친다.
2. name_ko 는 한국에서 흔히 쓰는 표준 음식 이름으로 쓴다 (예: 쌀밥, 김치찌개, 배추김치, 계란말이, 페퍼로니피자, 햄버거, 감자튀김, 아메리카노, 카페라떼).
3. servings 는 1인분(1회 제공량)을 1로 한 추정치다. 판단하기 어려우면 1로 둔다. portion_text 는 '1공기', '1그릇', '2조각', '1잔'처럼 짧게 쓴다.
4. 확실하지 않으면 confidence 를 low 로, needs_review 를 true 로 하고 reason 에 짧은 이유를 쓴다.
5. 커피 종류를 확신할 수 없으면 name_ko 를 '커피'로 쓴다.
6. 칼로리, 영양성분, 무게(g), 건강 평가, 의료 조언, 사람이나 배경에 대한 설명은 절대 쓰지 않는다.
7. 음식이 없거나 음식 사진이 아니면 is_food_photo 를 false, foods 를 빈 배열로 한다."""

# 구조화 출력 스키마 — 영양 수치 칸이 아예 없다
RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "is_food_photo": {"type": "BOOLEAN"},
        "foods": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "name_ko": {"type": "STRING"},
                    "name_en": {"type": "STRING"},
                    "category": {"type": "STRING", "enum": list(CATEGORIES)},
                    "servings": {"type": "NUMBER"},
                    "portion_text": {"type": "STRING"},
                    "confidence": {"type": "STRING", "enum": ["high", "medium", "low"]},
                    "needs_review": {"type": "BOOLEAN"},
                    "reason": {"type": "STRING"},
                },
                "required": ["name_ko", "category", "servings", "portion_text", "confidence", "needs_review"],
            },
        },
    },
    "required": ["is_food_photo", "foods"],
}


def shrink(jpeg: bytes) -> bytes:
    """보낼 사본만 줄인다 (토큰·비용 절약). 저장본은 그대로"""
    img = Image.open(io.BytesIO(jpeg)).convert("RGB")
    img.thumbnail((SEND_MAX_SIDE, SEND_MAX_SIDE))
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=85)
    return out.getvalue()


class GeminiFoodAnalyzer:
    provider = "gemini"

    def __init__(self, api_key: str, model: str, timeout_s: float = 25, client: httpx.Client | None = None):
        if not api_key:
            raise AnalysisError("NOT_CONFIGURED", "AI 키가 설정되지 않았어요")
        self._key = api_key
        self.model = model
        self.http = client or httpx.Client(timeout=timeout_s)

    def build_request(self, photo: MealPhoto) -> dict:
        return {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"inline_data": {"mime_type": "image/jpeg", "data": base64.b64encode(shrink(photo.jpeg)).decode()}},
                        {"text": PROMPT},
                    ],
                }
            ],
            "generationConfig": {"responseMimeType": "application/json", "responseSchema": RESPONSE_SCHEMA},
        }

    def analyze(self, photo: MealPhoto) -> AnalysisResult:
        if not isinstance(photo, MealPhoto):
            raise TypeError("MealPhoto 만 받을 수 있어요")
        body = self.build_request(photo)
        url = f"{API_BASE}/{self.model}:generateContent"
        t0 = time.monotonic()
        ms = lambda: int((time.monotonic() - t0) * 1000)  # noqa: E731
        r = None
        for attempt in range(2):  # 서버 오류·시간 초과만 1번 더 시도 (한도 초과는 재시도 안 함)
            try:
                r = self.http.post(url, json=body, headers={"x-goog-api-key": self._key})
            except httpx.TimeoutException:
                if attempt == 0:
                    continue
                raise AnalysisError("TIMEOUT", "AI 응답이 늦어요", ms())
            except httpx.HTTPError:
                if attempt == 0:
                    continue
                raise AnalysisError("UPSTREAM", "AI 서버에 연결하지 못했어요", ms())
            if r.status_code >= 500 and attempt == 0:
                time.sleep(0.5)
                continue
            break
        assert r is not None
        if r.status_code == 429:
            raise AnalysisError("RATE_LIMITED", "AI 사용량이 많아 잠시 쓸 수 없어요", ms())
        if r.status_code in (401, 403):
            raise AnalysisError("NOT_CONFIGURED", "AI 키 설정을 확인해야 해요", ms())
        if r.status_code >= 400:
            raise AnalysisError("UPSTREAM", "AI 분석 요청이 실패했어요", ms())
        try:
            j = r.json()
        except ValueError:
            raise AnalysisError("BAD_RESPONSE", "AI 응답 형식이 올바르지 않아요", ms())
        if (j.get("promptFeedback") or {}).get("blockReason"):
            raise AnalysisError("BLOCKED", "이 사진은 분석할 수 없어요", ms())
        cands = j.get("candidates") or []
        if not cands:
            raise AnalysisError("BAD_RESPONSE", "AI 응답이 비어 있어요", ms())
        if cands[0].get("finishReason") in ("SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "IMAGE_SAFETY"):
            raise AnalysisError("BLOCKED", "이 사진은 분석할 수 없어요", ms())
        text = "".join(p.get("text", "") for p in (cands[0].get("content") or {}).get("parts", []) if not p.get("thought"))
        try:
            data = json.loads(text)
        except ValueError:
            raise AnalysisError("BAD_RESPONSE", "AI 응답 형식이 올바르지 않아요", ms())
        is_food, foods = sanitize(data)
        usage = j.get("usageMetadata") or {}
        out_tokens = (usage.get("candidatesTokenCount") or 0) + (usage.get("thoughtsTokenCount") or 0)
        return AnalysisResult(
            "gemini", self.model, is_food, foods, input_tokens=usage.get("promptTokenCount"), output_tokens=out_tokens or None, latency_ms=ms()
        )
