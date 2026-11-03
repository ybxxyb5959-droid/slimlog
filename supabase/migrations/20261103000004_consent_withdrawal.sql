-- SlimLog 004 · 민감정보(sensitive) 동의 철회
-- 삭제/비움 대상 (docs/DB_동의_삭제정책.md 와 같은 내용)
--   삭제: doses, symptoms, body_logs, body_log_sources, intake_logs(kind=medicine), intake_items(kind=medicine)
--   비움: user_health(height_cm, start_weight_kg, goal_weight_kg), daily_checks(sleep_h, appetite, condition)
--         → 비운 뒤 내용이 없는 daily_checks 행은 삭제
--   유지: users, consents(이력), meals, meal_items, predictions, foods(내 음식), Storage 식단 사진, 커뮤니티 글
-- 한 트랜잭션에서 처리되므로 중간에 실패하면 아무것도 지워지지 않는다.

create or replace function public.withdraw_sensitive_consent() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  n jsonb := '{}';
  c integer;
begin
  if uid is null then raise exception 'not authenticated'; end if;

  update consents set withdrawn_at = now() where user_id = uid and type = 'sensitive' and withdrawn_at is null;

  delete from doses where user_id = uid;                                   get diagnostics c = row_count; n := n || jsonb_build_object('doses', c);
  delete from symptoms where user_id = uid;                                get diagnostics c = row_count; n := n || jsonb_build_object('symptoms', c);
  delete from body_logs where user_id = uid;                               get diagnostics c = row_count; n := n || jsonb_build_object('body_logs', c);
  delete from body_log_sources where user_id = uid;                        get diagnostics c = row_count; n := n || jsonb_build_object('body_log_sources', c);
  delete from intake_logs where user_id = uid and kind = 'medicine';       get diagnostics c = row_count; n := n || jsonb_build_object('intake_logs_medicine', c);
  delete from intake_items where user_id = uid and kind = 'medicine';      get diagnostics c = row_count; n := n || jsonb_build_object('intake_items_medicine', c);
  update user_health set height_cm = null, start_weight_kg = null, goal_weight_kg = null where user_id = uid;
  update daily_checks set sleep_h = null, appetite = null, condition = null where user_id = uid;
  delete from daily_checks where user_id = uid and water_cups is null and supplement_done is null
    and sleep_h is null and appetite is null and condition is null;     get diagnostics c = row_count; n := n || jsonb_build_object('daily_checks_emptied', c);
  return n;
end $$;
revoke execute on function public.withdraw_sensitive_consent() from public, anon;
grant execute on function public.withdraw_sensitive_consent() to authenticated;
