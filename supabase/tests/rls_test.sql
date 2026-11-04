-- SlimLog RLS·제약 테스트 — 실제 Supabase(로컬 CLI 또는 클라우드 SQL 편집기)에서 실행
-- 전체가 하나의 트랜잭션이고 마지막에 ROLLBACK 하므로 데이터가 남지 않는다.
-- 결과: NOTICE 'PASS …' / 'FAIL …'
begin;

create function pg_temp.ok(name text, cond boolean) returns void language plpgsql as $$
begin raise notice '% %', case when cond then 'PASS' else 'FAIL' end, name; end $$;
create function pg_temp.fails(name text, stmt text) returns void language plpgsql as $$
begin
  begin execute stmt; raise notice 'FAIL % (막혀야 하는데 통과)', name;
  exception when others then raise notice 'PASS % [%]', name, sqlerrm; end;
end $$;

-- 준비 (postgres 권한 = 서버 역할)
insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'rls-a@test.local', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'rls-b@test.local', 'authenticated', 'authenticated');
insert into medications (med_id, name, ingredient, half_life_h) values ('test-med', '테스트약', 'test', 120);
insert into foods (food_id, name, category, basis_grams, basis_label, serving_g, kcal) values ('test-rice', '쌀밥', '밥', 210, '1공기(210g)당', 210, 310);
insert into model_versions (model_ver_id, method) values ('test-mock', 'mock');
select pg_temp.ok('01 가입 시 users/user_health 자동 생성', (select count(*) from users where user_id in ('aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002'))=2
  and (select count(*) from user_health where user_id in ('aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002'))=2);

-- ===== A =====
set local role authenticated; set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select pg_temp.fails('02 동의 없이 투약 기록', $$insert into doses (med_id,dose_mg,injected_at) values ('test-med',2.5,now())$$);
select pg_temp.fails('03 동의 없이 키·체중 입력', $$update user_health set height_cm=170 where user_id=auth.uid()$$);
select pg_temp.fails('03-1 동의 없이 사용 중인 약 입력', $$update user_health set current_med_id='test-med' where user_id=auth.uid()$$);
select pg_temp.fails('04 동의 없이 컨디션 기록', $$insert into daily_checks (date,condition) values (current_date,3)$$);
select pg_temp.fails('05 동의 없이 복용약 등록', $$insert into intake_items (kind,name) values ('medicine','약')$$);
insert into daily_checks (date, water_cups) values (current_date, 3);
insert into intake_logs (kind, amount_ml) values ('water', 250);
select pg_temp.ok('06 동의 없이도 물·일반 기록은 가능', (select count(*) from daily_checks)=1 and (select count(*) from intake_logs)=1);
insert into consents (user_id,type,version) values (auth.uid(),'sensitive','v1');
insert into doses (med_id,dose_mg,injected_at) values ('test-med',2.5,now());
update user_health set height_cm=170, start_weight_kg=80, goal_weight_kg=65, legal_name='홍길동' where user_id=auth.uid();
update daily_checks set condition=4, sleep_h=7 where date=current_date;
insert into intake_items (kind,name) values ('medicine','복용약'), ('supplement','비타민');
insert into intake_logs (kind,item_id) select 'medicine', item_id from intake_items where kind='medicine';
select pg_temp.ok('07 동의 후 민감정보 저장', (select count(*) from doses)=1 and (select height_cm from user_health)=170);
select pg_temp.fails('08 미래 시각 투약', $$insert into doses (med_id,dose_mg,injected_at) values ('test-med',2.5,now()+interval '1 day')$$);
select pg_temp.fails('09 role 을 admin 으로', $$update users set role='admin' where user_id=auth.uid()$$);
update users set nickname='슬림A' where user_id=auth.uid();
select pg_temp.fails('10 잘못된 닉네임 형식', $$update users set nickname='a' where user_id=auth.uid()$$);
select pg_temp.ok('11 닉네임 확인 함수', public.nickname_available('새이름') and not public.nickname_available('x!'));
select pg_temp.fails('12 게시글 직접 작성', $$insert into posts (user_id,title,body,risk_level) values (auth.uid(),'t','b','LOW')$$);
select pg_temp.fails('13 댓글 직접 작성', $$insert into comments (post_id,user_id,body,risk_level) values (gen_random_uuid(),auth.uid(),'b','LOW')$$);
insert into body_logs (measured_at,weight_kg,is_baseline) values (now(),80,true);
select pg_temp.fails('14 최초 체중 두 번', $$insert into body_logs (measured_at,weight_kg,is_baseline) values (now(),79,true)$$);
select pg_temp.fails('15 체지방률 범위 밖', $$insert into body_logs (measured_at,weight_kg,body_fat_pct) values (now(),80,90)$$);
insert into foods (owner_id,name,category,basis_grams,basis_label,serving_g,kcal) values (auth.uid(),'엄마표곤드레밥','내 음식',250,'250g당',250,380);
insert into meals (meal_type,eaten_at,source) values ('breakfast',now(),'manual');
insert into meal_items (meal_id,food_id,name,grams,kcal) select meal_id,'test-rice','쌀밥',210,310 from meals;
select pg_temp.fails('16 앱이 사진 기록 직접 생성', $$insert into meals (meal_type,eaten_at,source,photo_path,photo_mime,photo_bytes,photo_exif_stripped) values ('lunch',now(),'photo',auth.uid()||'/x.jpg','image/jpeg',100,true)$$);
select pg_temp.fails('17 수동 기록에 사진 경로', $$insert into meals (meal_type,eaten_at,source,photo_path) values ('lunch',now(),'manual',auth.uid()||'/x.jpg')$$);
select pg_temp.fails('18 물 기록에 mL 없음', $$insert into intake_logs (kind) values ('water')$$);
select pg_temp.fails('19 인식 결과 직접 추가', $$insert into predictions (meal_id,user_id,model_ver_id,mode,predicted_food_id,status) select meal_id,auth.uid(),'test-mock','mock','test-rice','recognized' from meals$$);

