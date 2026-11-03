# DB 변경 제안 (승인 전 · 아직 반영 안 함)

> 계획서 v2.0 ERD 18개 테이블 이름은 유지하고, 컬럼·테이블을 최소로 추가하는 방향이에요.
> 현재 목업은 화면 상태(zustand, localStorage)로만 동작하고 서버 DB는 건드리지 않았어요.

## 1. 온보딩 · 닉네임
| 대상 | 변경 | 이유 |
|---|---|---|
| 사용자 프로필(공개) 테이블 | `nickname` **UNIQUE** + 형식 CHECK(2~10자, 한글·영문·숫자) | 중복 금지. 저장 시 UNIQUE 위반(409)을 받아 다른 닉네임 안내 |
| 같은 테이블 | `onboarding_step`, `onboarding_completed_at` | 앱 종료 후 복귀, 완료 사용자 홈 직행 |
| 사용자 건강 정보(비공개) | `height_cm`, `goal_weight_kg` | 공개 프로필과 분리, RLS로 본인만 |
| BODY_LOGS | `is_baseline boolean` + `UNIQUE (user_id) WHERE is_baseline` | 온보딩 최초 체중이 두 번 저장되지 않게. 다시 고치면 같은 행을 UPDATE |

- 닉네임 확인 API: `GET /nicknames/{name}/availability` (형식 검사 → 중복 조회). 확인과 저장 사이의 동시 가입은 UNIQUE 제약이 최종 방어.
- RLS: 모든 행은 `auth.uid() = user_id` 일 때만 읽기·쓰기. 커뮤니티에는 닉네임만 조인.

## 2. 섭취 관리 (물 · 영양제 · 복용약)
기존 `DAILY_CHECKS.water_cups`(컵), `supplement_taken`(여부)로는 mL·여러 항목·시각을 담을 수 없어요.

| 대상 | 변경 |
|---|---|
| 신규 `INTAKE_ITEMS` | `id, user_id, kind('supplement'|'medicine'), name, active, created_at` |
| 신규 `INTAKE_LOGS` | `id, user_id, kind('water'|'supplement'|'medicine'), item_id NULL, amount_ml NULL, taken_at` |
| 기존 `DAILY_CHECKS` | 그대로 둠. 기존 컵 기록은 화면에서 `컵 × 250mL`로 환산해 보여주고, 이전(마이그레이션)은 별도 승인 후 |

- GLP-1 주사는 계속 `DOSES`에만 저장 (섭취 관리와 섞지 않음).
- 테이블 수가 18 → 20개가 되므로 계획서 ERD 갱신 필요.

## 3. 인바디
현재 `BODY_LOGS`(체중·골격근량·체지방량·체지방률, `source`, `is_verified`)와 `BODY_LOG_SOURCES`(원천 정보)로 지금 화면은 충분해요.

추가 항목(체수분, 내장지방 레벨, 부위별 근육 등)이 필요해지면:
- `BODY_LOGS`에 컬럼을 계속 늘리기보다 `BODY_LOG_METRICS(body_log_id, metric_key, value, unit)` 세로형 테이블 1개 추가를 제안.
- OCR 원본 이미지는 서버로 보내지 않는 원칙 유지 (계획서 6.4).
