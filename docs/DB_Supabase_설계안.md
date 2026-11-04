# Supabase 적용 전 최종 점검 보고서 v1.0

작성일: 2026-11-03 · 상태: **클라우드 Supabase 적용 완료 (2026-11-03)** · RLS 테스트 클라우드 45/45 통과 · Auth·Storage 통합 테스트는 클라우드 미실행

| 문서·파일 | 내용 |
|---|---|
| 이 문서 | 결정 반영 결과, 마이그레이션 계획, Storage·Auth 설계, 프론트 연결, 테스트 결과 |
| `docs/DB_동의_삭제정책.md` | 민감정보 범위, 철회·탈퇴 삭제 규칙 |
| `docs/db/ERD_v2.2_22tables.png` | 계획서용 ERD (22개) |
| `supabase/migrations/*.sql` | 실제로 적용할 SQL 4개 |
| `supabase/tests/` | RLS 테스트 45개(SQL), Auth·Storage 통합 테스트 30개(HTTP) |
| `supabase/rollback/20261103_init_down.sql` | 비상 되돌리기 |
| `supabase/config.toml` | 로컬 설정 (카카오·구글 자리 잡음, 꺼져 있음) |

---

## 1. 2026-11-03 결정 반영표

| 결정 | 반영 내용 | 확인한 테스트 |
|---|---|---|
| 1. 테이블 22개 | 22개 그대로, 더 늘리지 않음. 사진 메타데이터도 테이블을 새로 만들지 않고 `meals` 컬럼으로 넣음 | 적용 후 테이블 수 22 |
| 1. 계획서 ERD 수정 | `docs/db/ERD_v2.2_22tables.png` 새로 그림. 계획서 6.6 교체 문구는 7번 | — |
| 2. 게시글 서버 전용 | posts·comments 쓰기 권한을 앱에서 뺌 (서버만 가능) | RLS 12·13, 통합 A12 |
| 2. 관리자 권한 상승 방지 | `users`는 닉네임·온보딩 칸만 수정 허용, `role`은 못 바꿈 | RLS 09, 통합 A06 |
| 3. 민감정보 철회 | 투약·증상·체성분·복용약 삭제, 키·체중·수면·식욕·컨디션 비움, 식단 유지 | RLS 39~44, 통합 S16·S17 |
| 3. 식단 속 건강정보 검토 | 식단에 메모 칸이 없어서 증상이 섞일 자리가 없음. 메모를 추가하면 민감정보로 분류 | `DB_동의_삭제정책.md` |
| 4. 카카오+구글, Supabase Auth | `config.toml`에 두 공급자 자리 잡음 (키 없음, 꺼짐). 네이버는 추후 | 이메일 테스트 계정으로 JWT·RLS 흐름 확인 (A01~A03) |
| 5. Free 플랜 | 위험 점검 항목은 6번 | — |
| 추가 1·2. Storage 정책, 경로·메타만 DB | 비공개 버킷 + 서버 전용 업로드 + 본인 읽기만 | 통합 S01~S15 |
| 추가 3. 실제 Supabase 테스트 | **로컬 Supabase(공식 CLI, Docker)** 에서 실행. 클라우드는 적용 승인 후 | 45 + 30 통과 |
| 추가 4. 목업·API 구조 유지 | 화면은 그대로, `src/services` 안쪽만 바꾸는 방식 | 5번 |

### v0.1 이후 바뀐 것
- 동의 종류 이름을 프론트와 맞춤: `sensitive_health` → `sensitive`, `photo_improve` 추가
- 민감정보 범위 확대: 복용약, 키·체중, 수면·식욕·컨디션도 동의 필요
- 사진 기록은 서버만 만들고 서버만 지움 (Storage 파일이 주인 없이 남지 않게)
- `meals`에 사진 메타데이터 칸 추가: 경로, 형식, 크기, 가로·세로, EXIF 제거 여부
- 사진 경로는 반드시 본인 폴더(`{user_id}/…`)여야 저장됨
- 모델 점검용 뷰 `model_feedback`: `photo_improve` 동의자만 포함, 서버만 조회
- 로그인 전(anon)에는 약 기준 정보 말고는 아무것도 못 봄 (닉네임 목록도 막음)
- 초안 파일(`docs/db/supabase_schema_draft.sql`, 일반 Postgres 테스트)은 마이그레이션으로 대체돼서 삭제

---

## 2. 마이그레이션 계획

