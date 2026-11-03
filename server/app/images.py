"""
식단 사진 처리 — 업로드 원본을 그대로 저장하지 않는다.
1) 이미지인지 확인(실제 디코딩) 2) 방향만 반영 후 EXIF(촬영 위치·기기 정보) 제거
3) 긴 변 1600px 이하로 줄이고 JPEG(품질 85)로 다시 저장 → 크기·형식 통일
"""
from __future__ import annotations

import io
from dataclasses import dataclass

from PIL import Image, ImageOps, UnidentifiedImageError

MAX_SIDE = 1600


@dataclass
class CleanImage:
    data: bytes
    width: int
    height: int
    mime: str = "image/jpeg"


class NotAnImage(ValueError):
    pass


def clean_photo(raw: bytes) -> CleanImage:
    try:
        img = Image.open(io.BytesIO(raw))
        img.load()
    except (UnidentifiedImageError, OSError) as e:
        raise NotAnImage("이미지 파일이 아니에요") from e
    img = ImageOps.exif_transpose(img)  # 세로 사진이 눕지 않게 방향만 적용
    img = img.convert("RGB")  # 알파·팔레트 제거 (JPEG)
    img.thumbnail((MAX_SIDE, MAX_SIDE))
    out = io.BytesIO()
    # exif 를 넘기지 않고 새로 저장 → 메타데이터 없음
    img.save(out, format="JPEG", quality=85, optimize=True)
    return CleanImage(out.getvalue(), img.width, img.height)
