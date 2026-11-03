-- SlimLog 002 · RLS 정책
-- service_role(FastAPI) 은 RLS 를 우회한다. 아래는 앱(anon key + 사용자 JWT) 기준.
-- 원칙: 본인 행만 / 민감정보는 sensitive 동의가 있어야 쓰기 / 검사가 필요한 쓰기는 서버만

do $$
declare t text;
begin
  foreach t in array array['users','user_health','consents','medications','doses','symptoms','body_log_sources',
    'body_logs','daily_checks','intake_items','intake_logs','foods','model_versions','meals','meal_items',
    'predictions','posts','comments','post_likes','reports','filter_logs','admin_actions']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ── users: 닉네임은 로그인 사용자 모두 조회(커뮤니티), 수정은 본인 + 허용 컬럼만 (role 변경 불가)
create policy users_select on public.users for select to authenticated using (true);
create policy users_update on public.users for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke insert, update, delete on public.users from anon, authenticated;
grant update (nickname, onboarding_step, onboarding_completed_at) on public.users to authenticated;

-- ── user_health: 본인만. 키·체중 칸은 sensitive 동의가 있어야 채울 수 있음
create policy uh_select on public.user_health for select to authenticated using (user_id = auth.uid());
create policy uh_update on public.user_health for update to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid()
    and (public.has_consent('sensitive') or (height_cm is null and start_weight_kg is null and goal_weight_kg is null)));
revoke insert, delete on public.user_health from anon, authenticated;

-- ── consents: 본인 조회·추가, 철회는 withdrawn_at 만 (삭제 불가 = 이력 보존)
create policy consents_select on public.consents for select to authenticated using (user_id = auth.uid());
create policy consents_insert on public.consents for insert to authenticated with check (user_id = auth.uid() and withdrawn_at is null);
create policy consents_update on public.consents for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update, delete on public.consents from anon, authenticated;
grant update (withdrawn_at) on public.consents to authenticated;

-- ── 민감정보 테이블: 본인 읽기·삭제(철회 후에도 가능), 쓰기는 동의 필요
do $$
declare t text;
begin
  foreach t in array array['doses','symptoms','body_logs','body_log_sources'] loop
    execute format('create policy s_select on public.%I for select to authenticated using (user_id = auth.uid())', t);
    execute format('create policy s_delete on public.%I for delete to authenticated using (user_id = auth.uid())', t);
    execute format('create policy s_insert on public.%I for insert to authenticated with check (user_id = auth.uid() and public.has_consent(''sensitive''))', t);
    execute format('create policy s_update on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.has_consent(''sensitive''))', t);
  end loop;
end $$;

-- ── daily_checks: 본인. 수면·식욕·컨디션은 동의 필요, 물·영양제 여부는 일반
create policy dc_select on public.daily_checks for select to authenticated using (user_id = auth.uid());
create policy dc_delete on public.daily_checks for delete to authenticated using (user_id = auth.uid());
create policy dc_insert on public.daily_checks for insert to authenticated with check (user_id = auth.uid()
  and (public.has_consent('sensitive') or (sleep_h is null and appetite is null and condition is null)));
create policy dc_update on public.daily_checks for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid()
  and (public.has_consent('sensitive') or (sleep_h is null and appetite is null and condition is null)));

-- ── 섭취 관리: 본인. 복용약(medicine)은 동의 필요
create policy ii_select on public.intake_items for select to authenticated using (user_id = auth.uid());
create policy ii_delete on public.intake_items for delete to authenticated using (user_id = auth.uid());
create policy ii_insert on public.intake_items for insert to authenticated with check (user_id = auth.uid() and (kind <> 'medicine' or public.has_consent('sensitive')));
create policy ii_update on public.intake_items for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and (kind <> 'medicine' or public.has_consent('sensitive')));
create policy il_select on public.intake_logs for select to authenticated using (user_id = auth.uid());
create policy il_delete on public.intake_logs for delete to authenticated using (user_id = auth.uid());
create policy il_insert on public.intake_logs for insert to authenticated with check (user_id = auth.uid() and (kind <> 'medicine' or public.has_consent('sensitive')));
create policy il_update on public.intake_logs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and (kind <> 'medicine' or public.has_consent('sensitive')));

