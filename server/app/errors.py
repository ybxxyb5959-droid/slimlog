"""오류 형식 통일: {code, message, field} (계획서 6.7)"""
from __future__ import annotations

from fastapi import HTTPException


class ApiError(HTTPException):
    def __init__(self, status: int, code: str, message: str, field: str | None = None, **extra):
        super().__init__(status_code=status, detail={"code": code, "message": message, "field": field, **extra})
