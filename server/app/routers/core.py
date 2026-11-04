"""상태 확인 · 참고 곡선 · 탈퇴"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query, Response

from ..auth import CurrentUser, current_user, get_db
from ..db import Supabase
from ..errors import ApiError
from ..pk import relative_curve

router = APIRouter()


@router.get("/health")
def health():
    """AI 엔진 종류만 알려준다 (키 값은 절대 내보내지 않음)"""
    from ..ai import provider_of
    from ..config import Settings

    p = provider_of(Settings())
    return {"status": "ok", "ai_provider": p, "model_status": "ready" if p != "mock" else "mock"}


def _ms(iso: str) -> int:
    return int(datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp() * 1000)


@router.get("/residual-curve")
def residual_curve(
    med_id: str,
    frm: str | None = Query(default=None, alias="from"),
    to: str | None = None,
    user: CurrentUser = Depends(current_user),
    db: Supabase = Depends(get_db),
):
    """내 투약 기록으로 참고용 상대 곡선(0~100). 반감기 출처가 없는 약은 곡선을 만들지 않는다."""
    meds = db.select("medications", select="med_id,half_life_h", med_id=f"eq.{med_id}")
    if not meds:
        raise ApiError(404, "MED_NOT_FOUND", "약 정보를 찾을 수 없어요.", "med_id")
    half = meds[0]["half_life_h"]
    now = datetime.now(timezone.utc)
    t_to = _ms(to) if to else int(now.timestamp() * 1000)
    t_from = _ms(frm) if frm else t_to - 30 * 86_400_000
    if t_from >= t_to:
        raise ApiError(400, "BAD_RANGE", "기간이 올바르지 않아요.", "from")
    base = {"med_id": med_id, "half_life_h": half, "unit": "relative", "note": "참고용 계산값이며 실제 혈중농도 또는 약효를 의미하지 않습니다."}
    if not half:
        return {**base, "points": [], "reason": "반감기 출처를 확인하지 못해 곡선을 만들지 않아요."}
    # 이전 투약의 잔존분도 반영: 반감기 10배 이전부터 조회 (그 전 영향은 0.1% 미만)
    since = datetime.fromtimestamp((t_from - float(half) * 10 * 3_600_000) / 1000, timezone.utc).isoformat()
    rows = db.select(
        "doses", select="injected_at,dose_mg", user_id=f"eq.{user.id}", med_id=f"eq.{med_id}", injected_at=f"gte.{since}", order="injected_at"
    )
    doses = [(_ms(r["injected_at"]), float(r["dose_mg"])) for r in rows if _ms(r["injected_at"]) <= t_to]
    return {**base, "points": relative_curve(doses, float(half), t_from, t_to)}


@router.delete("/me", status_code=204)
def delete_me(user: CurrentUser = Depends(current_user), db: Supabase = Depends(get_db)):
    """탈퇴: Storage 사진 폴더 → Auth 사용자 삭제(모든 테이블 cascade). 순서를 지켜 고아 파일을 남기지 않는다."""
    from ..config import get_settings

    bucket = get_settings().photo_bucket
    try:
        db.remove(bucket, db.list_folder(bucket, user.id))
        db.delete_auth_user(user.id)
    except Exception as e:  # 그냥 500 이면 CORS 헤더가 빠져 앱에선 '연결 실패'로만 보인다 → 이유를 담아 돌려준다
        print("delete_me failed:", user.id, e)
        raise ApiError(502, "DELETE_FAILED", "탈퇴를 끝내지 못했어요. 잠시 후 다시 시도해 주세요.") from e
    return Response(status_code=204)
