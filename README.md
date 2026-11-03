# 슬림로그 SlimLog — UI 목업

GLP-1 주사(마운자로·위고비·에페) 사용자의 투약·식단·체성분·증상 기록을 하나의 날짜축에서 보는 웹 플랫폼.
**현재 단계: 인터랙티브 UI 목업** — 모든 값은 `src/fixtures`의 예시 데이터이며 서버·AI는 연결되어 있지 않습니다.

## 실행

```bash
npm install
npm run dev          # http://localhost:5173
```

## 검사

```bash
npm run typecheck
npm run lint
npm run test:e2e     # Playwright: 390 / 768 / 1440px
```

클라우드 컨테이너처럼 Chromium이 따로 설치된 환경에서는 `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:e2e`.
로컬에서 처음 실행할 때는 `npx playwright install chromium`이 필요합니다.

## 구조

| 폴더 | 역할 |
|---|---|
| `src/app` | 라우터, 5탭 메뉴 정의 |
| `src/components/ui` | shadcn/ui 방식 기본 부품 (Button, Card, Dialog…) |
| `src/components/common` | `AppIcon`, `MockBadge`, `Notice`, 상태 화면 등 공통 부품 |
| `src/components/layout` | 하단 탭(<768) · 아이콘 레일(768~1023) · 사이드바(≥1024) |
| `src/components/charts` | Recharts 래퍼 (체중, 참고용 잔존량 곡선) |
| `src/features/*` | 화면 단위 코드 |
| `src/fixtures` | 예시 데이터 (여기에만 둠) |
| `src/services` | API 자리 — 지금은 fixtures 반환, 연결 시 이 폴더만 교체 |
| `src/types/domain.ts` | ERD·API 이름 기준 타입 |

설계 문서: [`docs/STEP0_설계안.md`](docs/STEP0_설계안.md) · 스크린샷: `docs/screenshots/`
