-- RLS·제약 동작 테스트 (로컬 Postgres 전용). 결과: NOTICE PASS/FAIL
\set QUIET on
create or replace function pg_temp.ok(name text, cond boolean) returns void language plpgsql as $$
begin raise notice '% %', case when cond then 'PASS' else 'FAIL' end, name; end $$;
create or replace function pg_temp.fails(name text, stmt text) returns void language plpgsql as $$
begin
  begin execute stmt; raise notice 'FAIL % (막혀야 하는데 통과)', name;
  exception when others then raise notice 'PASS % [%]', name, sqlerrm; end;
end $$;
grant execute on all functions in schema pg_temp to authenticated;

-- 준비 (서버 권한)
insert into auth.users values ('aaaaaaaa-0000-0000-0000-000000000001','a@x'), ('bbbbbbbb-0000-0000-0000-000000000002','b@x');
insert into medications (med_id, name, ingredient, half_life_h) values ('mounjaro','마운자로','tirzepatide',120);
insert into foods (food_id, name, category, basis_grams, basis_label, serving_g, kcal) values ('rice','쌀밥','밥',210,'1공기(210g)당',210,310);
insert into model_versions (model_ver_id, method) values ('mock-0','mock');
select pg_temp.ok('가입 시 users/user_health 자동 생성', (select count(*) from users)=2 and (select count(*) from user_health)=2);

-- A 로 로그인
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select pg_temp.fails('동의 없이 투약 기록', $$insert into doses (med_id,dose_mg,injected_at) values ('mounjaro',2.5,now())$$);
insert into consents (user_id,type,version) values (auth.uid(),'sensitive_health','v1');
insert into doses (med_id,dose_mg,injected_at) values ('mounjaro',2.5,now());
select pg_temp.ok('동의 후 투약 기록 저장', (select count(*) from doses)=1);
select pg_temp.fails('미래 시각 투약', $$insert into doses (med_id,dose_mg,injected_at) values ('mounjaro',2.5,now()+interval '1 day')$$);
select pg_temp.fails('role 을 admin 으로 바꾸기', $$update users set role='admin' where user_id=auth.uid()$$);
update users set nickname='슬림A' where user_id=auth.uid();
select pg_temp.fails('잘못된 닉네임 형식', $$update users set nickname='a' where user_id=auth.uid()$$);
select pg_temp.ok('닉네임 확인 함수', public.nickname_available('새이름') and not public.nickname_available('x!'));
select pg_temp.fails('게시글 직접 작성(서버 검사 우회)', $$insert into posts (user_id,title,body,risk_level) values (auth.uid(),'t','b','LOW')$$);
insert into body_logs (measured_at,weight_kg,is_baseline) values (now(),80,true);
select pg_temp.fails('최초 체중 두 번 저장', $$insert into body_logs (measured_at,weight_kg,is_baseline) values (now(),79,true)$$);
select pg_temp.fails('체지방률 범위 밖', $$insert into body_logs (measured_at,weight_kg,body_fat_pct) values (now(),80,90)$$);
insert into foods (owner_id,name,category,basis_grams,basis_label,serving_g,kcal) values (auth.uid(),'엄마표곤드레밥','내 음식',250,'250g당',250,380);
insert into meals (meal_type,eaten_at,source) values ('lunch',now(),'manual');
insert into meal_items (meal_id,food_id,name,grams,kcal) select meal_id,'rice','쌀밥',210,310 from meals;
select pg_temp.fails('사진 기록인데 사진 경로 없음', $$insert into meals (meal_type,eaten_at,source) values ('lunch',now(),'photo')$$);
insert into intake_logs (kind,amount_ml) values ('water',250);
select pg_temp.fails('물 기록에 mL 없음', $$insert into intake_logs (kind) values ('water')$$);
select pg_temp.fails('인식 결과 직접 추가', $$insert into predictions (meal_id,user_id,model_ver_id,mode,predicted_food_id,status) select meal_id,auth.uid(),'mock-0','mock','rice','recognized' from meals$$);
reset role;
-- 서버가 인식 결과 기록
insert into predictions (meal_id,user_id,model_ver_id,mode,predicted_food_id,score,threshold,status) select meal_id,user_id,'mock-0','mock','rice',0.91,0.5,'recognized' from meals;
insert into storage.objects (bucket_id,name) values ('meal-photos','aaaaaaaa-0000-0000-0000-000000000001/p1.jpg');
set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
update predictions set user_action='accepted', feedback_at=now();
select pg_temp.ok('인식 결과 피드백 컬럼 수정', (select user_action from predictions)='accepted');
select pg_temp.fails('인식 점수 조작', $$update predictions set score=0.99$$);
select pg_temp.ok('내 사진 보기', (select count(*) from storage.objects)=1);

-- B 로 로그인
set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';
select pg_temp.ok('B 는 A 투약 못 봄', (select count(*) from doses)=0);
select pg_temp.ok('B 는 A 체중 못 봄', (select count(*) from body_logs)=0);
select pg_temp.ok('B 는 A 식단 못 봄', (select count(*) from meals)=0 and (select count(*) from meal_items)=0);
select pg_temp.ok('B 는 A 인식 결과 못 봄', (select count(*) from predictions)=0);
select pg_temp.ok('B 는 A 의 내 음식 못 봄, 공용 음식은 봄', (select count(*) from foods)=1);
select pg_temp.ok('B 는 A 사진 못 봄', (select count(*) from storage.objects)=0);
select pg_temp.ok('B 는 A 닉네임은 봄(커뮤니티)', (select nickname from users where user_id='aaaaaaaa-0000-0000-0000-000000000001')='슬림A');
select pg_temp.ok('B 는 A 이름·키 못 봄', (select count(*) from user_health)=1);
select pg_temp.fails('B 가 같은 닉네임(대소문자 무시)', $$update users set nickname='슬림a' where user_id=auth.uid()$$);
update users set nickname='슬림B' where user_id=auth.uid();
reset role; create temp table a_meal as select meal_id from meals; grant select on a_meal to authenticated;
set role authenticated; set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';
select pg_temp.fails('B 가 A 식사에 음식 끼워넣기', $$insert into meal_items (meal_id,name,grams,kcal) select meal_id,'x',1,1 from a_meal$$);
update doses set dose_mg=10; delete from meals;
reset role;
select pg_temp.ok('B 가 A 투약 수정·식단 삭제 시도 → 변화 없음', (select dose_mg from doses)=2.5 and (select count(*) from meals)=1);
set role authenticated; set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';
select pg_temp.fails('B 가 필터 로그 보기 대신 쓰기', $$insert into filter_logs (target_type,level) values ('post','LOW')$$);

-- 철회
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select public.withdraw_health_consent();
select pg_temp.ok('동의 철회 → 투약·체중 삭제', (select count(*) from doses)=0 and (select count(*) from body_logs)=0);
select pg_temp.ok('동의 철회 → 식단은 유지', (select count(*) from meals)=1);
select pg_temp.fails('철회 후 투약 기록', $$insert into doses (med_id,dose_mg,injected_at) values ('mounjaro',2.5,now())$$);
reset role;
-- 탈퇴: auth.users 삭제 → 전부 삭제
delete from auth.users where id='aaaaaaaa-0000-0000-0000-000000000001';
select pg_temp.ok('탈퇴 시 A 데이터 전부 삭제', (select count(*) from users)=1 and (select count(*) from meals)=0 and (select count(*) from foods where owner_id is not null)=0);