-- ── 기준 정보: 모두 읽기, 쓰기는 서버만
create policy read_all on public.medications    for select to anon, authenticated using (true);
create policy read_all on public.model_versions for select to authenticated using (true);
revoke insert, update, delete on public.medications, public.model_versions from anon, authenticated;

-- ── foods: 공용 + 내 음식 읽기, 내 음식만 추가·수정·삭제
create policy foods_select on public.foods for select to authenticated using (owner_id is null or owner_id = auth.uid());
create policy foods_insert on public.foods for insert to authenticated with check (owner_id = auth.uid() and ai_class = false);
create policy foods_update on public.foods for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid() and ai_class = false);
create policy foods_delete on public.foods for delete to authenticated using (owner_id = auth.uid());

-- ── meals
--   수동 기록: 앱이 직접 추가·수정·삭제
--   사진 기록: 서버가 사진 업로드(EXIF 제거) + 행 생성. 앱은 끼니·시간·확정만 수정.
--             삭제는 서버 API(DELETE /meals/{id}) 가 Storage 파일 → 행 순서로 지운다 (고아 파일 방지)
create policy meals_select on public.meals for select to authenticated using (user_id = auth.uid());
create policy meals_insert on public.meals for insert to authenticated with check (user_id = auth.uid() and source = 'manual');
create policy meals_update on public.meals for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy meals_delete on public.meals for delete to authenticated using (user_id = auth.uid() and photo_path is null);
revoke update on public.meals from anon, authenticated;
grant update (meal_type, eaten_at, status) on public.meals to authenticated;

create policy mi_all on public.meal_items for all to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.meals m where m.meal_id = meal_items.meal_id and m.user_id = auth.uid()));

-- ── predictions: 본인 읽기 + 피드백 컬럼만 수정. 추가는 서버만.
create policy pred_select on public.predictions for select to authenticated using (user_id = auth.uid());
create policy pred_update on public.predictions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke insert, update, delete on public.predictions from anon, authenticated;
grant update (meal_item_id, user_action, corrected_food_id, feedback_at) on public.predictions to authenticated;

-- ── 커뮤니티: 읽기만 앱, 작성·수정·삭제는 서버(금칙어·권한·입력값 검사 후)
create policy posts_select on public.posts for select to authenticated
  using ((deleted_at is null and status = 'visible') or user_id = auth.uid() or public.is_admin());
create policy comments_select on public.comments for select to authenticated
  using ((deleted_at is null and status = 'visible') or user_id = auth.uid() or public.is_admin());
revoke insert, update, delete on public.posts, public.comments from anon, authenticated;

create policy likes_select on public.post_likes for select to authenticated using (user_id = auth.uid());
create policy likes_insert on public.post_likes for insert to authenticated with check (user_id = auth.uid());
create policy likes_delete on public.post_likes for delete to authenticated using (user_id = auth.uid());

create policy reports_insert on public.reports for insert to authenticated with check (reporter_id = auth.uid() and status = 'open');
create policy reports_select on public.reports for select to authenticated using (reporter_id = auth.uid() or public.is_admin());

create policy admin_read on public.filter_logs   for select to authenticated using (public.is_admin());
create policy admin_read on public.admin_actions for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.filter_logs, public.admin_actions from anon, authenticated;

-- ── anon(로그인 전)은 약 기준 정보 외에는 아무것도 못 봄
revoke all on all tables in schema public from anon;
grant select on public.medications to anon;

-- ── 헬퍼 함수 실행 권한
revoke execute on function public.handle_new_user() from public, anon, authenticated;
