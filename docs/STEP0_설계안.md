# SlimLog v2.0 — STEP 0 설계안 (초안)

> 작성일: 2026-11-03 · 발표일: 2026-12-01 (남은 기간 약 4주)
>
> **주의:** 계획서 `SlimLog_졸업작품_최종개발계획서_v2.0_1.docx`와 아이콘 참고 이미지가
> 이 세션에 첨부되지 않았습니다. 이 문서는 **지시서 본문만 기준**으로 작성했습니다.
> 계획서를 `docs/` 폴더에 올려주면 P0/P1 우선순위, 화면명, 데이터 항목을 대조해 수정합니다.
> 계획서 확인이 필요한 부분은 `[계획서 확인]`으로 표시했습니다.

---

## 1. 핵심 요구사항 (지시서 기준)

| 구분 | 내용 |
|---|---|
| 서비스 | GLP-1 계열 약물(마운자로·위고비·에페) 사용자의 투약·식단·체성분·증상 통합 기록 |
| 구조 | 홈 · 기록 · 분석 · 커뮤니티 · 마이 **5탭** |
| 이번 단계 | 실제 React 코드로 된 **인터랙티브 목업** (백엔드·AI 없음) |
| 데이터 | 전부 `fixtures` 가상 데이터, 화면에 "예시 데이터" 배지 표시 |
| 약물 그래프 | 반감기 기반 **상대값**만. 고정 문구: "참고용 계산값이며 실제 혈중농도 또는 약효를 의미하지 않습니다." |
| 눈바디 | 사진 서버 전송 금지. 암호화는 이번 단계 **미구현 → "준비 중"으로 정직하게 표시** |
| 커뮤니티 | 판매·양도·용량 권유 차단. 안전검사 LOW / REVIEW / BLOCKED 상태 UI + 관리자 검토 화면 |
| 금지 | 진단·용량 추천, 가짜 AI 정확도 수치, 실제 DB 연결된 척, 이모지 아이콘 |
| 우선순위 | `[계획서 확인]` P0/P1/P2 구분은 계획서 기준으로 맞춤 |

---

## 2. 사이트맵 (라우트)

```
/                     → 로그인 여부에 따라 /home 또는 /login
├─ 공통
│  /login             로그인
│  /signup            회원가입
│  /consent           개인정보·민감정보 동의
│  /onboarding        온보딩 (약물·목표 설정, 3스텝)
│  *                  404
│
├─ 홈  /home
│     인사말·날짜 / 현재 체중·변화 / 식단 요약 / 단백질·수분
│     최근 투약 / 다음 예정 투약일(사용자 기록 기준) / 컨디션
│     주간 기록 현황 / 빠른 기록 / 타임라인 미리보기
│
├─ 기록  /record              기록 허브 (7개 메뉴 카드)
│  /record/medication         투약 목록
│  /record/medication/new     투약 입력
│  /record/medication/:id     상세·수정
│  /record/meal               식단 목록
│  /record/meal/new           사진 업로드 → 분석 중 → Top-1/Top-3 → 수정·인분 → 확정
│  /record/body               체중·체성분 입력·목록
│  /record/inbody             OCR: 업로드 → 인식 결과(의심 항목 강조) → 수정 → 최종 확인
│                             (실패 시 /record/body 수동 입력으로 전환)
│  /record/eyebody            눈바디: 로컬 저장 안내 / 비밀번호 UI / 날짜별 목록
│  /record/eyebody/compare    Before/After 슬라이더
│  /record/symptom            증상 선택·강도·컨디션·날짜별 목록
│  /record/daily              물·단백질·영양제
│
├─ 분석  /analysis            요약 + 기간 필터 (1주/1개월/3개월/전체)
│  /analysis/weight           체중·체성분 그래프
│  /analysis/medication       참고용 잔존량 곡선 + 투약일 마커 + 출처·계산 방식 안내
│  /analysis/symptom          증상 ↔ 그래프 비교
│  /analysis/nutrition        식단·영양 추이
│  /analysis/timeline         통합 타임라인
│  /analysis/body             바디 변화 통합 (체성분 + 눈바디)
│  /analysis/consult          상담 준비 (진료 때 보여줄 요약)
│
├─ 커뮤니티  /community        목록 + 카테고리 탭
│  /community/:id             상세·댓글·좋아요·신고·수정·삭제
│  /community/write           글쓰기 + 안전검사 결과 안내
│  /admin/moderation          관리자 검토 (REVIEW/BLOCKED 큐)
│
└─ 마이  /my
   /my/profile                프로필
   /my/consent                동의 관리
   /my/settings               기록 설정·알림 설정
   /my/eyebody-data           눈바디 로컬 데이터 관리
   /my/account                계정 관리·로그아웃·탈퇴
```

