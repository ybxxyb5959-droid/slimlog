"""API 통합 테스트 — 실제 Supabase Auth 토큰으로 호출하고 DB 결과를 확인한다"""
import io
from datetime import datetime, timedelta, timezone

import httpx
from PIL import Image

from tests.conftest import H, URL, admin_rest


def jpeg_with_gps() -> bytes:
    img = Image.new("RGB", (800, 600), "green")
    exif = Image.Exif()
    exif[0x8825] = {2: (37, 33, 0)}
    buf = io.BytesIO()
    img.save(buf, format="JPEG", exif=exif.tobytes())
    return buf.getvalue()


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["model_status"] == "mock"


def test_auth_required_and_bad_token(client):
    assert client.post("/posts", json={"category": "free", "title": "t", "body": "b"}).json()["detail"]["code"] == "NO_TOKEN"
    r = client.post("/posts", json={"category": "free", "title": "t", "body": "b"}, headers={"Authorization": "Bearer abc.def.ghi"})
    assert r.status_code == 401 and r.json()["detail"]["code"] == "INVALID_TOKEN"


def test_community_screening_and_ownership(client, make_user):
    a, b = make_user("a"), make_user("b")
    # LOW → 공개
    r = client.post("/posts", json={"category": "review", "title": "6주차 후기", "body": "단백질 챙기는 중"}, headers=a.h)
    assert r.status_code == 201 and r.json()["status"] == "visible"
    pid = r.json()["post_id"]
    # BLOCKED → 저장 안 됨 + filter_logs
    r = client.post("/posts", json={"category": "free", "title": "펜", "body": "남은 펜 양 도해요 쪽지 주세요"}, headers=a.h)
    assert r.status_code == 422 and r.json()["detail"]["code"] == "POST_BLOCKED"
    assert len(admin_rest("GET", "posts", params={"user_id": f"eq.{a.id}", "select": "post_id"}).json()) == 1
    logs = admin_rest("GET", "filter_logs", params={"user_id": f"eq.{a.id}", "select": "level"}).json()
    assert sorted(l["level"] for l in logs) == ["BLOCKED", "LOW"]
    # REVIEW → 작성자만 보임
    r = client.post("/posts", json={"category": "question", "title": "증량", "body": "몇 mg부터 올리세요?"}, headers=a.h)
    hid = r.json()["post_id"]
    assert r.json()["status"] == "hidden"
    assert len(b.rest("GET", "posts", params={"post_id": f"eq.{hid}"}).json()) == 0
    assert len(a.rest("GET", "posts", params={"post_id": f"eq.{hid}"}).json()) == 1
    # 남의 글 수정·삭제 불가
    assert client.patch(f"/posts/{pid}", json={"category": "review", "title": "x", "body": "y"}, headers=b.h).status_code == 403
    assert client.delete(f"/posts/{pid}", headers=b.h).status_code == 403
    # 수정 시 재검사 → BLOCKED 면 원래 글 유지
    r = client.patch(f"/posts/{pid}", json={"category": "review", "title": "후기", "body": "직거래 해요"}, headers=a.h)
    assert r.status_code == 422
    assert admin_rest("GET", "posts", params={"post_id": f"eq.{pid}", "select": "body"}).json()[0]["body"] == "단백질 챙기는 중"
    # 앱이 DB 에 직접 쓰기 불가 (서버 전용)
    assert b.rest("POST", "posts", json={"user_id": b.id, "category": "free", "title": "t", "body": "직거래", "risk_level": "LOW"}).status_code >= 400
    # 댓글 + 좋아요 수
    r = client.post(f"/posts/{pid}/comments", json={"body": "응원해요"}, headers=b.h)
    assert r.status_code == 201
    b.rest("POST", "post_likes", json={"post_id": pid, "user_id": b.id}).raise_for_status()
    p = admin_rest("GET", "posts", params={"post_id": f"eq.{pid}", "select": "like_count,comment_count"}).json()[0]
    assert (p["like_count"], p["comment_count"]) == (1, 1)
    # 소프트 삭제
    assert client.delete(f"/posts/{pid}", headers=a.h).status_code == 204
    assert len(b.rest("GET", "posts", params={"post_id": f"eq.{pid}"}).json()) == 0


def test_admin_actions_require_db_role(client, make_user):
    a, mod = make_user("writer"), make_user("mod")
    pid = client.post("/posts", json={"category": "free", "title": "글", "body": "내용"}, headers=a.h).json()["post_id"]
    body = {"target_type": "post", "target_id": pid, "action": "hide", "reason": "신고 접수"}
    assert client.post("/admin/actions", json=body, headers=mod.h).status_code == 403
    admin_rest("PATCH", "users", params={"user_id": f"eq.{mod.id}"}, json={"role": "admin"}).raise_for_status()
    assert client.post("/admin/actions", json={**body, "reason": "x"}, headers=mod.h).status_code == 422  # 사유 2자 이상
    r = client.post("/admin/actions", json=body, headers=mod.h)
    assert r.status_code == 201
    assert admin_rest("GET", "posts", params={"post_id": f"eq.{pid}", "select": "status"}).json()[0]["status"] == "blocked"
    acts = admin_rest("GET", "admin_actions", params={"admin_id": f"eq.{mod.id}", "select": "action,reason"}).json()
    assert acts == [{"action": "hide", "reason": "신고 접수"}]
    # 작성자는 관리자가 막은 글을 못 고침
    assert client.patch(f"/posts/{pid}", json={"category": "free", "title": "글", "body": "다시"}, headers=a.h).status_code == 403


