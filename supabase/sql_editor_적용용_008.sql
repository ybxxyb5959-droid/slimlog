-- SlimLog 마이그레이션 008 (영양제·복용약 알림 + 폰 푸시 구독 테이블) — 007 적용한 클라우드에 이어서 Run
begin;
-- SlimLog 008 · 영양제·복용약 알림 + 폰 푸시 (비파괴: 칸 추가 + 테이블 1개 추가 → 23개)
-- 1) 섭취 항목: 매일 몇 시에 알림 (요일 없음 = 매일)
alter table public.intake_items add column if not exists remind_enabled boolean not null default false;
alter table public.intake_items add column if not exists remind_hour smallint check (remind_hour between 0 and 23);
-- 알림을 한 번 물어봤는지 (첫 섭취 완료 때 '[확인] [알림받지 않기]' 를 한 번만 묻기 위함)
alter table public.intake_items add column if not exists remind_asked boolean not null default false;
-- 같은 날 같은 알림을 두 번 보내지 않기 위한 마지막 발송일
alter table public.intake_items add column if not exists last_reminded_on date;

-- 2) 섭취 기록: 먹었어요 / 건너뛰었어요 + 예정 시각
alter table public.intake_logs add column if not exists status text not null default 'taken' check (status in ('taken', 'skipped'));
alter table public.intake_logs add column if not exists scheduled_at timestamptz;

-- 3) 폰 푸시 구독 (기기마다 1행). 본인만 등록·삭제, 발송은 서버(service_role)
create table if not exists public.push_subscriptions (
  sub_id     uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.users(user_id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy push_select on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy push_insert on public.push_subscriptions for insert to authenticated with check (user_id = auth.uid());
create policy push_delete on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());
revoke update on public.push_subscriptions from anon, authenticated;
revoke all on public.push_subscriptions from anon;
commit;
