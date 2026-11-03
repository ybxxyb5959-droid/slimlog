"""
서버 통합 테스트 — 로컬 Supabase(공식 CLI)에 실제로 붙는다. 사전: npx supabase start
테스트 사용자는 만들고 끝나면 지운다.
"""
from __future__ import annotations

import os
import subprocess
import time
import uuid

import httpx
import pytest


def _local_env() -> dict:
    if os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
        return {}
    out = subprocess.run(["npx", "-y", "supabase", "status", "-o", "env"], cwd="..", capture_output=True, text=True, check=True).stdout
    env = {}
    for line in out.splitlines():
        if "=" in line:
            k, v = line.split("=", 1)
            env[k] = v.strip().strip('"')
    return {"SUPABASE_URL": env["API_URL"], "SUPABASE_SERVICE_ROLE_KEY": env["SERVICE_ROLE_KEY"], "SUPABASE_JWT_SECRET": env.get("JWT_SECRET", ""), "SUPABASE_ANON_KEY": env["ANON_KEY"]}


os.environ.update(_local_env())
os.environ.setdefault("FOOD_MODEL_PATH", "models/__none__.onnx")  # 모델 없음 → 목업 모드

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

URL = os.environ["SUPABASE_URL"]
SERVICE = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
ANON = os.environ.get("SUPABASE_ANON_KEY", "")
H = {"apikey": SERVICE, "Authorization": f"Bearer {SERVICE}"}


class TestUser:
    def __init__(self, tag: str):
        self.email = f"api-{tag}-{uuid.uuid4().hex[:8]}@slimlog.test"
        pw = "test-password-1"
        r = httpx.post(f"{URL}/auth/v1/admin/users", headers=H, json={"email": self.email, "password": pw, "email_confirm": True})
        r.raise_for_status()
        self.id = r.json()["id"]
        t = httpx.post(f"{URL}/auth/v1/token?grant_type=password", headers={"apikey": ANON or SERVICE}, json={"email": self.email, "password": pw})
        t.raise_for_status()
        self.token = t.json()["access_token"]
        self.h = {"Authorization": f"Bearer {self.token}"}

    def rest(self, method: str, table: str, **kw):
        """사용자 권한(RLS 적용)으로 Supabase 직접 호출 — 앱과 같은 경로"""
        return httpx.request(method, f"{URL}/rest/v1/{table}", headers={"apikey": ANON, "Authorization": f"Bearer {self.token}", "Prefer": "return=representation"}, **kw)

    def cleanup(self):
        httpx.delete(f"{URL}/auth/v1/admin/users/{self.id}", headers=H)


def admin_rest(method: str, table: str, **kw):
    return httpx.request(method, f"{URL}/rest/v1/{table}", headers={**H, "Prefer": "return=representation"}, **kw)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def make_user():
    made: list[TestUser] = []

    def _make(tag="u", consent=True) -> TestUser:
        u = TestUser(tag)
        made.append(u)
        if consent:
            for t in ("terms", "privacy", "sensitive"):
                u.rest("POST", "consents", json={"user_id": u.id, "type": t, "version": "v1"}).raise_for_status()
        return u

    yield _make
    for u in made:
        u.cleanup()
    time.sleep(0.05)
