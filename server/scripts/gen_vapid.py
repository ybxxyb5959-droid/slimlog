"""폰 푸시용 VAPID 키 만들기 — 배포 서버 환경변수에 넣는다 (개인키는 채팅·저장소에 올리지 않기)
.venv/bin/python scripts/gen_vapid.py
"""
import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec

key = ec.generate_private_key(ec.SECP256R1())
priv = base64.urlsafe_b64encode(key.private_numbers().private_value.to_bytes(32, "big")).decode().rstrip("=")
pub = base64.urlsafe_b64encode(key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)).decode().rstrip("=")
print(f"VAPID_PUBLIC_KEY={pub}")
print(f"VAPID_PRIVATE_KEY={priv}")