### 파일 (이 순서로 적용)
| 파일 | 내용 |
|---|---|
| `20261103000001_core_schema.sql` | 테이블 22개, 제약, 인덱스, 트리거(가입 시 프로필 생성, updated_at, 좋아요·댓글 수), 헬퍼 함수, `model_feedback` 뷰 |
| `20261103000002_rls_policies.sql` | 22개 테이블 RLS 켜기 + 정책, 컬럼 단위 수정 권한, anon 차단 |
| `20261103000003_storage.sql` | `meal-photos` 버킷 (비공개, 5MB, jpeg·webp) + 읽기 정책 |
| `20261103000004_consent_withdrawal.sql` | `withdraw_sensitive_consent()` |

### 적용 절차 (승인 후)
1. 클라우드 프로젝트 생성: **서울 리전**, Free 플랜
2. 로컬에서 연결: `npx supabase link --project-ref <ref>`
3. 미리보기: `npx supabase db push --dry-run` → 적용될 파일 4개 확인
4. 적용: `npx supabase db push`
5. 확인:
   - SQL 편집기에서 `supabase/tests/rls_test.sql` 실행 → 45개 PASS (끝에 ROLLBACK 하므로 데이터 안 남음)
   - `node supabase/tests/integration.mjs` (클라우드 URL·키) → 30개 PASS (테스트 계정·파일은 스스로 지움)
6. Auth 설정: 카카오·구글 키 등록, 리디렉트 URL 등록 (4번)
7. 결과를 보고하고, 그다음 프론트 연결 시작

### 되돌리기
- 데이터가 없는 초기 단계: `supabase/rollback/20261103_init_down.sql` 실행 + 대시보드에서 `meal-photos` 버킷 삭제
  - 로컬에서 확인함: 실행 후 테이블·함수 0개 → 다시 적용하면 테스트 전부 통과
- 데이터가 생긴 뒤: 되돌리지 않고 **새 마이그레이션으로 고침**

### 적용 전 체크리스트
- [ ] 프로젝트 리전이 서울인지
- [ ] `db push --dry-run`에 파일 4개만 나오는지
- [ ] service_role 키를 프론트 코드·저장소에 넣지 않았는지 (FastAPI 서버 환경변수에만)
- [ ] 카카오·구글 secret은 대시보드에만 입력했는지 (저장소 커밋 금지)

---

## 3. Storage 설계

| 항목 | 정책 |
|---|---|
| 버킷 | `meal-photos` **하나만**. 비공개(public = false) |
| 경로 | `{user_id}/{meal_id}.jpg` — 첫 폴더가 주인 |
| 허용 형식·크기 | `image/jpeg`, `image/webp` · 최대 5MB (버킷 설정에서 강제) |
| 업로드 | **FastAPI(service_role)만.** EXIF 제거·재인코딩 후 저장. 앱 직접 업로드는 RLS로 막힘 |
| 보기 | 앱은 본인 폴더만. 서명 URL(10분)로 표시. 공개 URL 없음 |
| 삭제 | 서버 API만. 사진 기록 삭제 = 파일 → DB 행 순서 |
| DB에 저장하는 것 | `meals.photo_path`, `photo_mime`, `photo_bytes`, `photo_width`, `photo_height`, `photo_exif_stripped` |
| 저장 안 하는 것 | 눈바디 사진, 인바디 결과지 이미지, 원본(EXIF 포함) 사진 |

DB 제약으로 막는 것:
- 사진 기록인데 경로·형식·크기가 비어 있음
- EXIF 제거가 안 된 사진
- 남의 폴더 경로
- 수동 기록에 사진 칸이 채워짐

통합 테스트로 확인한 것 (실제 Storage API):
- 앱 직접 업로드 차단, 서버 업로드 성공
- 텍스트 파일 거부, 5MB 초과 거부
- 본인 서명 URL 발급과 열기 성공
- B는 A 사진에 서명 URL을 못 받고 폴더 목록도 못 봄
- 공개 URL 차단, 로그인 전 다운로드 차단
- 앱이 직접 삭제해도 파일 그대로

---

## 4. Auth 설계 (카카오 + 구글)

| 항목 | 내용 |
|---|---|
| 방식 | Supabase Auth OAuth → 앱은 Supabase 세션(JWT) 사용 → FastAPI는 같은 JWT 검증 |
| 가입 직후 | DB 트리거가 `users`·`user_health` 행 생성 → 온보딩에서 닉네임·이름 입력 |
| 이름 | 카카오·구글 프로필 이름은 쓰지 않고 온보딩에서 직접 받음 (지금 화면 그대로) |
| 리디렉트 | 개발 `http://localhost:5173/auth/callback`, 배포 주소는 배포 때 추가 |
| 네이버 | Supabase 기본 공급자가 아님 → 추후 별도 개발 |

