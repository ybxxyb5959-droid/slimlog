-- SlimLog 마이그레이션 010 (식단 사진 AI 연결) — 009 적용한 클라우드에 이어서 Run
begin;
-- SlimLog 010 · 식단 사진 AI(Gemini) 연결 (비파괴: 칸·테이블 추가, 기존 데이터 삭제·변경 없음)
-- 사용 범위: 식단 사진의 음식 이름·예상 인분만 (docs/AI_Gemini_전환계획.md 0장)

-- (1) predictions: 영양 DB에 없는 음식도 AI가 말한 이름으로 남길 수 있게
alter table public.predictions alter column predicted_food_id drop not null;
alter table public.predictions add column if not exists predicted_name text check (char_length(predicted_name) between 1 and 60);
alter table public.predictions add column if not exists servings numeric(4,2) check (servings > 0 and servings <= 20);
alter table public.predictions add column if not exists portion_text text check (char_length(portion_text) <= 30);
alter table public.predictions add column if not exists confidence text check (confidence in ('high', 'medium', 'low'));
alter table public.predictions add column if not exists needs_review boolean;
alter table public.predictions drop constraint if exists predictions_food_or_name;
alter table public.predictions add constraint predictions_food_or_name check (predicted_food_id is not null or predicted_name is not null);
comment on column public.predictions.predicted_name is 'AI가 말한 음식 이름 그대로 (영양 DB와 연결 못 해도 남김)';
comment on column public.predictions.servings is 'AI 추정 인분 (1회 제공량=1). 무게를 잰 값이 아님';

-- (2) AI 요청 기록 — 사용자당 하루 횟수 제한·비용 확인용. 사진·AI 응답 원문은 저장하지 않음
create table if not exists public.ai_requests (
  req_id        uuid primary key default gen_random_uuid(),
  user_id       uuid references public.users(user_id) on delete set null,
  provider      text not null check (provider in ('gemini', 'mock')),
  model         text not null,
  ok            boolean not null,
  error_code    text,
  input_tokens  integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  latency_ms    integer check (latency_ms >= 0),
  created_at    timestamptz not null default now()
);
create index if not exists ai_requests_user_day_idx on public.ai_requests (user_id, created_at desc);
create index if not exists ai_requests_day_idx on public.ai_requests (created_at desc);
alter table public.ai_requests enable row level security;   -- 정책 없음 = 앱에서 접근 불가, 서버(service_role)만
revoke all on public.ai_requests from anon, authenticated;

-- (3) 동의 종류 추가: 음식 사진 AI 분석(외부 전송) — 선택 동의, 언제든 철회 가능
alter table public.consents drop constraint if exists consents_type_check;
alter table public.consents add constraint consents_type_check
  check (type in ('terms', 'privacy', 'sensitive', 'photo_improve', 'marketing', 'food_ai'));
commit;
