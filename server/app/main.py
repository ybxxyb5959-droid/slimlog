"""
SlimLog API (FastAPI)
앱이 Supabase 에 직접 할 수 있는 일(RLS 보호)은 여기서 하지 않는다.
여기서 하는 일: 검사(커뮤니티 금칙어·관리자 권한·인바디 OCR 확정값), 계산(참고 곡선), 파일(사진 EXIF 제거·저장·삭제), 추론(음식 인식), 탈퇴
실행: uvicorn app.main:app --reload --port 8000
"""
from __future__ import annotations

from functools import lru_cache

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import Settings
from .recognizer import Recognizer
from .routers import body, community, core, meals

app = FastAPI(title="SlimLog API", version="0.1.0")
_settings = Settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.allowed_origins,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@lru_cache
def recognizer() -> Recognizer:
    return Recognizer(_settings.model_path)


@app.exception_handler(RequestValidationError)
def validation_error(_: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    field = str(first.get("loc", ["", ""])[-1])
    return JSONResponse(status_code=422, content={"detail": {"code": "INVALID_INPUT", "message": "입력값을 확인해 주세요.", "field": field}})


app.include_router(core.router)
app.include_router(community.router)
app.include_router(meals.router)
app.include_router(body.router)
