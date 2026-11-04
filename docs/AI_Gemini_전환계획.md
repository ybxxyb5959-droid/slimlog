# SlimLog AI 음식 인식 — Gemini API 전환 계획

작성일: 2026-11-04 · 발표일: 2026-12-01 · 상태: **승인 대기 (코드·DB 변경 없음)**

> 기존 문서는 지우지 않고 보존한다: `docs/AI_YOLO_설계안.md`, `docs/AI_Hub_242_점검_및_문의.md`, `docs/AI_0단계_데이터_점검.md`, `ai/` 폴더 전체.
> 이 문서가 AI 음식 인식의 **최신 계획**이다. 위 문서들은 "보류"로 본다.

표시: 👤 사용자 · 🤖 Claude Code · ⚠️ 확인 필요(공식 자료를 이 환경에서 못 열어 봄)

---

## 1. 보류할 작업 (삭제 X, 우선순위에서만 뺌)

| 작업 | 관련 파일 | 처리 |
|---|---|---|
| AI Hub 242 다운로드·라벨 점검 | `ai/tools/windows/`, `ai/scripts/inspect_labels.py` | 보류. 도구는 보존 |
| AI Hub Colab 사용 문의 | `docs/AI_Hub_242_점검_및_문의.md` ② | 보낼 필요 없음 (이미 보냈으면 그대로 둠) |
| YOLO 변환·분할·Colab 노트북·학습·mAP 평가 | (아직 코드 없음) | 보류 |
| EfficientNet 학습·ONNX 변환 | `ai/train/` | 보류. 코드 보존 |
| ONNX 추론기 | `server/app/recognizer.py` | 보존. 새 구조에서 "교체 가능한 엔진 중 하나"로 남김 |
| DB 010 초안 (mAP 칸, bbox 칸, task='detection') | YOLO 설계안 3.5 | **폐기 대상 초안** (실행된 적 없음). 아래 5장의 새 초안으로 대체 |
| 박스 표시 UI, 신뢰도 기준값 검증 | YOLO 설계안 3.6 | 박스 표시는 빠짐. 신뢰도 3단계 표시는 유지 (Gemini 응답 기준) |
| 직접 찍은 100장 평가셋 | | **형태만 바꿔 유지 추천 (P1)**: 박스 없이 "사진별 음식 이름 정답"만 적어서 Gemini 정확도 측정 → 발표 자료용 |

---

## 2. Gemini 방식으로 필요한 작업

| # | 작업 | 담당 |
|---|---|---|
| 1 | Google AI Studio에서 API 키 발급, 결제 연결 여부 결정(8장) | 👤 |
| 2 | 서버 환경변수 `GEMINI_API_KEY`, `GEMINI_MODEL`, `AI_PROVIDER` 설정 | 👤 (값 입력) / 🤖 (설정 코드) |
| 3 | **AI 분석 모듈 분리**: `server/app/ai/` — 공통 인터페이스 + Gemini 구현 + 목업 구현 (+ 기존 ONNX) | 🤖 |
| 4 | 프롬프트 + **응답 JSON 스키마**(구조화 출력) | 🤖 |
| 5 | 음식명 → 영양 DB 매칭 (별칭 사전 → 정확히 일치 → 비슷한 이름 후보) | 🤖 |
| 6 | 분량 처리: AI는 "1공기, 0.5인분" 같은 **인분 수**만 추정 → g은 DB 기본 제공량 × 인분 | 🤖 |
| 7 | 이미지 크기 제한, 사용자별 요청 횟수 제한, 하루 전체 상한, 타임아웃·재시도·오류 처리 | 🤖 |
| 8 | 사용량·비용 기록 (요청 수, 토큰 수, 실패 사유) | 🤖 |
| 9 | 화면: 3단계 신뢰도, "DB에 없는 음식" 처리, "추정값" 문구, **외부 AI 전송 안내** | 🤖 |
| 10 | 식약처 영양 DB를 Supabase `foods`에 넣기 | 👤 CSV 다운로드 / 🤖 변환 SQL |
| 11 | 개인정보처리방침에 "음식 사진 → Google 전송(국외)" 추가 | 👤 문구 확정 / 🤖 초안 |
| 12 | 서버 배포 (Render 등) | 👤 계정 / 🤖 설정 |

---

## 3. 재사용할 기존 코드

