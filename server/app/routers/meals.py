"""식단 사진 — 업로드(EXIF 제거) → Storage → 음식 인식(Gemini 또는 목업) → meals(draft)·predictions 저장 / 사진 기록 삭제"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, Response, UploadFile

from ..auth import CurrentUser, current_user, get_db
from ..config import get_settings
from ..db import Supabase
from ..errors import ApiError
from ..ai import get_analyzer, provider_of
from ..ai.base import AnalysisError, MealPhoto
from ..ai.matching import match_food
from ..ai.usage import count_today, log_request
from ..images import NotAnImage, clean_photo

router = APIRouter()


@router.post("/meals/photo", status_code=201)
async def upload_meal_photo(
    file: UploadFile = File(...),
    meal_type: Literal["breakfast", "lunch", "dinner", "snack"] = Form(...),
    eaten_at: str = Form(...),
    purpose: str = Form(""),
    user: CurrentUser = Depends(current_user),
    db: Supabase = Depends(get_db),
):
    """식단 사진 → 저장 → 음식 인식 → 초안 식사.
    AI(Gemini) 호출은 SlimLog 전체에서 이 경로 하나뿐이다 (docs/AI_Gemini_전환계획.md 0장).
    AI 가 실패해도 사진·초안은 남기고 labels=[] + ai_error 를 돌려준다 → 화면에서 직접 입력."""
    s = get_settings()
    # 1) 용도 확인 — 식단 사진만. 눈바디 등 다른 사진은 이 경로로 받지 않는다
    if purpose != "meal_photo":
        raise ApiError(400, "BAD_PURPOSE", "식단 사진만 분석할 수 있어요.", "purpose")
    provider = provider_of(s)
    # 2) 외부 AI 로 보낼 때만: 동의 + 하루 횟수 확인 (사진을 받기 전에)
    if provider != "mock":
        if not db.select("consents", select="type", user_id=f"eq.{user.id}", type="eq.food_ai", withdrawn_at="is.null"):
            raise ApiError(403, "NO_FOOD_AI_CONSENT", "음식 사진 AI 분석 동의가 필요해요.")
        try:
            mine = count_today(db, provider, user.id, s.ai_daily_limit)
            total = count_today(db, provider, None, s.ai_global_daily_limit)
        except Exception:
            raise ApiError(503, "LIMIT_CHECK_FAILED", "지금은 AI 분석을 쓸 수 없어요. 직접 입력해 주세요.")
        if mine >= s.ai_daily_limit:
            raise ApiError(429, "DAILY_LIMIT", f"오늘 AI 분석은 {s.ai_daily_limit}회까지예요. 직접 입력해 주세요.")
        if total >= s.ai_global_daily_limit:
            raise ApiError(429, "SERVICE_LIMIT", "오늘은 AI 분석 사용량이 많아요. 직접 입력해 주세요.")

    raw = await file.read(s.max_upload_bytes + 1)
    if len(raw) > s.max_upload_bytes:
        raise ApiError(413, "TOO_LARGE", "사진은 10MB 까지 올릴 수 있어요.", "file")
    try:
        when = datetime.fromisoformat(eaten_at.replace("Z", "+00:00"))
    except ValueError:
        raise ApiError(400, "BAD_TIME", "식사 시간이 올바르지 않아요.", "eaten_at")
    if when.tzinfo is None or when > datetime.now(timezone.utc):
        raise ApiError(400, "FUTURE_TIME", "아직 지나지 않은 시간이에요.", "eaten_at")
    try:
        img = clean_photo(raw)  # 이미지 검사 + EXIF(위치) 제거 + 크기 줄이기
    except NotAnImage:
        raise ApiError(400, "NOT_IMAGE", "이미지 파일만 올릴 수 있어요.", "file")

    # 3) 인식 — 실패해도 식단 기록은 계속
    analyzer = get_analyzer(s)
    ai_error = None
    result = None
    try:
        result = analyzer.analyze(MealPhoto(img.data, "meal_photo"))
    except AnalysisError as e:
        ai_error = {"code": e.code, "message": e.message}
        if provider != "mock":
            log_request(db, user_id=user.id, provider=provider, model=analyzer.model, ok=False, error_code=e.code, latency_ms=e.latency_ms)
    else:
        if provider != "mock":
            log_request(db, user_id=user.id, provider=provider, model=result.model, ok=True,
                        input_tokens=result.input_tokens, output_tokens=result.output_tokens, latency_ms=result.latency_ms)
        if not result.is_food_photo:
            ai_error = {"code": "NOT_FOOD", "message": "음식을 찾지 못했어요. 직접 추가해 주세요."}
    mode = "mock" if provider == "mock" else "model"
    model_ver = f"{provider}:{analyzer.model}"

    meal_id = str(uuid.uuid4())
    path = f"{user.id}/{meal_id}.jpg"
    db.upload(s.photo_bucket, path, img.data, img.mime)
    try:
        labels = []
        for g in (result.foods if result else []):
            m = match_food(db, g)
            recognized = m.food_id is not None and g.confidence == "high" and not g.needs_review and not m.always_review
            labels.append((g, m, "recognized" if recognized else "review"))
        if labels and not db.select("model_versions", select="model_ver_id", model_ver_id=f"eq.{model_ver}"):
            db.insert("model_versions", {"model_ver_id": model_ver, "method": "mock" if mode == "mock" else "api"})
        db.insert(
            "meals",
            {
                "meal_id": meal_id, "user_id": user.id, "meal_type": meal_type, "eaten_at": when.isoformat(), "source": "photo", "status": "draft",
                "photo_path": path, "photo_mime": img.mime, "photo_bytes": len(img.data), "photo_width": img.width, "photo_height": img.height, "photo_exif_stripped": True,
            },
        )
        preds = []
        if labels:
            preds = db.insert(
                "predictions",
                [
                    {"meal_id": meal_id, "user_id": user.id, "model_ver_id": model_ver, "mode": mode, "predicted_food_id": m.food_id,
                     "predicted_name": g.name_ko, "servings": g.servings, "portion_text": g.portion_text or None, "confidence": g.confidence,
                     "needs_review": st == "review", "candidates": m.candidates, "score": None, "threshold": None, "status": st}
                    for g, m, st in labels
                ],
            )
    except Exception:
        db.remove(s.photo_bucket, [path])  # DB 저장 실패 시 파일을 남기지 않는다
        db.delete("meals", meal_id=f"eq.{meal_id}")
        raise
    return {
        "meal_id": meal_id,
        "photo_path": path,
        "mode": mode,
        "model_status": "ready" if provider != "mock" else "mock",
        "model_version": model_ver,
        "ai_error": ai_error,
        "labels": [
            {"pred_id": p["pred_id"], "food_id": p["predicted_food_id"], "name_raw": g.name_ko, "status": p["status"], "score": None, "threshold": None,
             "candidates": p["candidates"], "confidence": g.confidence, "needs_review": p["status"] == "review",
             "servings": g.servings, "portion_text": g.portion_text, "reason": g.reason or None}
            for p, (g, _m, _st) in zip(preds, labels)
        ],
    }


@router.delete("/meals/{meal_id}", status_code=204)
def delete_meal(meal_id: str, user: CurrentUser = Depends(current_user), db: Supabase = Depends(get_db)):
    rows = db.select("meals", select="meal_id,user_id,photo_path", meal_id=f"eq.{meal_id}")
    if not rows or rows[0]["user_id"] != user.id:
        raise ApiError(404, "NOT_FOUND", "식단 기록을 찾을 수 없어요.")
    if rows[0]["photo_path"]:
        db.remove(get_settings().photo_bucket, [rows[0]["photo_path"]])
    db.delete("meals", meal_id=f"eq.{meal_id}")
    return Response(status_code=204)
