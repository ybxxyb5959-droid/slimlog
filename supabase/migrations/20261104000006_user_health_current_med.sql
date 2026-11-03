-- SlimLog 006 · 마이 > 프로필의 "사용 중인 약" 저장 칸 (비파괴: 컬럼 추가만)
-- 어떤 약을 쓰는지는 건강정보 → 기존 user_health(본인만 RLS) 에 둔다. 동의 철회 시 비운다.
alter table public.user_health add column if not exists current_med_id text references public.medications(med_id);

-- 동의 철회 함수에 current_med_id 비우기 추가 (나머지 동작은 004 와 같음)
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
  update user_health set height_cm = null, start_weight_kg = null, goal_weight_kg = null, current_med_id = null where user_id = uid;
  update daily_checks set sleep_h = null, appetite = null, condition = null where user_id = uid;
  delete from daily_checks where user_id = uid and water_cups is null and supplement_done is null
    and sleep_h is null and appetite is null and condition is null;     get diagnostics c = row_count; n := n || jsonb_build_object('daily_checks_emptied', c);
  return n;
end $$;
revoke execute on function public.withdraw_sensitive_consent() from public, anon;
grant execute on function public.withdraw_sensitive_consent() to authenticated;

-- current_med_id 도 동의가 있어야 채울 수 있게 user_health 수정 정책 갱신
drop policy if exists uh_update on public.user_health;
create policy uh_update on public.user_health for update to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid()
    and (public.has_consent('sensitive') or (height_cm is null and start_weight_kg is null and goal_weight_kg is null and current_med_id is null)));
