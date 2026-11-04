"""
식단 사진 AI(Gemini) — DB·인터넷 없이 도는 테스트
사용 범위 원칙(docs/AI_Gemini_전환계획.md 0장)이 코드에서 지켜지는지 함께 검사한다.
"""
from __future__ import annotations

import io
import json
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.ai import base as ai_base
from app.ai.base import AnalysisError, MealPhoto, sanitize
from app.ai.gemini_food import RESPONSE_SCHEMA, GeminiFoodAnalyzer
from app.auth import CurrentUser, current_user, get_db
from app.main import app
from app.routers import meals as meals_router

SERVER = Path(__file__).resolve().parents[1]
ROOT = SERVER.parent
USER = CurrentUser(id="11111111-2222-3333-4444-555555555555", email="t@slimlog.test")
NUTRITION_WORDS = re.compile(r"kcal|calor|칼로리|carb|protein|fat|탄수|단백|지방|gram", re.I)


def jpeg(w=1600, h=1200) -> bytes:
    out = io.BytesIO()
    Image.new("RGB", (w, h), (200, 120, 60)).save(out, format="JPEG")
    return out.getvalue()


# ── 가짜 Supabase (메모리) ──────────────────────────────────────────
class FakeDb:
    def __init__(self):
        self.t: dict[str, list[dict]] = {k: [] for k in ("foods", "consents", "ai_requests", "model_versions", "meals", "predictions")}
        self.files: dict[str, bytes] = {}

    @staticmethod
    def _ok(row: dict, k: str, v: str) -> bool:
        op, _, val = v.partition(".")
        cur = row.get(k)
        if op == "eq":
            return cur is not None and str(cur) == val
        if op == "is" and val == "null":
            return cur is None
        if op == "gte":
            return cur is not None and str(cur) >= val
        if op == "ilike":
            return cur is not None and val.strip("*").lower() in str(cur).lower()
        raise AssertionError(f"unsupported filter {k}={v}")

    def select(self, table, **params):
        limit = int(params.pop("limit", 10_000))
        params.pop("select", None)
        params.pop("order", None)
        rows = [r for r in self.t[table] if all(self._ok(r, k, v) for k, v in params.items())]
        return [dict(r) for r in rows[:limit]]

    def insert(self, table, row):
        rows = row if isinstance(row, list) else [row]
        out = []
        for r in rows:
            r = dict(r)
            if table == "predictions":
                r.setdefault("pred_id", str(uuid.uuid4()))
            r.setdefault("created_at", datetime.now(timezone.utc).isoformat())
            self.t[table].append(r)
            out.append(dict(r))
        return out

    def delete(self, table, **params):
        keep = [r for r in self.t[table] if not all(self._ok(r, k, v) for k, v in params.items())]
        gone = len(self.t[table]) - len(keep)
        self.t[table] = keep
        return [{}] * gone

    def upload(self, bucket, path, data, ct):
        self.files[path] = data

    def remove(self, bucket, paths):
        for p in paths:
            self.files.pop(p, None)


@pytest.fixture
def db():
    d = FakeDb()
    for fid, name in [("mfds-1", "쌀밥"), ("mfds-2", "김치찌개"), ("mfds-3", "배추김치"), ("mfds-4", "아메리카노"), ("mfds-5", "카페라떼"), ("mfds-6", "돼지고기김치찌개")]:
        d.t["foods"].append({"food_id": fid, "name": name, "owner_id": None})
    d.t["foods"].append({"food_id": "myfood-x", "name": "쌀밥", "owner_id": "someone"})  # 남의 음식은 매칭 대상 아님
    return d


@pytest.fixture
def api(db, monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "http://fake")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "fake")
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[current_user] = lambda: USER
    yield TestClient(app)
    app.dependency_overrides.clear()