| 기존 | 위치 | 재사용 방법 |
|---|---|---|
| 사진 정리 (이미지 검사, **EXIF 위치정보 제거**, 1600px 축소) | `server/app/images.py` | 그대로. Gemini엔 여기서 더 줄인 사본(긴 변 1024px 정도)만 보냄 → 비용↓ |
| 사진 업로드 → Storage 저장 → 초안 식사 → 인식 결과 저장 | `server/app/routers/meals.py` `POST /meals/photo` | **경로·흐름 유지**, 인식 엔진만 교체 |
| 로그인 확인(JWT), 오류 형식 `{code,message,field}` | `server/app/auth.py`, `errors.py`, `src/lib/api.ts` | 그대로 |
| 목업 결과 (키 없을 때 시연용) | `recognizer.py` `MOCK_LABELS`, `src/services/mealAi.ts` | 그대로. 화면에 "목업" 표시도 유지 |
| 검토 화면: 후보 고르기·제외·직접 추가·섭취량 변경·영양 재계산·저장 | `src/features/meal/MealReviewPage.tsx`, `mealParts.tsx` | **거의 그대로** |
| 음식 검색·직접 등록 | `FoodSearchPage`, `CustomFoodPage`, `services/foodCatalog.ts`, `live/meals.ts` | 매칭 실패 시 그대로 사용 |
| 식약처 CSV → foods 변환 | `scripts/foods/import_foods.py` | 그대로 |
| 테이블 `meals`·`meal_items`·`predictions`·`foods`·`model_versions`, 비공개 버킷 `meal-photos` | `supabase/migrations/` | 유지, 칸 몇 개만 추가 (5장) |
| 식단 분석 (칼로리·탄단지) | `src/features/analysis/NutritionPage.tsx` | 수정 불필요 (`meal_items` 기준) |
| 사진 기록 삭제 (파일+DB 같이) | `DELETE /meals/{id}` | 그대로 |
| 눈바디 로컬 암호화 | `src/lib/eyebodyVault.ts` | **손대지 않음** (6장) |

---

## 4. FastAPI 엔드포인트

| 메서드 | 경로 | 변경 | 내용 |
|---|---|---|---|
| POST | `/meals/photo` | **수정** (경로·기존 필드 유지, 필드 추가) | 사진 저장 → AI 분석 → 매칭 → 초안 식사 + 결과 반환. AI 실패해도 **사진·초안은 남기고** `labels: []`, `ai_error` 코드 반환 → 화면에서 바로 직접 입력 |
| GET | `/health` | 수정 | `ai_provider`(gemini/mock), `ai_status`(ready/no_key) 추가. 키 값은 절대 안 보냄 |
| GET | `/admin/ai-usage` | 신규 (P1) | 오늘·이번 달 요청 수, 실패 수, 토큰 합, 추정 비용. 관리자만 |
| POST | `/meals/{meal_id}/reanalyze` | 신규 (P2) | 같은 사진 다시 분석 (횟수 제한 포함) |

**일부러 만들지 않는 것:** "아무 사진이나 받아서 AI로 보내는" 범용 엔드포인트. AI 호출은 **식단 사진 경로 안에서만** → 눈바디 등 다른 사진이 실수로 갈 길 자체를 막음.

**`/meals/photo` 응답 (추가 필드 예시, 값은 예시)**
```json
{ "meal_id": "...", "mode": "model", "model_version": "gemini:<모델ID>",
  "labels": [
    { "pred_id": "...", "food_id": "mfds-D101-...", "name_raw": "김치찌개",
      "status": "recognized", "confidence": "high", "needs_review": false,
      "servings": 1, "portion_text": "1그릇", "reason": null,
      "candidates": ["mfds-...", "mfds-..."] },
    { "pred_id": "...", "food_id": null, "name_raw": "흑임자 라떼",
      "status": "review", "confidence": "low", "needs_review": true,
      "servings": 1, "portion_text": "1잔", "reason": "DB에 없는 음식", "candidates": [] } ],
  "ai_error": null }
```

**Gemini에게 받을 JSON 모양 (구조화 출력 스키마 초안)**
```json
{ "foods": [ { "name_ko": "김치찌개", "name_en": "kimchi stew", "category": "korean|western|fastfood|cafe|other",
               "servings": 1.0, "portion_text": "1그릇", "confidence": "high|medium|low",
               "needs_review": false, "reason": "" } ],
  "is_food_photo": true }
```
- 영양값(칼로리 등)은 **Gemini에게 묻지 않음** → DB 값만 씀 (요구사항 6)
- `is_food_photo: false`면 "음식 사진이 아닌 것 같아요" 안내

---

## 5. Supabase DB · Storage

**Storage: 변경 없음.** `meal-photos` 비공개, 본인 폴더만 읽기 그대로. 눈바디용 버킷은 만들지 않음.