-- 서버 역할로 사진 기록 + 인식 결과 생성
reset role;
select pg_temp.fails('20 사진 경로가 남의 폴더', $$insert into meals (user_id,meal_type,eaten_at,source,photo_path,photo_mime,photo_bytes,photo_exif_stripped) values ('aaaaaaaa-0000-0000-0000-000000000001','lunch',now(),'photo','bbbbbbbb-0000-0000-0000-000000000002/x.jpg','image/jpeg',100,true)$$);
select pg_temp.fails('21 EXIF 제거 안 된 사진', $$insert into meals (user_id,meal_type,eaten_at,source,photo_path,photo_mime,photo_bytes,photo_exif_stripped) values ('aaaaaaaa-0000-0000-0000-000000000001','lunch',now(),'photo','aaaaaaaa-0000-0000-0000-000000000001/y.jpg','image/jpeg',100,false)$$);
insert into meals (meal_id,user_id,meal_type,eaten_at,source,photo_path,photo_mime,photo_bytes,photo_width,photo_height,photo_exif_stripped)
  values ('cccccccc-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000001','lunch',now(),'photo','aaaaaaaa-0000-0000-0000-000000000001/cccccccc-0000-0000-0000-000000000003.jpg','image/jpeg',182000,1280,960,true);
insert into predictions (meal_id,user_id,model_ver_id,mode,predicted_food_id,score,threshold,status)
  values ('cccccccc-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000001','test-mock','mock','test-rice',0.91,0.5,'recognized');

set local role authenticated; set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
update predictions set user_action='accepted', feedback_at=now();
select pg_temp.ok('22 인식 결과 피드백 수정', (select user_action from predictions)='accepted');
select pg_temp.fails('23 인식 점수 조작', $$update predictions set score=0.99$$);
select pg_temp.fails('24 사진 경로 바꾸기', $$update meals set photo_path=null where source='photo'$$);
delete from meals where source='photo';
select pg_temp.ok('25 사진 기록은 앱에서 삭제 안 됨(서버 API 로)', (select count(*) from meals where source='photo')=1);
update meals set meal_type='dinner' where source='photo';
select pg_temp.ok('26 사진 기록 끼니 수정은 가능', (select meal_type from meals where source='photo')='dinner');
select pg_temp.fails('27 모델 점검 뷰 직접 조회', $$select * from model_feedback$$);