공통 상태 컴포넌트(모든 화면에서 재사용): 로딩 / 데이터 없음 / 오류 / 삭제 확인 모달 / 저장 성공·실패 토스트

---

## 3. 폴더 구조

```
slimlog/
├─ docs/                      계획서·설계 문서
├─ public/                    PWA 아이콘, manifest (추후)
├─ src/
│  ├─ app/                    router.tsx, App.tsx, providers
│  ├─ components/
│  │  ├─ ui/                  shadcn/ui (Button, Card, Dialog, Input, Tabs, Sheet, Slider, Toast…)
│  │  ├─ common/              AppIcon, PageHeader, MockBadge, EmptyState, ErrorState,
│  │  │                       LoadingState, ConfirmDialog, StatCard, SectionTitle, Disclaimer
│  │  ├─ layout/              AppLayout, BottomTabBar(모바일), Sidebar(768px+)
│  │  └─ charts/              WeightChart, MedicationLevelChart 등 (Recharts 래퍼)
│  ├─ features/               화면 단위 폴더
│  │  ├─ home/
│  │  ├─ record/              medication/, meal/, body/, inbody/, eyebody/, symptom/, daily/
│  │  ├─ analysis/
│  │  ├─ community/
│  │  ├─ my/
│  │  └─ auth/                login, signup, consent, onboarding
│  ├─ fixtures/               가상 데이터 (*.mock.ts) — 전부 여기에만
│  ├─ services/               API 자리. 지금은 fixtures 반환하는 mock 구현
│  │                          → 나중에 FastAPI/Supabase로 이 폴더만 교체
│  ├─ stores/                 Zustand (토스트, 임시 입력 상태 정도만)
│  ├─ types/                  도메인 타입 (Medication, Meal, BodyRecord, Post…)
│  ├─ lib/                    utils, date 포맷, cn()
│  └─ styles/                 globals.css (디자인 토큰)
├─ tests/e2e/                 Playwright (390 / 768 / 1440)
└─ package.json
```

**API 교체 전략:** 화면 → `services/xxx.ts` → (지금) fixtures / (나중) fetch.
화면은 services 함수만 부르니까, 백엔드 붙일 때 UI는 거의 안 건드립니다.

---

## 4. 설치할 패키지

| 패키지 | 이유 |
|---|---|
| react, react-dom, typescript, vite | 기본 (지시서 필수) |
| tailwindcss v4 + @tailwindcss/vite | 스타일·디자인 토큰 |
| shadcn/ui (CLI로 필요한 것만 복사) + radix-ui, class-variance-authority, clsx, tailwind-merge | 모달·탭·시트 등 접근성 갖춘 기본 부품 |
| lucide-react | 아이콘 (이모지 금지 규칙) |
| react-router (v7) | 라우팅 |
| recharts | 그래프 |
| zustand | 토스트·임시 상태 (최소 범위) |
| pretendard | 한글 폰트 (CDN 대신 패키지로 → 오프라인/PWA 유리) |
| sonner | 저장 성공·실패 토스트 (shadcn 기본 토스트) |
| @playwright/test, eslint, typescript-eslint | 검증 |

**안 넣는 것:** 상태관리 대형 라이브러리(Redux), 폼 라이브러리(목업엔 과함), 애니메이션 라이브러리, 백엔드 SDK(Supabase는 연동 단계에서).
날짜 처리는 `Intl` + 작은 유틸로 해결 — date 라이브러리 필요해지면 그때 보고 후 추가.

---

## 5. UI 디자인 시스템

### 색상 토큰 (`src/styles/globals.css`)
| 토큰 | 값 | 용도 |
|---|---|---|
| `--primary` | `#0F9F6E` (Emerald 600 근처, 살짝 차분하게) | 주요 버튼·활성 아이콘 |
| `--primary-soft` | `#E7F6EF` | 아이콘 배경·선택 상태 |
| `--background` | `#F7F8F6` | 앱 배경 (Off-white) |
| `--surface` | `#FFFFFF` | 카드 |
| `--text` | `#1E293B` (Slate 800) | 본문 |
| `--text-muted` | `#64748B` (Slate 500) | 보조 텍스트·비활성 아이콘 |
| `--border` | `#E5E7EB` | 구분선 |
| `--success` | `#16A34A` | 정상·LOW |
| `--review` | `#D97706` (Amber) | 참고·REVIEW·OCR 의심 항목 |
| `--danger` | `#DC2626` | 오류·BLOCKED·삭제 |

