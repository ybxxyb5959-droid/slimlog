"""AI 요청 횟수 제한 · 사용량 기록 (ai_requests). 사진·AI 응답 원문은 저장하지 않는다."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from ..db import Supabase

KST = timezone(timedelta(hours=9))


def today_start_utc(now: datetime | None = None) -> str:
    """한국 시간 오늘 0시를 UTC 로"""
    n = (now or datetime.now(timezone.utc)).astimezone(KST)
    return n.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc).isoformat()


def count_today(db: Supabase, provider: str, user_id: str | None = None, cap: int = 1000) -> int:
    params = {"select": "req_id", "provider": f"eq.{provider}", "created_at": f"gte.{today_start_utc()}", "limit": str(cap + 1)}
    if user_id:
        params["user_id"] = f"eq.{user_id}"
    return len(db.select("ai_requests", **params))


def log_request(db: Supabase, *, user_id: str, provider: str, model: str, ok: bool, error_code: str | None = None,
                input_tokens: int | None = None, output_tokens: int | None = None, latency_ms: int | None = None) -> None:
    try:
        db.insert("ai_requests", {
            "user_id": user_id, "provider": provider, "model": model, "ok": ok, "error_code": error_code,
            "input_tokens": input_tokens, "output_tokens": output_tokens, "latency_ms": latency_ms,
        })
    except Exception as e:  # 기록 실패가 식단 기록을 막지 않게 (횟수 확인은 호출 전에 이미 함)
        print("ai_requests log failed:", e)