**DB: 최소 변경 초안 (실행 안 함, 승인 후 파일만 작성 → 👤 SQL Editor 실행)**
```sql
-- 010_gemini_food_ai (초안)
-- (1) predictions: DB에 없는 음식도 기록할 수 있게
alter table public.predictions alter column predicted_food_id drop not null;
alter table public.predictions
  add column predicted_name text check (char_length(predicted_name) <= 60),  -- AI가 말한 이름 그대로
  add column servings     numeric(4,2) check (servings > 0 and servings <= 20),
  add column portion_text text check (char_length(portion_text) <= 30),
  add column confidence   text check (confidence in ('high', 'medium', 'low')),
  add column needs_review boolean;
alter table public.predictions add constraint predictions_food_or_name
  check (predicted_food_id is not null or predicted_name is not null);

-- (2) AI 요청 기록: 횟수 제한 + 비용 모니터링 (서버만 읽고 씀, 사진·응답 원문 저장 안 함)
create table public.ai_requests (
  req_id        uuid primary key default gen_random_uuid(),
  user_id       uuid references public.users(user_id) on delete set null,
  provider      text not null,           -- 'gemini' | 'mock'
  model         text not null,
  ok            boolean not null,
  error_code    text,
  input_tokens  integer,
  output_tokens integer,
  latency_ms    integer,
  created_at    timestamptz not null default now()
);
create index ai_requests_user_day_idx on public.ai_requests (user_id, created_at desc);
alter table public.ai_requests enable row level security;   -- 정책 없음 = 앱에서 접근 불가, 서버(service_role)만

-- (3) 동의 종류에 '음식 사진 외부 AI 분석' 추가 (8장 결정에 따라)
alter table public.consents drop constraint consents_type_check;
alter table public.consents add constraint consents_type_check
  check (type in ('terms', 'privacy', 'sensitive', 'photo_improve', 'marketing', 'food_ai'));
```

**영향 범위**
| 대상 | 영향 |
|---|---|
| 기존 데이터 | **삭제·변경 없음.** 새 칸은 비어 있는 채로 추가 |
| `predictions` 기존 행 | 그대로 유효 (food_id 있음 → 새 조건 통과) |
| `model_feedback` 뷰 | 컬럼 목록을 직접 적은 뷰라 영향 없음 (새 칸은 안 보일 뿐) |
| 앱 코드 타입 | `src/types/database.ts` 재생성 필요 |
| RLS 테스트 | `ai_requests` 접근 차단 테스트 추가 |
| `model_versions` | 변경 없음. Gemini는 `model_ver_id='gemini:<모델ID>'`, `method='api'`, `task='multilabel'`로 기록 (가장 가까운 값) |
| 롤백 | 칸·테이블 삭제 SQL을 함께 작성 |

(3)은 8장에서 "별도 동의를 받을지"를 정한 뒤에만 넣음.

---

## 6. 눈바디와의 분리 (절대 규칙)

| 항목 | 음식 사진 | 눈바디 사진 |
|---|---|---|
| 저장 위치 | Supabase Storage (비공개, EXIF 제거) | **이 기기 IndexedDB (암호화)** — 지금 그대로 |
| 서버 전송 | 분석 요청 시만 | **없음** |
| Gemini·외부 AI | 사용자가 "분석" 누를 때만 | **절대 없음** |

- 현재 코드 확인: 눈바디는 `src/lib/eyebodyVault.ts`(기기 안 암호화)에서만 다룸. 서버 API 호출 없음
- 지킬 장치 (🤖): AI 모듈은 `meals.py`에서만 부름 / 범용 AI 엔드포인트 없음 / 테스트로 "눈바디 관련 서버 경로가 없음"을 검사 / 눈바디 코드엔 `api()` 호출을 넣지 않는다는 규칙을 `docs`에 명시

---

## 7. 영양성분 DB 연동

1. 👤 공공데이터포털 「전국통합식품영양성분정보(음식)표준데이터」 CSV 다운로드
2. 🤖 `import_foods.py`로 미리보기 → SQL 생성 → 👤 SQL Editor 실행 (`food_id = 'mfds-식품코드'`, 출처 칸 기록, 빈 값은 null)
3. 🤖 **별칭 사전** `server/app/ai/food_aliases.json`: 자주 나오는 음식 50~100개를 DB 표준 이름에 연결
   (예: "공기밥", "흰쌀밥" → 쌀밥 / "아아" → 아메리카노). DB 변경 없이 파일로 시작
