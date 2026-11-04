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
from .routers import body, community, core, meals, push

app = FastAPI(title="SlimLog API", version="0.1.0")
_settings = Settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.allowed_origins,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-Cron-Secret"],
)


@lru_cache
def recognizer() -> Recognizer:
    """(보류) 직접 학습한 ONNX 모델용 — 지금 식단 사진은 app/ai 모듈을 쓴다. 코드 보존."""
    return Recognizer(_settings.model_path)


@app.exception_handler(RequestValidationError)
def validation_error(_: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    field = str(first.get("loc", ["", ""])[-1])
    return JSONResponse(status_code=422, content={"detail": {"code": "INVALID_INPUT", "message": "입력값을 확인해 주세요.", "field": field}})


@app.on_event("startup")
async def _push_scheduler():
    """ENABLE_PUSH_SCHEDULER=1 이면 서버가 5분마다 알림 대상을 확인 (외부 cron 없이 쓸 때). 같은 날 같은 항목은 한 번만 보냄"""
    import asyncio
    import os

    if os.environ.get("ENABLE_PUSH_SCHEDULER") != "1":
        return
    from .auth import get_db
    from .routers.push import run_due

    async def loop():
        while True:
            try:
                await asyncio.to_thread(run_due, get_db())
            except Exception as e:  # 한 번 실패해도 계속
                print("push scheduler error:", e)
            await asyncio.sleep(300)

    asyncio.create_task(loop())


app.include_router(core.router)
app.include_router(community.router)
app.include_router(meals.router)
app.include_router(body.router)
app.include_router(push.router)
