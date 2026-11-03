"""식단 사진 — 업로드(EXIF 제거) → Storage → 인식 → meals(draft)·predictions 저장 / 사진 기록 삭제"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, Response, UploadFile

from ..auth import CurrentUser, current_user, get_db
from ..config import get_settings
from ..db import Supabase
from ..errors import ApiError
from ..images import NotAnImage, clean_photo

router = APIRouter()


@router.post("/meals/photo", status_code=201)
async def upload_meal_photo(
    file: UploadFile = File(...),
    meal_type: Literal["breakfast", "lunch", "dinner", "snack"] = Form(...),
    eaten_at: str = Form(...),
    user: CurrentUser = Depends(current_user),
    db: Supabase = Depends(get_db),
):
    from ..main import recognizer

    s = get_settings()
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
        img = clean_photo(raw)
    except NotAnImage:
        raise ApiError(400, "NOT_IMAGE", "이미지 파일만 올릴 수 있어요.", "file")

    meal_id = str(uuid.uuid4())
    path = f"{user.id}/{meal_id}.jpg"
    db.upload(s.photo_bucket, path, img.data, img.mime)
    try:
        result = recognizer().predict(img.data)
        db.insert("model_versions", {"model_ver_id": result.model_version, "method": "mock" if result.mode == "mock" else "model"}) if not db.select(
            "model_versions", select="model_ver_id", model_ver_id=f"eq.{result.model_version}"
        ) else None
        db.insert(
            "meals",
            {
                "meal_id": meal_id, "user_id": user.id, "meal_type": meal_type, "eaten_at": when.isoformat(), "source": "photo", "status": "draft",
                "photo_path": path, "photo_mime": img.mime, "photo_bytes": len(img.data), "photo_width": img.width, "photo_height": img.height, "photo_exif_stripped": True,
            },
        )
        preds = []
        if result.labels:
            preds = db.insert(
                "predictions",
                [
                    {"meal_id": meal_id, "user_id": user.id, "model_ver_id": result.model_version, "mode": result.mode, "predicted_food_id": l.food_id,
                     "candidates": l.candidates, "score": l.score, "threshold": l.threshold, "status": l.status}
                    for l in result.labels
                ],
            )
    except Exception:
        db.remove(s.photo_bucket, [path])  # DB 저장 실패 시 파일을 남기지 않는다
        db.delete("meals", meal_id=f"eq.{meal_id}")
        raise
    return {
        "meal_id": meal_id,
        "photo_path": path,
        "mode": result.mode,
        "model_status": result.model_status,
        "model_version": result.model_version,
        "labels": [
            {"pred_id": p["pred_id"], "food_id": p["predicted_food_id"], "status": p["status"], "score": p["score"], "threshold": p["threshold"], "candidates": p["candidates"]}
            for p in preds
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