4. 매칭 순서: 별칭 → 이름 정확히 일치 → 비슷한 이름 상위 3개(후보로 보여줌) → 없음
5. **없으면 영양값을 만들지 않음** → "DB에 없는 음식" 표시 → 검색해서 고르거나 직접 등록 (기존 화면)
6. 섭취량: `g = foods.serving_g × servings`, 영양 = DB 기준값 × (g ÷ 기준 g). 화면에는 "**추정값**" 문구
7. ⚠️ 카페·패스트푸드(아메리카노, 브랜드 버거 등)가 식약처 음식 DB에 충분히 있는지 **CSV 받은 뒤 확인**. 부족하면 식약처 가공식품 DB 추가 검토

---

## 8. 비용 · 개인정보 주의사항

### 비용 (⚠️ 금액은 추정, 공식 요금표를 이 환경에서 열지 못함)
- 모델은 **Flash 계열**(빠르고 저렴) 추천. 모델 ID는 코드에 박지 않고 `GEMINI_MODEL` 환경변수로 → 바꾸기 쉬움. 구현 때 키로 사용 가능한 모델 목록을 실제 조회해서 정함
- 사진 1장 분석 = 사진 + 지시문 + 답변 → 대략 **1장에 몇 원 이하** 수준으로 예상. 발표 준비 기간 수백~천 회면 **몇천 원 안쪽** 예상 (실제 토큰 수로 다시 계산해 보고함)
- 안전장치: 사용자당 하루 20회(조정 가능) · 서버 전체 하루 상한 · 사진 1024px로 줄여 보냄 · 같은 사진 재분석 제한 · `ai_requests`에 토큰 기록 · 👤 Google Cloud **예산 알림** 설정

### 개인정보
| 주의 | 대응 |
|---|---|
| ⚠️ **무료 등급**은 Google이 입력(사진 포함)을 서비스 개선에 쓰고 사람이 볼 수 있다는 조건으로 알고 있음 (공식 약관 직접 확인 필요) | 개발·테스트는 **내 음식 사진만**. 실제 사용자 사진을 보낼 땐 **결제 연결(유료 등급)** 추천 |
| ⚠️ API 약관의 나이 제한(18세 이상 등) 여부 | 👤 약관 확인 |
| 음식 사진이 해외(Google)로 감 = **개인정보 국외 이전** | 개인정보처리방침에 받는 곳·국가·목적 명시 + 첫 분석 전 안내/동의 (5장 (3)) |
| 사진에 얼굴·영수증·위치가 찍힐 수 있음 | EXIF 제거본만 전송, 화면에 "음식만 찍어 주세요" 안내 |
| Gemini에 사용자 정보가 같이 가는 것 | 지시문에 이름·건강정보·user_id **안 넣음**. 사진만 보냄 |
| API 키 노출 | 서버 환경변수만. `VITE_`로 시작하는 프론트 변수에 넣지 않음, 저장소에 안 올림 |
| 결과 저장 | 사진은 기존 정책(본인만, 삭제 시 함께 삭제). AI 응답 원문은 저장 안 함 (필요한 칸만) |

---

## 9. 개발 순서 · 우선순위

**P0 — 12/1 시연에 꼭 필요**
| 기간 | 내용 | 👤 | 🤖 |
|---|---|---|---|
| 11/5~11/7 | 준비 | API 키 발급, 결제 여부 결정, 식약처 CSV 다운로드 | 영양 DB 변환 SQL |
| 11/7~11/12 | AI 모듈 | — | 인터페이스 + Gemini + 목업, 스키마, 오류 처리, 가짜 Gemini로 테스트 |
| 11/12~11/15 | 서버 연결 | DB 010 SQL 실행 | `/meals/photo` 연결, 매칭, 횟수 제한, 사용량 기록 |
| 11/15~11/20 | 화면 | 내 폰으로 확인 | 3단계 신뢰도, DB 없는 음식, 추정값 문구, 외부 전송 안내 |
| 11/20~11/25 | 배포·통합 테스트 | 호스팅 계정, 키 입력 | 배포 설정, 시나리오 테스트 |
| 11/26~12/1 | 발표 준비 | 연습 | 시연 시나리오, 자료용 표 |

**P1 — 시간 되면**: 직접 찍은 50~100장으로 정확도 측정(음식 이름 기준), 관리자 사용량 화면, 별칭 사전 확대
**P2 — 발표 후**: 재분석 버튼, 다른 모델 교체 실험, Capacitor 안드로이드

---

## 10. 승인 필요 (👤)

1. 이 순서대로 진행 OK?
2. DB 010 (1)(2) 진행 OK? (3) 별도 동의(`food_ai`)를 받을지, 처리방침 안내만 할지
3. 개발 중 무료 등급 + 실제 사용자 단계는 유료 등급, 이 방침 OK?
4. 사용자당 하루 분석 횟수 (추천 20회)