def post_photo(c: TestClient, purpose: str | None = "meal_photo", data: bytes | None = None):
    form = {"meal_type": "lunch", "eaten_at": (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()}
    if purpose is not None:
        form["purpose"] = purpose
    return c.post("/meals/photo", files={"file": ("a.jpg", data or jpeg(), "image/jpeg")}, data=form)


# ── 가짜 Gemini ─────────────────────────────────────────────────────
def gemini_reply(payload: dict, usage=None, **extra) -> dict:
    return {"candidates": [{"content": {"parts": [{"text": "생각 중", "thought": True}, {"text": json.dumps(payload, ensure_ascii=False)}]}, "finishReason": "STOP"}],
            "usageMetadata": usage or {"promptTokenCount": 1300, "candidatesTokenCount": 120}, **extra}


class FakeGemini:
    def __init__(self, *responses):
        self.responses = list(responses)
        self.calls: list[httpx.Request] = []

    def handler(self, req: httpx.Request):
        self.calls.append(req)
        r = self.responses.pop(0)
        if isinstance(r, Exception):
            raise r
        status, body = r
        return httpx.Response(status, json=body) if isinstance(body, dict) else httpx.Response(status, text=body)

    def analyzer(self):
        return GeminiFoodAnalyzer("test-key", "gemini-test", client=httpx.Client(transport=httpx.MockTransport(self.handler)))


TWO_FOODS = {"is_food_photo": True, "foods": [
    {"name_ko": "김치찌개", "category": "korean", "servings": 1, "portion_text": "1그릇", "confidence": "high", "needs_review": False, "kcal": 999},
    {"name_ko": "흑임자라떼", "category": "cafe", "servings": 1, "portion_text": "1잔", "confidence": "medium", "needs_review": True, "reason": "처음 보는 음료"},
]}


def use_gemini(monkeypatch, fake: FakeGemini):
    monkeypatch.setenv("AI_PROVIDER", "gemini")
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(meals_router, "get_analyzer", lambda s: fake.analyzer())


# ── 정리·규격 ───────────────────────────────────────────────────────
def test_sanitize_drops_nutrition_and_fixes_values():
    ok, foods = sanitize({"is_food_photo": True, "foods": [
        {"name_ko": " 쌀밥 ", "servings": 99, "confidence": "sure", "kcal": 300, "protein_g": 5},
        {"name_ko": "쌀밥"},  # 중복
        {"name_ko": ""},
        {"name_ko": "김치", "servings": "0.5", "confidence": "high", "needs_review": False},
    ]})
    assert ok and [f.name_ko for f in foods] == ["쌀밥", "김치"]
    assert foods[0].servings == 1.0 and foods[0].confidence == "low" and foods[0].needs_review  # 이상한 값 → 1인분·확인 필요
    assert foods[1].servings == 0.5 and not foods[1].needs_review
    assert not any(NUTRITION_WORDS.search(k) for k in foods[0].__dict__)
    assert sanitize({"is_food_photo": False, "foods": [{"name_ko": "x"}]}) == (False, [])
    with pytest.raises(AnalysisError):
        sanitize(["not", "dict"])


def test_meal_photo_only_for_meal_purpose():
    with pytest.raises(ValueError):
        MealPhoto(b"x", "eyebody")
    with pytest.raises(ValueError):
        MealPhoto(b"x", "")
    MealPhoto(b"x", "meal_photo")


def test_schema_has_no_nutrition_fields():
    props = RESPONSE_SCHEMA["properties"]["foods"]["items"]["properties"]
    assert set(props) == {"name_ko", "name_en", "category", "servings", "portion_text", "confidence", "needs_review", "reason"}
    assert not any(NUTRITION_WORDS.search(k) for k in props)


# ── Gemini 호출 ─────────────────────────────────────────────────────
def test_gemini_request_sends_only_photo_and_prompt():
    fake = FakeGemini((200, gemini_reply(TWO_FOODS)))
    res = fake.analyzer().analyze(MealPhoto(jpeg(3000, 2000), "meal_photo"))
    req = fake.calls[0]
    assert req.url.path.endswith("/models/gemini-test:generateContent") and req.headers["x-goog-api-key"] == "test-key"
    assert "key=" not in str(req.url)  # 키는 주소에 넣지 않음 (로그 노출 방지)
    body = json.loads(req.content)
    parts = body["contents"][0]["parts"]
    assert {list(p)[0] for p in parts} == {"inline_data", "text"}
    sent = Image.open(io.BytesIO(__import__("base64").b64decode(parts[0]["inline_data"]["data"])))
    assert max(sent.size) <= 1024  # 줄인 사본만 보냄
    assert USER.id not in req.content.decode() and USER.email not in req.content.decode()
    assert body["generationConfig"]["responseMimeType"] == "application/json"
    assert [f.name_ko for f in res.foods] == ["김치찌개", "흑임자라떼"] and res.input_tokens == 1300 and res.output_tokens == 120


@pytest.mark.parametrize("responses,code,calls", [
    ([(429, {"error": {}})], "RATE_LIMITED", 1),
    ([(500, {}), (503, {})], "UPSTREAM", 2),
    ([(403, {})], "NOT_CONFIGURED", 1),
    ([(200, {"promptFeedback": {"blockReason": "SAFETY"}})], "BLOCKED", 1),
    ([(200, {"candidates": [{"content": {"parts": [{"text": "not json"}]}}]})], "BAD_RESPONSE", 1),
    ([httpx.ReadTimeout("t"), httpx.ReadTimeout("t")], "TIMEOUT", 2),
])
def test_gemini_errors(responses, code, calls):
    fake = FakeGemini(*responses)
    with pytest.raises(AnalysisError) as e:
        fake.analyzer().analyze(MealPhoto(jpeg(), "meal_photo"))
    assert e.value.code == code and len(fake.calls) == calls


def test_gemini_retries_once_on_server_error():
    fake = FakeGemini((500, {}), (200, gemini_reply(TWO_FOODS)))
    assert len(fake.analyzer().analyze(MealPhoto(jpeg(), "meal_photo")).foods) == 2 and len(fake.calls) == 2


# ── POST /meals/photo ──────────────────────────────────────────────
def test_purpose_required(api, db):
    for p in (None, "eyebody", "inbody", "body"):
        r = post_photo(api, p)
        assert r.status_code == 400 and r.json()["detail"]["code"] == "BAD_PURPOSE"
    assert not db.files and not db.t["meals"]


def test_mock_mode_matches_db_and_never_logs_usage(api, db, monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "gemini")
    monkeypatch.setenv("GEMINI_API_KEY", "")  # 키 없음 → 목업, 외부 전송 없음
    r = post_photo(api)
    assert r.status_code == 201, r.text
    j = r.json()
    assert j["mode"] == "mock" and j["ai_error"] is None and len(j["labels"]) == 5
    by = {l["name_raw"]: l for l in j["labels"]}
    assert by["쌀밥"]["food_id"] == "mfds-1" and by["쌀밥"]["status"] == "recognized"
    assert by["김치찌개"]["candidates"][:2] == ["mfds-2", "mfds-6"]  # 정확히 같은 이름 먼저
    assert by["시금치나물"]["food_id"] is None and by["시금치나물"]["status"] == "review"  # DB 에 없음 → 영양값 없이 확인 필요
    assert "myfood-x" not in sum((l["candidates"] for l in j["labels"]), [])
    assert not db.t["ai_requests"]
    assert db.t["meals"][0]["status"] == "draft" and len(db.t["predictions"]) == 5
    assert all(p["predicted_name"] for p in db.t["predictions"])


def test_gemini_needs_consent(api, db, monkeypatch):
    fake = FakeGemini()
    use_gemini(monkeypatch, fake)
    r = post_photo(api)
    assert r.status_code == 403 and r.json()["detail"]["code"] == "NO_FOOD_AI_CONSENT"
    db.t["consents"].append({"user_id": USER.id, "type": "food_ai", "withdrawn_at": "2026-01-01T00:00:00+00:00"})  # 철회한 동의
    assert post_photo(api).status_code == 403
    assert not fake.calls and not db.files


def consent(db):
    db.t["consents"].append({"user_id": USER.id, "type": "food_ai", "withdrawn_at": None})


def test_gemini_daily_limit_10(api, db, monkeypatch):
    consent(db)
    fake = FakeGemini(*[(200, gemini_reply(TWO_FOODS))] * 10)
    use_gemini(monkeypatch, fake)
    db.t["ai_requests"].append({"user_id": USER.id, "provider": "gemini", "created_at": (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()})  # 지난 기록은 안 셈
    for _ in range(10):
        assert post_photo(api).status_code == 201
    r = post_photo(api)
    assert r.status_code == 429 and r.json()["detail"]["code"] == "DAILY_LIMIT"
    assert len(fake.calls) == 10 and len(db.files) == 10  # 11번째는 사진도 안 받음


def test_gemini_success_logs_tokens_and_uses_db_names(api, db, monkeypatch):
    consent(db)
    fake = FakeGemini((200, gemini_reply(TWO_FOODS)))
    use_gemini(monkeypatch, fake)
    j = post_photo(api).json()
    assert j["mode"] == "model" and j["model_version"] == "gemini:gemini-test"
    stew, latte = j["labels"]
    assert stew["food_id"] == "mfds-2" and stew["status"] == "recognized" and stew["servings"] == 1
    assert latte["food_id"] is None and latte["status"] == "review" and latte["reason"] == "처음 보는 음료"
    assert not any(NUTRITION_WORDS.search(k) for l in j["labels"] for k in l)  # 응답에 영양 수치 없음 (DB 에서 계산)
    log = db.t["ai_requests"][0]
    assert log["ok"] and log["input_tokens"] == 1300 and log["output_tokens"] == 120 and log["user_id"] == USER.id


def test_coffee_always_asks_user(api, db, monkeypatch):
    consent(db)
    coffee = {"is_food_photo": True, "foods": [{"name_ko": "커피", "category": "cafe", "servings": 1, "portion_text": "1잔", "confidence": "high", "needs_review": False}]}
    use_gemini(monkeypatch, FakeGemini((200, gemini_reply(coffee))))
    l = post_photo(api).json()["labels"][0]
    assert l["status"] == "review" and l["candidates"][:2] == ["mfds-4", "mfds-5"]


@pytest.mark.parametrize("reply,code", [((429, {}), "RATE_LIMITED"), ((200, gemini_reply({"is_food_photo": False, "foods": []})), "NOT_FOOD")])
def test_ai_failure_keeps_photo_for_manual_entry(api, db, monkeypatch, reply, code):
    consent(db)
    use_gemini(monkeypatch, FakeGemini(reply))
    r = post_photo(api)
    assert r.status_code == 201
    j = r.json()
    assert j["labels"] == [] and j["ai_error"]["code"] == code
    assert db.t["meals"][0]["status"] == "draft" and len(db.files) == 1  # 사진·초안은 남김 → 직접 입력
    assert len(db.t["ai_requests"]) == 1


def test_health_never_shows_key(api, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "secret-key-123")
    r = api.get("/health")
    assert r.json()["ai_provider"] == "gemini" and "secret-key-123" not in r.text


# ── 사용 범위 지키기 (코드 검사) ─────────────────────────────────────
def _py_files():
    return [p for p in (SERVER / "app").rglob("*.py")]


def test_gemini_api_only_in_one_file():
    hits = [p.relative_to(SERVER).as_posix() for p in _py_files() if "generativelanguage" in p.read_text(encoding="utf-8")]
    assert hits == ["app/ai/gemini_food.py"]
    key_hits = sorted(p.relative_to(SERVER).as_posix() for p in _py_files() if "GEMINI_API_KEY" in p.read_text(encoding="utf-8"))
    assert key_hits == ["app/ai/gemini_food.py", "app/config.py"]  # gemini_food 은 설명 주석


def test_ai_module_used_only_by_meal_photo():
    users = sorted(
        p.relative_to(SERVER).as_posix() for p in _py_files()
        if not p.is_relative_to(SERVER / "app" / "ai") and re.search(r"from \.\.?ai\b|from \.\.ai\.|app\.ai", p.read_text(encoding="utf-8"))
    )
    assert users == ["app/routers/core.py", "app/routers/meals.py"]
    assert "get_analyzer" not in (SERVER / "app/routers/core.py").read_text(encoding="utf-8")  # health 는 종류만 확인


def test_no_general_ai_endpoint():
    paths = {r.path for r in app.routes}
    assert not [p for p in paths if re.search(r"ai|analy|gemini|vision|recogn|predict", p, re.I)]
    spec = app.openapi()
    uploads = sorted(
        path for path, ops in spec["paths"].items() for op in ops.values()
        if "multipart/form-data" in (op.get("requestBody") or {}).get("content", {})
    )
    assert uploads == ["/meals/photo"]  # 사진(파일)을 받는 경로는 식단 사진 하나뿐


def test_frontend_never_calls_gemini_and_eyebody_stays_local():
    src = ROOT / "src"
    for p in src.rglob("*.ts*"):
        t = p.read_text(encoding="utf-8")
        assert not re.search(r"generativelanguage|@google/genai|@google/generative-ai|GEMINI_API_KEY|VITE_GEMINI", t), p
    eyebody = [ROOT / "src/lib/eyebodyVault.ts", *(ROOT / "src/features/record/eyebody").rglob("*.tsx"), ROOT / "src/features/my/EyebodyDataPage.tsx"]
    for p in eyebody:
        t = p.read_text(encoding="utf-8")
        assert "@/lib/api" not in t and "/meals/photo" not in t and "fetch(" not in t, p


def test_base_module_documents_scope():
    assert "눈바디" in (Path(ai_base.__file__)).read_text(encoding="utf-8")
