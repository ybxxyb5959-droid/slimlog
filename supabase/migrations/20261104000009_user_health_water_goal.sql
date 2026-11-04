-- SlimLog 009 · 하루 물 목표 저장 칸 (비파괴: 칸 1개 추가)
-- 단백질 목표(protein_goal_g)는 001 에 이미 있음. 물 목표는 일반 정보라 동의와 상관없이 저장 가능
alter table public.user_health add column if not exists water_goal_ml smallint
  check (water_goal_ml between 250 and 6000);
comment on column public.user_health.water_goal_ml is '하루 물 목표(ml). 사용자가 직접 정한 값, 앱이 추천하지 않음';