def test_residual_curve_uses_only_my_doses(client, make_user):
    a, b = make_user("pk-a"), make_user("pk-b")
    now = datetime.now(timezone.utc)
    a.rest("POST", "doses", json={"med_id": "mounjaro", "dose_mg": 2.5, "injected_at": (now - timedelta(days=3)).isoformat(), "site": "abdomen_left"}).raise_for_status()
    r = client.get("/residual-curve", params={"med_id": "mounjaro"}, headers=a.h)
    assert r.status_code == 200
    pts = r.json()["points"]
    assert pts and max(p["relative"] for p in pts) == 100 and r.json()["unit"] == "relative"
    assert client.get("/residual-curve", params={"med_id": "mounjaro"}, headers=b.h).json()["points"] == []
    r = client.get("/residual-curve", params={"med_id": "efpe"}, headers=a.h)
    assert r.json()["points"] == [] and "반감기" in r.json()["reason"]


def test_meal_photo_upload_strip_exif_mock_and_delete(client, make_user):
    a, b = make_user("photo-a"), make_user("photo-b")
    eaten = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    r = client.post("/meals/photo", files={"file": ("a.jpg", jpeg_with_gps(), "image/jpeg")}, data={"meal_type": "lunch", "eaten_at": eaten}, headers=a.h)
    assert r.status_code == 201, r.text
    j = r.json()
    assert j["mode"] == "mock" and j["photo_path"].startswith(f"{a.id}/") and len(j["labels"]) == 5
    meal = admin_rest("GET", "meals", params={"meal_id": f"eq.{j['meal_id']}", "select": "status,source,photo_exif_stripped,photo_bytes"}).json()[0]
    assert meal["status"] == "draft" and meal["source"] == "photo" and meal["photo_exif_stripped"] is True
    preds = admin_rest("GET", "predictions", params={"meal_id": f"eq.{j['meal_id']}", "select": "mode,score"}).json()
    assert {p["mode"] for p in preds} == {"mock"}
    # 저장된 파일에 EXIF(GPS) 없음
    f = httpx.get(f"{URL}/storage/v1/object/authenticated/meal-photos/{j['photo_path']}", headers=H)
    assert f.status_code == 200 and len(Image.open(io.BytesIO(f.content)).getexif()) == 0
    # 이미지 아님 / 미래 시간 거절
    assert client.post("/meals/photo", files={"file": ("x.jpg", b"nope", "image/jpeg")}, data={"meal_type": "lunch", "eaten_at": eaten}, headers=a.h).json()["detail"]["code"] == "NOT_IMAGE"
    future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    assert client.post("/meals/photo", files={"file": ("a.jpg", jpeg_with_gps(), "image/jpeg")}, data={"meal_type": "lunch", "eaten_at": future}, headers=a.h).status_code == 400
    # 남의 사진 기록 삭제 불가, 본인 삭제 → 파일·행 모두 삭제
    assert client.delete(f"/meals/{j['meal_id']}", headers=b.h).status_code == 404
    assert client.delete(f"/meals/{j['meal_id']}", headers=a.h).status_code == 204
    assert admin_rest("GET", "meals", params={"meal_id": f"eq.{j['meal_id']}"}).json() == []
    assert httpx.get(f"{URL}/storage/v1/object/authenticated/meal-photos/{j['photo_path']}", headers=H).status_code >= 400


def test_delete_me_removes_files_and_all_rows(client, make_user):
    a = make_user("bye")
    eaten = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    j = client.post("/meals/photo", files={"file": ("a.jpg", jpeg_with_gps(), "image/jpeg")}, data={"meal_type": "dinner", "eaten_at": eaten}, headers=a.h).json()
    a.rest("POST", "doses", json={"med_id": "wegovy", "dose_mg": 0.5, "injected_at": eaten, "site": "abdomen_right"}).raise_for_status()
    assert client.delete("/me", headers=a.h).status_code == 204
    assert admin_rest("GET", "users", params={"user_id": f"eq.{a.id}"}).json() == []
    assert admin_rest("GET", "doses", params={"user_id": f"eq.{a.id}"}).json() == []
    assert httpx.get(f"{URL}/storage/v1/object/authenticated/meal-photos/{j['photo_path']}", headers=H).status_code >= 400
