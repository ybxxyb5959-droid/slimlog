"""
영양제·복용약 폰 푸시
- GET  /push/public-key : 브라우저가 구독할 때 쓰는 VAPID 공개키
- POST /push/run        : (예약 실행) 지금 '시'에 알림 켠 항목 중 오늘 아직 안 먹은 것 → 그 사용자 기기들로 발송
                          헤더 X-Cron-Secret 필요. Render Cron·GitHub Actions 등으로 매시 5분에 호출
- POST /push/action     : 알림의 [먹었어요]/[건너뛰었어요] → 섭취 기록 (서버가 서명한 1일짜리 토큰으로 확인)
시간대는 한국(Asia/Seoul) 기준. 같은 날 같은 항목은 한 번만 보낸다(last_reminded_on).
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
from datetime import datetime, timedelta, timezone
from typing import Callable, Literal

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel

from ..auth import get_db
from ..db import Supabase
from ..errors import ApiError

router = APIRouter()
KST = timezone(timedelta(hours=9))


def _cfg():
    return {
        "public": os.environ.get("VAPID_PUBLIC_KEY", ""),
        "private": os.environ.get("VAPID_PRIVATE_KEY", ""),
        "subject": os.environ.get("VAPID_SUBJECT", "mailto:admin@slimlog.app"),
        "cron": os.environ.get("CRON_SECRET", ""),
        "api": os.environ.get("PUBLIC_API_URL", ""),
        "app": os.environ.get("PUBLIC_APP_URL", ""),
    }


def _sign(payload: str) -> str:
    key = (_cfg()["private"] or _cfg()["cron"] or "dev").encode()
    sig = hmac.new(key, payload.encode(), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=") + "." + base64.urlsafe_b64encode(sig).decode().rstrip("=")


def _verify(token: str) -> dict:
    try:
        p64, s64 = token.split(".")
        payload = base64.urlsafe_b64decode(p64 + "=" * (-len(p64) % 4)).decode()
        expected = _sign(payload).split(".")[1]
        if not hmac.compare_digest(expected, s64):
            raise ValueError
        data = json.loads(payload)
        if datetime.fromisoformat(data["exp"]) < datetime.now(timezone.utc):
            raise ValueError
        return data
    except Exception:
        raise ApiError(400, "BAD_TOKEN", "알림이 만료됐어요. 앱에서 기록해 주세요.")


def webpush_send(sub: dict, data: dict) -> int:
    """실제 발송 (pywebpush). 반환: HTTP 상태 (404/410 이면 구독 만료)"""
    from pywebpush import WebPushException, webpush

    c = _cfg()
    try:
        r = webpush(
            subscription_info={"endpoint": sub["endpoint"], "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]}},
            data=json.dumps(data, ensure_ascii=False),
            vapid_private_key=c["private"],
            vapid_claims={"sub": c["subject"]},
            ttl=3600,
        )
        return r.status_code
    except WebPushException as e:
        return e.response.status_code if e.response is not None else 500


SENDER: Callable[[dict, dict], int] = webpush_send  # 테스트에서 바꿔 끼운다


@router.get("/push/public-key")
def public_key():
    k = _cfg()["public"]
    if not k:
        raise ApiError(503, "PUSH_NOT_CONFIGURED", "폰 알림이 아직 설정되지 않았어요.")
    return {"publicKey": k}


def run_due(db: Supabase, now: datetime | None = None) -> dict:
    now = (now or datetime.now(timezone.utc)).astimezone(KST)
    today = now.date().isoformat()
    start = datetime(now.year, now.month, now.day, tzinfo=KST).astimezone(timezone.utc).isoformat()
    items = db.select(
        "intake_items", select="item_id,user_id,kind,name,remind_hour,last_reminded_on", remind_enabled="eq.true", remind_hour=f"eq.{now.hour}", active="eq.true"
    )
    sent = skipped = gone = 0
    for it in items:
        if it.get("last_reminded_on") == today:
            continue
        done = db.select("intake_logs", select="log_id", item_id=f"eq.{it['item_id']}", taken_at=f"gte.{start}")
        if done:
            skipped += 1
        else:
            subs = db.select("push_subscriptions", select="sub_id,endpoint,p256dh,auth", user_id=f"eq.{it['user_id']}")
            exp = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
            token = _sign(json.dumps({"item": it["item_id"], "user": it["user_id"], "kind": it["kind"], "at": now.isoformat(), "exp": exp}))
            verb = "먹을" if it["kind"] == "supplement" else "복용할"
            payload = {"title": "SlimLog", "body": f"{it['name']} {verb} 시간이에요", "url": f"{_cfg()['app']}/record/daily", "api": _cfg()["api"], "token": token}
            for s in subs:
                status = SENDER(s, payload)
                if status in (404, 410):
                    db.delete("push_subscriptions", sub_id=f"eq.{s['sub_id']}")
                    gone += 1
                elif status < 300:
                    sent += 1
        db.update("intake_items", {"last_reminded_on": today}, item_id=f"eq.{it['item_id']}")
    return {"hour": now.hour, "items": len(items), "sent": sent, "already_taken": skipped, "expired_subscriptions": gone}


@router.post("/push/run")
def push_run(x_cron_secret: str | None = Header(default=None), db: Supabase = Depends(get_db)):
    c = _cfg()
    if not c["cron"] or not hmac.compare_digest(x_cron_secret or "", c["cron"]):
        raise ApiError(403, "FORBIDDEN", "예약 실행 비밀값이 맞지 않아요.")
    return run_due(db)


class ActionIn(BaseModel):
    token: str
    action: Literal["taken", "skipped"]


@router.post("/push/action", status_code=201)
def push_action(a: ActionIn, db: Supabase = Depends(get_db)):
    d = _verify(a.token)
    item = db.select("intake_items", select="item_id,user_id,kind", item_id=f"eq.{d['item']}")
    if not item or item[0]["user_id"] != d["user"]:
        raise ApiError(404, "NOT_FOUND", "항목을 찾을 수 없어요.")
    # 복용약은 민감정보 → 동의가 살아 있을 때만
    if item[0]["kind"] == "medicine" and not db.select("consents", select="type", user_id=f"eq.{d['user']}", type="eq.sensitive", withdrawn_at="is.null"):
        raise ApiError(403, "NO_CONSENT", "민감정보 동의 후 기록할 수 있어요.")
    row = db.insert(
        "intake_logs",
        {"user_id": d["user"], "kind": item[0]["kind"], "item_id": d["item"], "taken_at": datetime.now(timezone.utc).isoformat(), "status": a.action, "scheduled_at": d["at"]},
    )[0]
    return {"log_id": row["log_id"]}
