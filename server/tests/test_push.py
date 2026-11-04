"""폰 푸시 — 실제 푸시 서버로는 보내지 않고 발송 함수를 바꿔 끼워서 확인"""
from datetime import datetime, timedelta, timezone

import pytest

from app.routers import push
from tests.conftest import admin_rest

KST = timezone(timedelta(hours=9))


@pytest.fixture
def push_env(monkeypatch):
    monkeypatch.setenv("VAPID_PUBLIC_KEY", "test-public")
    monkeypatch.setenv("VAPID_PRIVATE_KEY", "test-private-secret")
    monkeypatch.setenv("CRON_SECRET", "cron-secret")
    monkeypatch.setenv("PUBLIC_API_URL", "https://api.example.test")
    sent: list[tuple[dict, dict]] = []
    status = {"code": 201}
    monkeypatch.setattr(push, "SENDER", lambda sub, data: (sent.append((sub, data)), status["code"])[1])
    return sent, status


def _setup(make_user, name="유산균", kind="supplement"):
    u = make_user("push")
    hour = datetime.now(timezone.utc).astimezone(KST).hour
    item = u.rest("POST", "intake_items", json={"kind": kind, "name": name, "remind_enabled": True, "remind_hour": hour}).json()[0]
    u.rest("POST", "push_subscriptions", json={"endpoint": f"https://push.example.test/{u.id}", "p256dh": "p", "auth": "a"}).raise_for_status()
    return u, item


def test_public_key_and_cron_secret(client, push_env, monkeypatch):
    assert client.get("/push/public-key").json() == {"publicKey": "test-public"}
    assert client.post("/push/run").status_code == 403
    assert client.post("/push/run", headers={"X-Cron-Secret": "wrong"}).status_code == 403
    monkeypatch.delenv("VAPID_PUBLIC_KEY")
    assert client.get("/push/public-key").status_code == 503


def test_run_sends_once_per_day_and_action_records(client, push_env, make_user):
    sent, _ = push_env
    u, item = _setup(make_user)
    r = client.post("/push/run", headers={"X-Cron-Secret": "cron-secret"})
    assert r.status_code == 200
    mine = [d for s, d in sent if s["endpoint"].endswith(u.id)]
    assert len(mine) == 1 and mine[0]["body"] == "유산균 먹을 시간이에요" and mine[0]["api"] == "https://api.example.test"
    # 같은 날 다시 실행 → 안 보냄
    client.post("/push/run", headers={"X-Cron-Secret": "cron-secret"})
    assert len([d for s, d in sent if s["endpoint"].endswith(u.id)]) == 1
    # 알림의 [먹었어요] → 기록
    r = client.post("/push/action", json={"token": mine[0]["token"], "action": "taken"})
    assert r.status_code == 201
    logs = admin_rest("GET", "intake_logs", params={"item_id": f"eq.{item['item_id']}", "select": "status,scheduled_at"}).json()
    assert logs[0]["status"] == "taken" and logs[0]["scheduled_at"]
    # 위조 토큰 거절
    assert client.post("/push/action", json={"token": mine[0]["token"][:-3] + "abc", "action": "taken"}).status_code == 400


def test_already_taken_today_is_not_sent(client, push_env, make_user):
    sent, _ = push_env
    u, item = _setup(make_user)
    u.rest("POST", "intake_logs", json={"kind": "supplement", "item_id": item["item_id"], "taken_at": datetime.now(timezone.utc).isoformat()}).raise_for_status()
    client.post("/push/run", headers={"X-Cron-Secret": "cron-secret"})
    assert not [d for s, d in sent if s["endpoint"].endswith(u.id)]


def test_expired_subscription_is_removed(client, push_env, make_user):
    _, status = push_env
    status["code"] = 410
    u, _ = _setup(make_user)
    client.post("/push/run", headers={"X-Cron-Secret": "cron-secret"})
    assert admin_rest("GET", "push_subscriptions", params={"user_id": f"eq.{u.id}"}).json() == []


def test_push_subscriptions_rls(make_user):
    a, b = make_user("rls-a"), make_user("rls-b")
    a.rest("POST", "push_subscriptions", json={"endpoint": "https://push.example.test/a-only", "p256dh": "p", "auth": "a"}).raise_for_status()
    assert b.rest("GET", "push_subscriptions").json() == []
    assert b.rest("POST", "push_subscriptions", json={"user_id": a.id, "endpoint": "https://push.example.test/x", "p256dh": "p", "auth": "a"}).status_code >= 400
