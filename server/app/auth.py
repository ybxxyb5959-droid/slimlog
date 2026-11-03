"""
요청한 사용자 확인 — Authorization: Bearer <Supabase access token>
- HS256(로컬 Supabase·구형 프로젝트): SUPABASE_JWT_SECRET 로 검증
- ES256/RS256(신형 프로젝트): {SUPABASE_URL}/auth/v1/.well-known/jwks.json 공개키로 검증
관리자 여부는 토큰이 아니라 DB(users.role)에서 매번 확인한다 (권한 상승 방지).
"""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

import jwt
from fastapi import Depends, Header

from .config import Settings, get_settings
from .db import Supabase
from .errors import ApiError


@dataclass
class CurrentUser:
    id: str
    email: str | None


@lru_cache
def _jwks(url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(f"{url}/auth/v1/.well-known/jwks.json", cache_keys=True)


def verify_token(token: str, s: Settings) -> dict:
    try:
        alg = jwt.get_unverified_header(token).get("alg")
        if alg == "HS256":
            if not s.jwt_secret:
                raise ApiError(401, "AUTH_CONFIG", "서버에 JWT 검증 설정이 없어요")
            key = s.jwt_secret
        else:
            key = _jwks(s.supabase_url).get_signing_key_from_jwt(token).key
        return jwt.decode(token, key, algorithms=["HS256", "ES256", "RS256"], audience="authenticated")
    except ApiError:
        raise
    except jwt.ExpiredSignatureError:
        raise ApiError(401, "TOKEN_EXPIRED", "로그인이 만료됐어요. 다시 로그인해 주세요.")
    except Exception:
        raise ApiError(401, "INVALID_TOKEN", "로그인 정보를 확인할 수 없어요.")


_db: Supabase | None = None


def get_db() -> Supabase:
    global _db
    if _db is None:
        _db = Supabase(get_settings())
    return _db


def current_user(authorization: str | None = Header(default=None), s: Settings = Depends(get_settings)) -> CurrentUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise ApiError(401, "NO_TOKEN", "로그인이 필요해요.")
    claims = verify_token(authorization.split(" ", 1)[1], s)
    if claims.get("role") != "authenticated" or not claims.get("sub"):
        raise ApiError(401, "INVALID_TOKEN", "로그인 정보를 확인할 수 없어요.")
    return CurrentUser(id=claims["sub"], email=claims.get("email"))


def require_admin(user: CurrentUser = Depends(current_user), db: Supabase = Depends(get_db)) -> CurrentUser:
    rows = db.select("users", select="role", user_id=f"eq.{user.id}")
    if not rows or rows[0].get("role") != "admin":
        raise ApiError(403, "NOT_ADMIN", "관리자만 할 수 있어요.")
    return user