-- ===== B =====
set local request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';
select pg_temp.ok('28 B 는 A 투약·증상·체중 못 봄', (select count(*) from doses)=0 and (select count(*) from body_logs)=0 and (select count(*) from symptoms)=0);
select pg_temp.ok('29 B 는 A 식단·인식 결과 못 봄', (select count(*) from meals)=0 and (select count(*) from meal_items)=0 and (select count(*) from predictions)=0);
select pg_temp.ok('30 B 는 A 내 음식 못 봄, 공용은 봄', (select count(*) from foods where food_id='test-rice')=1 and (select count(*) from foods where owner_id is not null)=0);
select pg_temp.ok('31 B 는 A 건강정보·섭취·컨디션 못 봄', (select count(*) from user_health)=1 and (select count(*) from intake_logs)=0 and (select count(*) from daily_checks)=0);
select pg_temp.ok('32 B 는 A 닉네임은 봄', (select nickname from users where user_id='aaaaaaaa-0000-0000-0000-000000000001')='슬림A');
select pg_temp.fails('33 B 가 같은 닉네임(대소문자 무시)', $$update users set nickname='슬림a' where user_id=auth.uid()$$);
select pg_temp.fails('34 B 가 A 식사에 음식 끼워넣기', $$insert into meal_items (meal_id,name,grams,kcal) values ('cccccccc-0000-0000-0000-000000000003','x',1,1)$$);
update doses set dose_mg=10; delete from meals; update user_health set legal_name='해킹';
select pg_temp.fails('35 B 가 필터 로그 쓰기', $$insert into filter_logs (target_type,level) values ('post','LOW')$$);
reset role;
select pg_temp.ok('36 B 의 수정·삭제 시도 → A 데이터 그대로', (select dose_mg from doses where user_id='aaaaaaaa-0000-0000-0000-000000000001')=2.5 and (select count(*) from meals where user_id='aaaaaaaa-0000-0000-0000-000000000001')=2
  and (select legal_name from user_health where user_id='aaaaaaaa-0000-0000-0000-000000000001')='홍길동');

-- ===== 로그인 전 (anon) =====
set local role anon; set local request.jwt.claim.sub = '';
select pg_temp.ok('37 anon 은 약 기준 정보만', (select count(*) from medications where med_id='test-med')=1);
select pg_temp.fails('38 anon 이 닉네임 목록 조회', $$select * from users$$);
reset role;

-- ===== 동의 철회 =====
set local role authenticated; set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select public.withdraw_sensitive_consent();
select pg_temp.ok('39 철회 → 투약·체중 삭제', (select count(*) from doses)=0 and (select count(*) from body_logs)=0);
select pg_temp.ok('40 철회 → 복용약 삭제, 영양제·물 유지', (select count(*) from intake_items where kind='medicine')=0 and (select count(*) from intake_items where kind='supplement')=1
  and (select count(*) from intake_logs where kind='medicine')=0 and (select count(*) from intake_logs where kind='water')=1);
select pg_temp.ok('41 철회 → 키·체중·컨디션 비움, 이름·물 유지', (select height_cm is null and start_weight_kg is null and legal_name='홍길동' from user_health)
  and (select condition is null and sleep_h is null and water_cups=3 from daily_checks));
select pg_temp.ok('42 철회 → 식단·인식 결과 유지', (select count(*) from meals)=2 and (select count(*) from predictions)=1);
select pg_temp.ok('43 철회 → 동의 이력 남음', (select count(*) from consents where type='sensitive' and withdrawn_at is not null)=1);
select pg_temp.fails('44 철회 후 투약 기록', $$insert into doses (med_id,dose_mg,injected_at) values ('test-med',2.5,now())$$);
reset role;

-- ===== 011 식단 사진 AI =====
insert into ai_requests (user_id, provider, model, ok) values ('bbbbbbbb-0000-0000-0000-000000000002', 'gemini', 'rls-test', true);
set local role authenticated; set local request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';
select pg_temp.fails('46 앱에서 AI 요청 기록 읽기', $$select count(*) from ai_requests$$);
select pg_temp.fails('47 앱에서 AI 요청 기록 추가(횟수 우회)', $$insert into ai_requests (user_id,provider,model,ok) values (auth.uid(),'gemini','x',true)$$);
select pg_temp.fails('48 앱에서 AI 요청 기록 지우기(횟수 초기화)', $$delete from ai_requests$$);
insert into consents (user_id, type, version) values (auth.uid(), 'food_ai', 'v1');
select pg_temp.ok('49 음식 사진 AI 동의 저장', (select count(*) from consents where type = 'food_ai') = 1);
reset role;
select pg_temp.fails('50 음식 이름·food_id 둘 다 없는 인식 결과', $$insert into predictions (meal_id,user_id,model_ver_id,mode,status) select meal_id,user_id,'test-mock','mock','review' from meals limit 1$$);
delete from ai_requests where model = 'rls-test';

-- ===== 탈퇴 =====
delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select pg_temp.ok('45 탈퇴 → A 데이터 전부 삭제', (select count(*) from users where user_id='aaaaaaaa-0000-0000-0000-000000000001')=0
  and (select count(*) from meals where user_id='aaaaaaaa-0000-0000-0000-000000000001')=0 and (select count(*) from consents where user_id='aaaaaaaa-0000-0000-0000-000000000001')=0);

rollback;
