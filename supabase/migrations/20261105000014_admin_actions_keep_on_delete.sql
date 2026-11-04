-- 관리자 계정이 탈퇴해도 막히지 않게: 감사 기록은 남기고 admin_id 만 비운다
-- (기존엔 on delete 규칙이 없어 조치 기록이 있는 계정은 Auth 삭제가 실패했다)
alter table public.admin_actions alter column admin_id drop not null;
alter table public.admin_actions drop constraint if exists admin_actions_admin_id_fkey;
alter table public.admin_actions
  add constraint admin_actions_admin_id_fkey foreign key (admin_id) references public.users(user_id) on delete set null;