다크모드는 토큰만 미리 정의하고 화면 적용은 승인 후 결정.

### 타이포 (Pretendard)
- 큰 숫자(체중 등): 32px / Bold — 숫자가 제일 먼저 눈에 들어오게
- 화면 제목: 20px / Bold · 카드 제목: 16px / SemiBold
- 본문: 15px / Regular · 보조: 13px / Medium

### 레이아웃
- 모바일 기본 폭 390px, 좌우 여백 20px, 카드 간격 12px, 카드 모서리 16px
- 그림자 거의 없음 (1px 테두리 + 아주 옅은 shadow 1단계만)
- 터치 영역 최소 44×44px, 주요 버튼은 화면 하단 고정(한 손 조작)
- 768px 이상: 좌측 사이드바(240px) + 본문 최대폭 960px, 카드 2~3열 그리드

### 아이콘 규칙 — `AppIcon` 컴포넌트
```tsx
<AppIcon icon={Syringe} size="md" tone="primary" withBg />
```
- `strokeWidth` 1.75 고정, size: sm 20 / md 22 / lg 24
- tone: `primary`(Emerald) / `muted`(Slate, 비활성) / `review` / `danger`
- withBg: 연녹색(`--primary-soft`) 또는 연회색 원형/라운드 배경
- 이모지 사용 금지 → ESLint 규칙 + Playwright에서 화면 텍스트 이모지 검사로 강제

| 메뉴 | Lucide 아이콘 |
|---|---|
| 홈 / 기록 / 분석 / 커뮤니티 / 마이 | `House` / `SquarePen` / `ChartLine` / `MessagesSquare` / `UserRound` |
| 투약 | `Syringe` |
| 식단 | `Utensils` |
| 체중·체성분 | `Scale` |
| 인바디 OCR | `ScanText` |
| 눈바디 | `Camera` (+ 잠금 안내 `LockKeyhole`) |
| 증상·컨디션 | `Activity` |
| 물·단백질·영양제 | `GlassWater` / `Beef` / `Pill` |
| 타임라인 / 상담 준비 | `ListTree` / `ClipboardList` |
| 신고 / 안전검사 | `Flag` / `ShieldCheck` |

### 정직성 표시 규칙
- 모든 가상 데이터 카드에 `예시 데이터` 배지 (MockBadge)
- 식단 AI 결과: "목업 화면 — 실제 AI 분석 아님" 표시, 신뢰도는 숫자 대신 "높음/낮음" 상태로만 (가짜 % 금지)
- 약물 곡선: 고정 문구 + 출처·계산방식 접이식 안내 + "예시 데이터" 배지
- 눈바디 암호화: "암호화 저장 — 개발 예정" 표시, 완성된 척 금지

---

## 6. 구현 순서

| 단계 | 내용 | 승인 |
|---|---|---|
| **STEP 1** | Vite 프로젝트, 토큰, AppIcon, 레이아웃(하단탭/사이드바), 공통 컴포넌트 | |
| **STEP 1.5** | 대표 화면 3개: **홈 / 기록 허브 + 투약 입력 / 분석(체중 + 참고용 약물 곡선)** → 미리보기 제공 | **← 1차 디자인 승인** |
| STEP 2 | 커뮤니티 · 마이 탭 | |
| STEP 3 | 세부 화면: 식단 AI, 체성분, OCR, 눈바디, 증상, 물·단백질, 타임라인, 상담 준비, 관리자, 공통(로그인·동의·온보딩·404 등) | |
| STEP 4 | Playwright 390/768/1440 검증 (가로스크롤·잘림·겹침·내비게이션·이모지 검사) | |

미리보기: 클라우드 세션이라 외부 URL을 바로 줄 수 없어서, **① Playwright 스크린샷(모바일/PC) 공유 + ② 로컬 실행 명령(`npm install && npm run dev`)** 으로 제공.
원하면 GitHub Pages / Vercel 배포 설정도 추가 가능(승인 필요).

---

## 7. 기존 프로젝트 충돌 가능성

- 저장소 `slimlog`는 **커밋 0개, 파일 없음** → 덮어쓸 기존 코드 없음, 충돌 없음.
- Node 22 / npm 10 환경, npm 레지스트리 접근 확인됨.
- 주의할 점: Tailwind **v4**는 v3와 설정 방식이 다름(설정 파일 대신 CSS `@theme`). shadcn/ui 최신 CLI는 v4 지원하므로 v4로 통일.
- 확인 필요: 계획서에 다른 프론트 기술(예: Next.js)이 적혀 있다면 알려주세요 — 지시서 기준 Vite로 진행 예정.