### 확인 필요 (적용 단계에서)
- **카카오 이메일:** 카카오는 비즈 앱 전환 전에는 이메일 동의 항목을 못 쓸 수 있음. 그러면 Supabase 로그인이 실패할 수 있음.
  - 대안 1: 카카오 개발자 콘솔에서 비즈 앱으로 전환 (개인 개발자도 가능한지 확인 필요)
  - 대안 2: Supabase 카카오 설정의 `email_optional` 켜기 (이메일 없는 계정 허용)
- **구글:** OAuth 동의 화면 "테스트" 상태에서는 등록한 테스트 사용자만 로그인됨 → 발표 시연 계정 미리 등록
- **FastAPI JWT 검증:** 새 클라우드 프로젝트는 비대칭 키(JWKS)를 쓸 수 있음 → 서버는 JWKS 주소로 검증하게 구현 (2단계)

자동화 한계: OAuth 화면은 자동 테스트가 안 됨 → 이메일 테스트 계정으로 같은 JWT·RLS 흐름을 확인. 카카오·구글 실제 로그인은 수동 체크리스트로 확인.

---

## 5. 프론트 목업·API 연결 구조 유지

- 화면(`src/features`)은 바꾸지 않는다. 데이터 접근은 이미 `src/services`, `src/stores`로 모여 있다.
- 연결 단계에서 `VITE_DATA_MODE=mock | supabase` 하나로 바꾼다. 기본은 mock → 지금 목업 시연이 그대로 됨.

| 화면 | 지금 (목업) | 연결 후 |
|---|---|---|
| 로그인·가입 동의 | `services/session.ts` | Supabase Auth + `consents` |
| 온보딩·닉네임 | `services/nickname.ts`, `profile.ts`, `onboardingStore` | `nickname_available()`, `users`, `user_health`, `body_logs`(baseline) |
| 투약·잔존 곡선 | `services/doses.ts` | `doses` 직접 · 곡선은 FastAPI `GET /residual-curve` |
| 체중·인바디 | `services/records.ts`, `mockRecordStore` | `body_logs` 직접 · OCR 확정은 FastAPI `POST /body-logs/ocr` |
| 증상·하루 체크 | `mockRecordStore` | `symptoms`, `daily_checks` 직접 |
| 섭취 관리 | `intakeStore` | `intake_items`, `intake_logs` 직접 |
| 식단 (수동) | `mealStore`, `services/foodCatalog.ts` | `meals`, `meal_items`, `foods` 직접 |
| 식단 (사진) | `services/mealAi.ts` (mock) | FastAPI `POST /meals/photo` → 서버가 Storage·`meals`·`predictions` 저장 |
| 커뮤니티 읽기·좋아요·신고 | `communityStore` | `posts`, `comments` 읽기 · `post_likes`, `reports` 직접 |
| 커뮤니티 쓰기 | `communityStore` | FastAPI `POST/PATCH/DELETE /posts` (금칙어 검사) |
| 동의 철회 | `my/ConsentPage` (목업 토스트) | `rpc('withdraw_sensitive_consent')` → 삭제 건수 표시 |

"직접" = 앱이 Supabase에 바로 접근하고 RLS가 보호함. "FastAPI" = 서버를 거쳐야 하는 것 (검사·추론·파일).

---

## 6. Free 플랜 위험 점검

| 위험 | 내용 | 대응 |
|---|---|---|
| 일시정지 | 7일 동안 요청이 없으면 프로젝트가 멈춤 | 매주 접속하기. **11/24쯤 Pro 전환 여부 최종 결정** |
| DB 용량 | 500MB | 텍스트 기록 위주라 시연 규모면 충분할 것으로 예상 (실측 필요) |
| Storage 용량 | 1GB | 사진 1장 약 0.2~0.5MB 기준 2,000장 이상 (재인코딩 후 실측 필요) |
| 백업 | Free는 자동 백업 복원이 제한적 | 발표 전 `supabase db dump`로 직접 백업 |

---

## 7. 계획서 수정 문구 (6.6 데이터 구조와 ERD)

> 그림 12 교체: `docs/db/ERD_v2.2_22tables.png`

