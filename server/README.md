# SlimLog API (FastAPI)

앱이 Supabase 에 직접 하는 일(RLS 보호)은 여기서 하지 않는다. 이 서버는 **검사 · 계산 · 파일 · 추론 · 탈퇴**만 한다.

| 메서드 · 경로 | 역할 |
|---|---|
| `GET /health` | 서버·모델 상태 (`model_status`: ready / not_loaded / mock) |
| `GET /residual-curve?med_id&from&to` | 내 투약 기록 → 참고용 상대 곡선(0~100). 반감기 출처 없는 약은 빈 곡선 |
| `POST /posts` · `PATCH /posts/{id}` · `DELETE /posts/{id}` | 금칙어 검사(BLOCKED 거절, REVIEW 비공개) → FILTER_LOGS 기록 → 저장 |
| `POST /posts/{id}/comments` · `PATCH/DELETE /comments/{id}` | 댓글 동일 |
| `POST /admin/actions` | 관리자 조치 (DB 의 users.role 로 매번 확인, 사유 필수, ADMIN_ACTIONS 기록) |
| `POST /meals/photo` | 사진 → EXIF 제거·재인코딩 → Storage → 인식 → meals(draft)·predictions |
| `DELETE /meals/{id}` | 사진 기록 삭제 (Storage 파일 → DB 행) |
| `DELETE /me` | 탈퇴 (Storage 폴더 → Auth 사용자, 나머지 cascade) |
| `POST /body-logs/ocr` | 인바디 OCR 확정값 저장 (숫자만, 2차 검증·중복 409) |
| `GET /push/public-key` | 폰 푸시 구독용 VAPID 공개키 |
| `POST /push/run` | (매시 예약 실행) 지금 '시'에 알림 켠 영양제·복용약 중 오늘 안 먹은 것 → 폰 푸시. 헤더 `X-Cron-Secret` |
| `POST /push/action` | 알림의 [먹었어요]/[건너뛰었어요] 기록 (서버 서명 1일 토큰) |

오류 형식: `{"detail": {"code", "message", "field"}}`

## 실행
```bash
python3 -m venv .venv
```
```bash
.venv/bin/pip install -r requirements.txt
```
```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_JWT_SECRET=... ALLOWED_ORIGINS=http://localhost:5173 .venv/bin/uvicorn app.main:app --port 8000
```

> 갤럭시 앱(Capacitor)은 `https://localhost` 에서 요청을 보낸다. 배포 서버의 `ALLOWED_ORIGINS` 에 웹 주소와 함께 `https://localhost` 를 꼭 넣을 것 (예: `ALLOWED_ORIGINS=https://slimlog.vercel.app,https://localhost`).

- `SUPABASE_JWT_SECRET`: HS256 프로젝트(로컬 Supabase 등)만 필요. 신형 프로젝트는 JWKS 로 자동 검증
- `FOOD_MODEL_PATH`: ONNX 모델 경로 (같은 이름의 `.json` 에 classes·thresholds·mean·std). 없으면 목업 모드

## 테스트 (로컬 Supabase 필요: `npx supabase start`)
```bash
.venv/bin/python -m pytest -q tests
```

## 보안
- service_role 키는 이 서버 환경변수에만. 브라우저·저장소에 넣지 않는다
- service_role 은 RLS 를 우회하므로 모든 엔드포인트가 토큰의 사용자 id 로 소유권을 직접 확인한다

## 폰 푸시 설정 (배포할 때)
1. 키 만들기: `.venv/bin/python scripts/gen_vapid.py` → 출력된 두 줄을 서버 환경변수에
2. 서버 환경변수: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:본인메일`, `CRON_SECRET=아무 긴 값`, `PUBLIC_API_URL=https://서버주소`, `PUBLIC_APP_URL=https://앱주소`
3. 예약 실행 둘 중 하나
   - 서버가 직접: `ENABLE_PUSH_SCHEDULER=1` (서버가 잠들지 않는 요금제일 때)
   - 바깥에서 매시 5분: `curl -X POST https://서버주소/push/run -H "X-Cron-Secret: …"` (Render Cron Job · GitHub Actions schedule 등)
4. 아이폰: Safari → 공유 → **홈 화면에 추가**한 앱에서만 알림 받기 가능 (iOS 16.4+)
