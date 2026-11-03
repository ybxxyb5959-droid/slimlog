"""
Supabase 접근 (service_role) — PostgREST · Storage · Auth Admin 을 httpx 로 직접 부른다.
service_role 은 RLS 를 우회하므로, 이 서버의 모든 함수는 '누구의 데이터인지'를 직접 확인해야 한다.
"""
from __future__ import annotations

from typing import Any

import httpx

from .config import Settings


class Supabase:
    def __init__(self, s: Settings, client: httpx.Client | None = None):
        self.s = s
        self.http = client or httpx.Client(timeout=20)
        self.h = {"apikey": s.service_key, "Authorization": f"Bearer {s.service_key}"}

    # ── PostgREST ──
    def _rest(self, method: str, table: str, params: dict | None = None, json: Any = None, prefer: str | None = None):
        headers = dict(self.h)
        if prefer:
            headers["Prefer"] = prefer
        r = self.http.request(method, f"{self.s.supabase_url}/rest/v1/{table}", params=params, json=json, headers=headers)
        if r.status_code >= 400:
            raise RuntimeError(f"{method} {table} {r.status_code}: {r.text}")
        return r.json() if r.content else None

    def select(self, table: str, **params) -> list[dict]:
        return self._rest("GET", table, params=params) or []

    def insert(self, table: str, row: dict | list[dict]) -> list[dict]:
        return self._rest("POST", table, json=row, prefer="return=representation") or []

    def update(self, table: str, patch: dict, **params) -> list[dict]:
        return self._rest("PATCH", table, params=params, json=patch, prefer="return=representation") or []

    def delete(self, table: str, **params) -> list[dict]:
        return self._rest("DELETE", table, params=params, prefer="return=representation") or []

    # ── Storage ──
    def upload(self, bucket: str, path: str, data: bytes, content_type: str):
        r = self.http.post(
            f"{self.s.supabase_url}/storage/v1/object/{bucket}/{path}", content=data, headers={**self.h, "Content-Type": content_type, "x-upsert": "false"}
        )
        if r.status_code >= 400:
            raise RuntimeError(f"upload {r.status_code}: {r.text}")

    def remove(self, bucket: str, paths: list[str]):
        if not paths:
            return
        r = self.http.request("DELETE", f"{self.s.supabase_url}/storage/v1/object/{bucket}", json={"prefixes": paths}, headers=self.h)
        if r.status_code >= 400:
            raise RuntimeError(f"remove {r.status_code}: {r.text}")

    def list_folder(self, bucket: str, prefix: str) -> list[str]:
        out: list[str] = []
        offset = 0
        while True:
            r = self.http.post(
                f"{self.s.supabase_url}/storage/v1/object/list/{bucket}", json={"prefix": prefix, "limit": 100, "offset": offset}, headers=self.h
            )
            if r.status_code >= 400:
                raise RuntimeError(f"list {r.status_code}: {r.text}")
            items = r.json()
            out += [f"{prefix.rstrip('/')}/{i['name']}" for i in items if i.get("id")]
            if len(items) < 100:
                return out
            offset += 100

    # ── Auth Admin ──
    def delete_auth_user(self, user_id: str):
        r = self.http.delete(f"{self.s.supabase_url}/auth/v1/admin/users/{user_id}", headers=self.h)
        if r.status_code >= 400:
            raise RuntimeError(f"delete user {r.status_code}: {r.text}")