v1의 16개 테이블 이름을 유지하고 6개를 더해 22개로 구성한다. 공개 프로필(USERS)과 비공개 건강정보(USER_HEALTH)를 나눠 행 단위 접근 통제(RLS)를 적용한다. 한 끼에 여러 음식을 담도록 식사(MEALS)와 음식(MEAL_ITEMS)을 분리하고, 사진 인식 결과(PREDICTIONS)는 사진 한 장에서 여러 줄로 저장한다. 물·영양제·복용약은 INTAKE_ITEMS·INTAKE_LOGS에 기록한다. 체중과 체성분은 BODY_LOGS 하나에 저장하고 source와 is_verified로 출처를 구분한다. 식단 사진은 Supabase Storage 비공개 버킷에 두고 DB에는 경로와 메타데이터만 저장한다. 투약·증상·체성분·복용약은 별도 동의가 있어야 저장되며 철회하면 삭제된다.

---

## 8. 테스트 결과

환경: **Supabase CLI 3.0 로컬 스택** (Postgres 17, GoTrue, PostgREST, Storage API, Kong · Docker). 클라우드와 같은 구성요소.

| 테스트 | 결과 |
|---|---|
| 처음부터 적용 (`supabase db reset`) | 마이그레이션 4개 에러 없음, 테이블 22개 |
| RLS·제약 `rls_test.sql` | **45 PASS / 0 FAIL** |
| Auth·Storage·REST `integration.mjs` | **30 PASS / 0 FAIL** |
| 되돌리기 → 다시 적용 | 테이블·함수 0개 → 재적용 후 75개 다시 통과 |

다시 돌리기:
```bash
npx supabase start
```
```bash
bash supabase/tests/run_local.sh
```

한계:
- 클라우드 프로젝트에서는 아직 안 돌림 (승인 후 2번 절차 5단계)
- 카카오·구글 실제 로그인은 키 등록 후 수동 확인
- 이 컨테이너에서는 이미지 저장소 때문에 `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io` 설정이 필요했음 (일반 PC는 필요 없음)

---

## 9. 승인 요청
1. 이 마이그레이션 4개를 클라우드 Supabase(서울, Free)에 적용해도 되는지
2. 가입 동의 화면 민감정보 문구 수정 (식단 빼고 키·복용약 넣기) — `DB_동의_삭제정책.md` 2번
3. 카카오 이메일 문제 대응: 비즈 앱 전환 / `email_optional` 중 선택 (키 발급할 때 확인)

## 10. 클라우드 적용 기록 (2026-11-03)

| 항목 | 결과 |
|---|---|
| 프로젝트 | slimlog (조직 Capstone1), Free 플랜 |
| 적용 방법 | 이 컨테이너는 네트워크 정책상 `api.supabase.com`, `*.supabase.co` 접속이 막혀 있음 → 사용자가 대시보드 SQL Editor 에 `supabase/sql_editor_적용용_합본.sql`(001~004 한 트랜잭션)을 붙여넣어 실행 |
| 적용 확인 | public 테이블 22개, RLS 켜진 테이블 22개 |
| RLS 테스트 | `supabase/tests/rls_test_sql_editor.sql` → **45 PASS / 0 FAIL** (테스트 데이터는 스스로 삭제) |
| Auth·Storage 통합 테스트 | **클라우드 미실행** — 네트워크 허용 후 `integration.mjs` 실행 필요 |
| 리전 | 대시보드에서 서울인지 사용자 확인 필요 (API 로 확인하지 못함) |

### 후속 처리
- **마이그레이션 기록 맞추기:** SQL Editor 로 넣어서 `supabase_migrations` 기록이 없음. 나중에 CLI 를 쓰기 전에
  `npx supabase migration repair --status applied 20261103000001 20261103000002 20261103000003 20261103000004` 실행
  (안 하면 `db push` 가 같은 파일을 다시 넣으려다 실패함)
- **열쇠 교체:** 작업 중 액세스 토큰·DB 비밀번호가 채팅에 노출됨 → 토큰 삭제, DB 비밀번호 재설정 필요
- **통합 테스트 30개:** 환경 네트워크에 `api.supabase.com`, `*.supabase.co`, `*.supabase.com` 허용 후 실행, 또는 사용자 PC 에서 실행

### 2026-11-04 추가 적용
- `supabase/sql_editor_적용용_005_006.sql` (약 3종 시드, 주사 부위 값 보완, `user_health.current_med_id`, 철회 함수·수정 정책 갱신) SQL Editor 로 적용
- `rls_test_sql_editor.sql` → **46 PASS / 0 FAIL** (클라우드)
- 마이그레이션 기록 맞추기(나중에 CLI 쓸 때): `npx supabase migration repair --status applied 20261103000001 20261103000002 20261103000003 20261103000004 20261104000005 20261104000006`


- 2026-11-04: `sql_editor_적용용_007.sql`(음식 검색 trigram 인덱스) 클라우드 적용 (사용자 SQL Editor)
