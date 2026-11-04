"""서버 설정 — 전부 환경변수로 받는다. service_role 키는 이 서버에만 있고 브라우저로 절대 보내지 않는다."""
from __future__ import annotations

import os
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Settings:
    supabase_url: str = field(default_factory=lambda: os.environ.get("SUPABASE_URL", "").rstrip("/"))
    service_key: str = field(default_factory=lambda: os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ""))
    # HS256 로 서명하는 프로젝트(로컬 Supabase 등)만 필요. 비대칭 키 프로젝트는 JWKS 로 검증
    jwt_secret: str = field(default_factory=lambda: os.environ.get("SUPABASE_JWT_SECRET", ""))
    allowed_origins: list[str] = field(
        default_factory=lambda: [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
    )
    photo_bucket: str = "meal-photos"
    max_upload_bytes: int = 10 * 1024 * 1024  # 원본 업로드 한도 (저장본은 재인코딩 후 5MB 이하)
    model_path: str = field(default_factory=lambda: os.environ.get("FOOD_MODEL_PATH", "models/food_multilabel.onnx"))
    # 식단 사진 음식 인식 (docs/AI_Gemini_전환계획.md 0장) — 키는 이 서버 환경변수에만, 브라우저로 보내지 않는다
    ai_provider: str = field(default_factory=lambda: os.environ.get("AI_PROVIDER", "gemini").strip().lower())
    gemini_api_key: str = field(default_factory=lambda: os.environ.get("GEMINI_API_KEY", "").strip(), repr=False)
    gemini_model: str = field(default_factory=lambda: os.environ.get("GEMINI_MODEL", "gemini-3.5-flash-lite").strip())
    ai_daily_limit: int = field(default_factory=lambda: int(os.environ.get("AI_DAILY_LIMIT_PER_USER", "10")))
    ai_global_daily_limit: int = field(default_factory=lambda: int(os.environ.get("AI_GLOBAL_DAILY_LIMIT", "300")))


def get_settings() -> Settings:
    s = Settings()
    if not s.supabase_url or not s.service_key:
        raise RuntimeError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요해요")
    return s
