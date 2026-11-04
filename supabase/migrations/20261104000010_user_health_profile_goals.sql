-- SlimLog 010 · 온보딩 4단계용 칸 + 영양 목표 칸 (비파괴: 칸 5개 추가)
-- 출생연도(birth_year)는 001 에 이미 있음. 성별·활동량은 열량 '참고 계산'에만 쓰고, 안 넣어도 됨
alter table public.user_health add column if not exists sex text check (sex in ('female', 'male'));
alter table public.user_health add column if not exists activity_level text
  check (activity_level in ('sedentary', 'light', 'moderate', 'active'));
-- 사용자가 직접 정하거나 참고 계산 결과를 '내 목표로 쓰기' 눌러 저장한 값 (앱이 임의로 넣지 않음)
alter table public.user_health add column if not exists kcal_goal smallint check (kcal_goal between 800 and 5000);
alter table public.user_health add column if not exists carb_goal_g smallint check (carb_goal_g between 0 and 800);
alter table public.user_health add column if not exists fat_goal_g smallint check (fat_goal_g between 0 and 300);
comment on column public.user_health.sex is '성별(선택) — 기초대사량 참고 계산용';
comment on column public.user_health.activity_level is '평소 활동량(선택) — 없으면 계산 시 가장 낮은 활동량으로 가정하고 화면에 표시';
