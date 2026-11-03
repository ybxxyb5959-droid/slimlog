"""인바디 OCR 확정값 저장 — 결과지 이미지는 받지 않는다. 브라우저에서 읽고 사용자가 확인한 '숫자'만 받는다."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..auth import CurrentUser, current_user, get_db
from ..db import Supabase
from ..errors import ApiError

router = APIRouter()


class OcrIn(BaseModel):
    measured_at: datetime
    weight_kg: float = Field(ge=20, le=300)
    skeletal_muscle_kg: float | None = Field(default=None, gt=0, le=80)
    body_fat_kg: float | None = Field(default=None, ge=0, le=150)
    body_fat_pct: float | None = Field(default=None, ge=2, le=75)
    template_id: str = Field(default="inbody-sheet-v1", max_length=40)
    parser_version: str = Field(default="1", max_length=20)
    ocr_confidence: float | None = Field(default=None, ge=0, le=1)
    force: bool = False  # 중복 의심 경고를 보고도 저장


@router.post("/body-logs/ocr", status_code=201)
def save_ocr(p: OcrIn, user: CurrentUser = Depends(current_user), db: Supabase = Depends(get_db)):
    # 2차 검증 (화면 검증과 같은 규칙, 계획서 6.4)
    if p.measured_at.tzinfo is None or p.measured_at > datetime.now(timezone.utc) + timedelta(minutes=5):
        raise ApiError(400, "FUTURE_TIME", "측정 날짜가 올바르지 않아요.", "measured_at")
    if p.skeletal_muscle_kg is not None and p.skeletal_muscle_kg >= p.weight_kg:
        raise ApiError(422, "CROSS_CHECK", "골격근량은 체중보다 작아야 해요.", "skeletal_muscle_kg")
    if p.body_fat_kg is not None and p.body_fat_kg >= p.weight_kg:
        raise ApiError(422, "CROSS_CHECK", "체지방량은 체중보다 작아야 해요.", "body_fat_kg")
    if p.body_fat_kg is not None and p.body_fat_pct is not None and abs(p.body_fat_kg / p.weight_kg * 100 - p.body_fat_pct) > 1:
        raise ApiError(422, "CROSS_CHECK", "체지방량 ÷ 체중과 체지방률이 1% 넘게 달라요.", "body_fat_pct")
    consents = db.select("consents", select="type", user_id=f"eq.{user.id}", type="eq.sensitive", withdrawn_at="is.null")
    if not consents:
        raise ApiError(403, "NO_CONSENT", "민감정보 동의 후 저장할 수 있어요.")
    # 중복 의심: 10분 이내 · 체중 차 0.1kg 이하 → 409 (사용자가 확인하면 force)
    lo, hi = (p.measured_at - timedelta(minutes=10)).isoformat(), (p.measured_at + timedelta(minutes=10)).isoformat()
    near = db.select("body_logs", select="log_id,weight_kg", user_id=f"eq.{user.id}", measured_at=f"gte.{lo}", **{"and": f"(measured_at.lte.{hi})"})
    if not p.force and any(abs(float(r["weight_kg"]) - p.weight_kg) <= 0.1 for r in near):
        raise ApiError(409, "DUPLICATE_SUSPECTED", "10분 안에 거의 같은 체중 기록이 있어요. 그래도 저장할까요?")
    src = db.insert("body_log_sources", {"user_id": user.id, "source_type": "INBODY_OCR", "template_id": p.template_id, "parser_version": p.parser_version, "ocr_confidence": p.ocr_confidence})[0]
    row = db.insert(
        "body_logs",
        {"user_id": user.id, "measured_at": p.measured_at.isoformat(), "weight_kg": p.weight_kg, "skeletal_muscle_kg": p.skeletal_muscle_kg, "body_fat_kg": p.body_fat_kg,
         "body_fat_pct": p.body_fat_pct, "source": "INBODY_OCR", "is_verified": True, "source_id": src["source_id"]},
    )[0]
    return {"log_id": row["log_id"], "source_id": src["source_id"]}
