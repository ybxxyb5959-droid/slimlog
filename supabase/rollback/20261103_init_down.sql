-- SlimLog 초기 마이그레이션(001~004) 되돌리기 — 비상용
-- ⚠ 모든 앱 데이터가 지워진다. 실제 사용자 데이터가 생긴 뒤에는 쓰지 말 것.
-- Storage 파일·버킷은 SQL 로 못 지운다 (Supabase 가 막음). 'meal-photos' 버킷은 대시보드나 Storage API 로 비우고 삭제.
begin;
drop trigger if exists on_auth_user_created on auth.users;
drop policy if exists meal_photos_owner_read on storage.objects;
drop view if exists public.model_feedback;
drop table if exists public.admin_actions, public.filter_logs, public.reports, public.post_likes, public.comments, public.posts,
  public.predictions, public.meal_items, public.meals, public.model_versions, public.foods,
  public.intake_logs, public.intake_items, public.daily_checks, public.body_logs, public.body_log_sources,
  public.symptoms, public.doses, public.medications, public.consents, public.user_health, public.users cascade;
drop function if exists public.withdraw_sensitive_consent(), public.sync_post_counts(), public.nickname_available(text),
  public.has_consent(text), public.is_admin(), public.handle_new_user(), public.set_updated_at();
commit;
