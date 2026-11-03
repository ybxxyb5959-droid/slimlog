-- SlimLog DB 설치 파일 (Supabase SQL Editor 에 통째로 붙여넣고 Run)
-- 중간에 에러 나면 아무것도 안 바뀜 (한 묶음으로 실행)
begin;

-- ===== 20261103000001_core_schema.sql =====
-- SlimLog 001 · 핵심 스키마 (테이블 22개, 함수, 트리거)
-- 승인: 2026-11-03 설계안 v0.1 (22개 테이블) · 아직 실제 Supabase 에 적용 안 함
-- 개인정보: 눈바디 사진·인바디 결과지 이미지는 저장하지 않는다. 식단 사진은 Storage, DB 에는 경로·메타데이터만.

-- ---------------------------------------------------------------------
-- 0. 공통
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto;

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------------------------------------------------------------------
-- 1. 사용자 · 동의
-- ---------------------------------------------------------------------
-- USERS (공개 프로필) — 커뮤니티에서 다른 사람도 닉네임을 본다.
-- email 은 auth.users 에 있으므로 중복 저장하지 않는다.
create table public.users (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  nickname     text
               check (nickname ~ '^[가-힣A-Za-z0-9]{2,10}$'),
  role         text not null default 'user' check (role in ('user', 'admin')),
  onboarding_step         smallint not null default 0,
  onboarding_completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- USER_HEALTH (비공개) — RLS 는 행 단위라 공개/비공개 컬럼을 테이블로 나눈다.
create table public.user_health (
  user_id         uuid primary key references public.users(user_id) on delete cascade,
  -- 일반 개인정보
  legal_name      text,                          -- 가입 시 이름 (홈 인사말, 성 제외 표시)
  birth_year      smallint check (birth_year between 1900 and 2100),
  -- 민감정보(sensitive 동의 필요, 철회 시 null): 키·체중
  height_cm       numeric(4,1) check (height_cm between 100 and 250),
  start_weight_kg numeric(5,2) check (start_weight_kg between 20 and 400),
  goal_weight_kg  numeric(5,2) check (goal_weight_kg between 20 and 400),
  -- 일반: 목표 단백질
  protein_goal_g  smallint check (protein_goal_g between 0 and 400),
  updated_at      timestamptz not null default now()
);

-- CONSENTS — 동의 이력 (철회해도 행은 남기고 withdrawn_at 기록)
create table public.consents (
  consent_id   bigint generated always as identity primary key,
  user_id      uuid not null references public.users(user_id) on delete cascade,
  -- 프론트 src/fixtures/consents.ts 의 ConsentId 와 같은 값
  type         text not null check (type in ('terms', 'privacy', 'sensitive', 'photo_improve', 'marketing')),
  version      text not null,
  agreed_at    timestamptz not null default now(),
  withdrawn_at timestamptz
);
create index consents_user_idx on public.consents (user_id, type);

-- 가입하면 users 행 자동 생성 (닉네임은 온보딩에서)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (user_id) values (new.id);
  insert into public.user_health (user_id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 헬퍼: 관리자 여부 / 민감정보 동의 여부 (RLS 안에서 재귀 없이 쓰려고 security definer)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.users where user_id = auth.uid() and role = 'admin')
$$;

create or replace function public.has_consent(consent_type text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.consents
    where user_id = auth.uid() and type = consent_type and withdrawn_at is null
  )
$$;

-- 닉네임 사용 가능 여부 (형식 → 중복). 최종 방어는 UNIQUE 제약.
create or replace function public.nickname_available(name text) returns boolean
language sql stable security definer set search_path = public as $$
  select name ~ '^[가-힣A-Za-z0-9]{2,10}$'
     and not exists (select 1 from public.users where lower(nickname) = lower(name) and user_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'))
$$;
-- 대소문자만 다른 닉네임도 막는다
create unique index users_nickname_ci_uq on public.users (lower(nickname));

-- ---------------------------------------------------------------------
-- 2. 투약 · 증상
-- ---------------------------------------------------------------------
-- MEDICATIONS — 약 기준 정보 (모두 읽기만, 관리자/서버만 수정)
create table public.medications (
  med_id       text primary key,                 -- 'mounjaro' 등
  name         text not null,
  ingredient   text not null,
  half_life_h  numeric(6,1),                     -- null 이면 참고 곡선 만들지 않음
  pk_params    jsonb not null default '{}',      -- 값 + 원문 표현 + 출처 (생체이용률, Tmax 범위, ka 등)
  dose_options numeric(5,2)[],                   -- 허가 용량 목록, 미확인이면 null
  sites        text[],                           -- 허가 주사 부위, 미확인이면 null
  source       text,
  verified     text not null default 'secondary' check (verified in ('verified', 'secondary')),
  updated_at   timestamptz not null default now()
);

-- DOSES — 투약 기록
create table public.doses (
  dose_id      uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references public.users(user_id) on delete cascade,
  med_id       text not null references public.medications(med_id),
  dose_mg      numeric(5,2) not null check (dose_mg > 0 and dose_mg <= 50),
  injected_at  timestamptz not null,
  time_unknown boolean not null default false,   -- 시각 모름 → 12:00 저장 + 화면 표시
  date_approx  boolean not null default false,   -- 날짜 대략
  site         text check (site in ('abdomen', 'thigh_left', 'thigh_right', 'arm_left', 'arm_right', 'thigh', 'arm')),
  memo         text check (char_length(memo) <= 200),
  created_at   timestamptz not null default now(),
  check (injected_at <= now() + interval '5 minutes')
);
create index doses_user_time_idx on public.doses (user_id, injected_at desc);

-- SYMPTOMS — 증상 기록
create table public.symptoms (
  symptom_id   uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references public.users(user_id) on delete cascade,
  type         text not null,
  severity     smallint not null check (severity between 1 and 5),
  started_at   timestamptz not null,
  duration_h   numeric(5,1) check (duration_h >= 0),
  memo         text check (char_length(memo) <= 200),
  created_at   timestamptz not null default now()
);
create index symptoms_user_time_idx on public.symptoms (user_id, started_at desc);

-- ---------------------------------------------------------------------
-- 3. 몸 · 생활
-- ---------------------------------------------------------------------
-- BODY_LOG_SOURCES — OCR/API 원천 정보 (원본 이미지는 저장하지 않음)
create table public.body_log_sources (
  source_id      uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references public.users(user_id) on delete cascade,
  source_type    text not null check (source_type in ('INBODY_OCR', 'INBODY_API')),
  template_id    text,
  parser_version text,
  ocr_confidence numeric(4,3) check (ocr_confidence between 0 and 1),
  external_ref   text,
  created_at     timestamptz not null default now(),
  unique (user_id, source_type, external_ref)
);

-- BODY_LOGS — 체중·체성분 한 테이블
create table public.body_logs (
  log_id           uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references public.users(user_id) on delete cascade,
  measured_at      timestamptz not null check (measured_at <= now() + interval '5 minutes'),
  weight_kg        numeric(5,2) not null check (weight_kg between 20 and 400),
  skeletal_muscle_kg numeric(5,2) check (skeletal_muscle_kg > 0),
  body_fat_kg      numeric(5,2) check (body_fat_kg >= 0),
  body_fat_pct     numeric(4,1) check (body_fat_pct between 2.0 and 75.0),
  source           text not null default 'MANUAL' check (source in ('MANUAL', 'INBODY_OCR', 'INBODY_API')),
  is_verified      boolean not null default false,
  is_baseline      boolean not null default false,   -- 온보딩 최초 체중
  source_id        uuid references public.body_log_sources(source_id) on delete set null,
  created_at       timestamptz not null default now(),
  check (skeletal_muscle_kg is null or skeletal_muscle_kg < weight_kg),
  check (body_fat_kg is null or body_fat_kg < weight_kg)
);
create index body_logs_user_time_idx on public.body_logs (user_id, measured_at desc);
create unique index body_logs_one_baseline on public.body_logs (user_id) where is_baseline;

-- DAILY_CHECKS — 하루 컨디션 (기존 유지)
create table public.daily_checks (
  check_id        bigint generated always as identity primary key,
  user_id         uuid not null default auth.uid() references public.users(user_id) on delete cascade,
  date            date not null,
  water_cups      smallint check (water_cups between 0 and 30),   -- 일반 · 레거시 (새 물 기록은 intake_logs)
  supplement_done boolean,                                        -- 일반
  -- 민감정보(sensitive 동의 필요, 철회 시 null): 수면·식욕·컨디션
  sleep_h         numeric(3,1) check (sleep_h between 0 and 24),
  appetite        smallint check (appetite between 1 and 5),
  condition       smallint check (condition between 1 and 5),
  unique (user_id, date)
);

-- INTAKE_ITEMS / INTAKE_LOGS — 섭취 관리 (물·영양제·복용약), 신규
-- kind = 'medicine'(복용약) 은 민감정보 → sensitive 동의 필요, 철회 시 삭제
create table public.intake_items (
  item_id    uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.users(user_id) on delete cascade,
  kind       text not null check (kind in ('supplement', 'medicine')),
  name       text not null check (char_length(name) between 1 and 40),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.intake_logs (
  log_id     uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.users(user_id) on delete cascade,
  kind       text not null check (kind in ('water', 'supplement', 'medicine')),
  item_id    uuid references public.intake_items(item_id) on delete set null,
  amount_ml  smallint check (amount_ml between 1 and 3000),
  taken_at   timestamptz not null default now(),
  check ((kind = 'water' and amount_ml is not null and item_id is null) or (kind <> 'water' and amount_ml is null))
);
create index intake_logs_user_time_idx on public.intake_logs (user_id, taken_at desc);

-- ---------------------------------------------------------------------
-- 4. 식단 · 모델
-- ---------------------------------------------------------------------
-- FOODS — 공용 음식(owner_id null) + 내가 등록한 음식(owner_id = 나)
create table public.foods (
  food_id      text primary key default ('myfood-' || gen_random_uuid()),
  owner_id     uuid references public.users(user_id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 40),
  brand        text,
  category     text not null,
  basis_grams  numeric(6,1) not null check (basis_grams > 0),  -- 영양값 기준 무게
  basis_label  text not null,                                  -- '100g당', '1공기(210g)당'
  serving_g    numeric(6,1) not null check (serving_g > 0),
  units        jsonb,                                          -- [{label:'1개', grams:120}]
  kcal         numeric(6,1) not null check (kcal >= 0),
  carb_g       numeric(6,1) check (carb_g >= 0),               -- null = 정보 없음
  protein_g    numeric(6,1) check (protein_g >= 0),
  fat_g        numeric(6,1) check (fat_g >= 0),
  sodium_mg    numeric(7,1) check (sodium_mg >= 0),
  data_source  text,                                           -- '식약처 식품영양성분DB' 등
  ai_class     boolean not null default false,                 -- 모델이 학습한 클래스인지
  created_at   timestamptz not null default now()
);
create index foods_name_idx on public.foods (name);
create index foods_owner_idx on public.foods (owner_id) where owner_id is not null;

-- MODEL_VERSIONS — 모델 버전 (서버만 기록)
create table public.model_versions (
  model_ver_id text primary key,                 -- 'effb0-ml-2026-11-xx', 'mock-0'
  method       text not null,                    -- A(frozen)·B(partial)·C(mobilenet)
  task         text not null default 'multilabel' check (task in ('multilabel', 'single')),
  macro_f1     numeric(5,4),                     -- 실측값만 기록 (없으면 null)
  precision_m  numeric(5,4),
  recall_m     numeric(5,4),
  latency_ms   numeric(7,1),
  thresholds   jsonb,                            -- 클래스별 기준값
  created_at   timestamptz not null default now()
);

-- MEALS — 식사 기록 1건 (같은 점심이라도 따로 저장하면 다른 행)
--   ERD 의 meal(food_id·portion)은 음식 1개=1행이었으나, 한 끼에 여러 음식을 담도록
--   meals(기록) + meal_items(음식) 로 나눈다.
create table public.meals (
  meal_id     uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.users(user_id) on delete cascade,
  meal_type   text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  eaten_at    timestamptz not null check (eaten_at <= now() + interval '5 minutes'),
  source      text not null check (source in ('photo', 'manual')),
  -- 사진 메타데이터 (사진 파일 자체는 Storage 'meal-photos' 버킷)
  photo_path          text unique,              -- '{user_id}/{meal_id}.jpg'
  photo_mime          text check (photo_mime in ('image/jpeg', 'image/webp')),
  photo_bytes         integer check (photo_bytes between 1 and 5242880),
  photo_width         smallint check (photo_width between 1 and 8192),
  photo_height        smallint check (photo_height between 1 and 8192),
  photo_exif_stripped boolean,                  -- 서버가 EXIF(위치 등) 제거했는지
  status      text not null default 'confirmed' check (status in ('draft', 'confirmed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- 사진 기록이면 경로·메타데이터 필수, 수동 기록이면 전부 비움
  check ((source = 'photo' and photo_path is not null and photo_mime is not null and photo_bytes is not null and photo_exif_stripped)
      or (source = 'manual' and photo_path is null and photo_mime is null and photo_bytes is null and photo_width is null and photo_height is null and photo_exif_stripped is null)),
  -- 경로는 반드시 본인 폴더
  check (photo_path is null or photo_path like user_id::text || '/%')
);
create index meals_user_time_idx on public.meals (user_id, eaten_at desc);

-- MEAL_ITEMS — 음식 1개. 저장 시점 이름·영양 스냅숏 (음식 DB가 바뀌어도 기록은 그대로)
create table public.meal_items (
  item_id     uuid primary key default gen_random_uuid(),
  meal_id     uuid not null references public.meals(meal_id) on delete cascade,
  user_id     uuid not null default auth.uid() references public.users(user_id) on delete cascade,
  food_id     text references public.foods(food_id) on delete set null,
  name        text not null,
  brand       text,
  grams       numeric(6,1) not null check (grams > 0 and grams <= 5000),
  kcal        numeric(7,1) not null check (kcal >= 0),
  carb_g      numeric(6,1),
  protein_g   numeric(6,1),
  fat_g       numeric(6,1),
  from_photo  boolean not null default false,
  sort_order  smallint not null default 0
);
create index meal_items_meal_idx on public.meal_items (meal_id);

-- PREDICTIONS — 사진 인식 결과 (멀티라벨: 사진 1장 → 라벨 여러 줄). 서버만 기록.
--   사용자가 '제외'한 라벨도 남겨 둔다 (meal_item_id null) → 오인식 분석용
--   모델 성능 점검(사용자 수정 결과 활용)은 photo_improve 동의자만 → model_feedback 뷰(서버 전용)
create table public.predictions (
  pred_id           uuid primary key default gen_random_uuid(),
  meal_id           uuid not null references public.meals(meal_id) on delete cascade,
  user_id           uuid not null references public.users(user_id) on delete cascade,
  meal_item_id      uuid references public.meal_items(item_id) on delete set null,
  model_ver_id      text not null references public.model_versions(model_ver_id),
  mode              text not null check (mode in ('model', 'mock')),
  predicted_food_id text not null,
  candidates        text[] not null default '{}',
  score             numeric(5,4) check (score between 0 and 1),     -- raw sigmoid, 화면 비표시
  threshold         numeric(5,4) check (threshold between 0 and 1),
  status            text not null check (status in ('recognized', 'review')),
  user_action       text check (user_action in ('accepted', 'corrected', 'excluded')),
  corrected_food_id text,
  feedback_at       timestamptz,
  created_at        timestamptz not null default now()
);
create index predictions_meal_idx on public.predictions (meal_id);

-- ---------------------------------------------------------------------
-- 5. 커뮤니티 · 관리
-- ---------------------------------------------------------------------
create table public.posts (
  post_id     uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(user_id) on delete cascade,
  category    text not null default 'free',
  title       text not null check (char_length(title) between 1 and 60),
  body        text not null check (char_length(body) between 1 and 3000),
  risk_level  text not null check (risk_level in ('LOW', 'REVIEW', 'BLOCKED')),
  status      text not null default 'visible' check (status in ('visible', 'hidden', 'blocked')),
  like_count  integer not null default 0,
  comment_count integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index posts_feed_idx on public.posts (created_at desc) where deleted_at is null and status = 'visible';

create table public.comments (
  comment_id  uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(post_id) on delete cascade,
  user_id     uuid not null references public.users(user_id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 500),
  risk_level  text not null check (risk_level in ('LOW', 'REVIEW', 'BLOCKED')),
  status      text not null default 'visible' check (status in ('visible', 'hidden', 'blocked')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index comments_post_idx on public.comments (post_id, created_at);

create table public.post_likes (
  post_id    uuid not null references public.posts(post_id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.users(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.reports (
  report_id   uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.users(user_id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment', 'user')),
  target_id   uuid not null,
  reason      text not null check (reason in ('sale', 'dose_advice', 'ad', 'abuse', 'privacy', 'other')),
  detail      text check (char_length(detail) <= 300),
  status      text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at  timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)        -- 같은 대상 중복 신고 방지
);

create table public.filter_logs (
  filter_id    bigint generated always as identity primary key,
  user_id      uuid references public.users(user_id) on delete set null,
  target_type  text not null check (target_type in ('post', 'comment')),
  target_id    uuid,                               -- BLOCKED 면 저장 안 되므로 null 가능
  matched_rule text,
  level        text not null check (level in ('LOW', 'REVIEW', 'BLOCKED')),
  checked_at   timestamptz not null default now()
);

create table public.admin_actions (
  action_id   bigint generated always as identity primary key,
  admin_id    uuid not null references public.users(user_id),
  target_type text not null check (target_type in ('post', 'comment', 'user', 'report')),
  target_id   uuid not null,
  action      text not null check (action in ('hide', 'restore', 'delete', 'warn', 'suspend', 'dismiss')),
  reason      text not null check (char_length(reason) >= 2),   -- 사유 필수
  created_at  timestamptz not null default now()
);

-- 좋아요·댓글 수 동기화
create or replace function public.sync_post_counts() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'post_likes' then
    update posts set like_count = (select count(*) from post_likes where post_id = coalesce(new.post_id, old.post_id))
     where post_id = coalesce(new.post_id, old.post_id);
  else
    update posts set comment_count = (select count(*) from comments where post_id = coalesce(new.post_id, old.post_id) and deleted_at is null and status = 'visible')
     where post_id = coalesce(new.post_id, old.post_id);
  end if;
  return null;
end $$;
create trigger post_likes_count after insert or delete on public.post_likes for each row execute function public.sync_post_counts();
create trigger comments_count after insert or update or delete on public.comments for each row execute function public.sync_post_counts();

-- updated_at 트리거
create trigger users_updated before update on public.users for each row execute function public.set_updated_at();
create trigger user_health_updated before update on public.user_health for each row execute function public.set_updated_at();
create trigger meals_updated before update on public.meals for each row execute function public.set_updated_at();
create trigger posts_updated before update on public.posts for each row execute function public.set_updated_at();
create trigger comments_updated before update on public.comments for each row execute function public.set_updated_at();


-- 모델 점검용 (서버 전용): photo_improve 동의가 살아 있는 사용자의 피드백만
create view public.model_feedback with (security_invoker = true) as
  select p.pred_id, p.model_ver_id, p.mode, p.predicted_food_id, p.candidates, p.score, p.threshold,
         p.status, p.user_action, p.corrected_food_id, p.created_at
    from public.predictions p
   where p.user_action is not null
     and exists (select 1 from public.consents c
                  where c.user_id = p.user_id and c.type = 'photo_improve' and c.withdrawn_at is null);
revoke all on public.model_feedback from anon, authenticated;

-- ===== 20261103000002_rls_policies.sql =====
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

-- ===== 20261103000003_storage.sql =====
-- SlimLog 003 · Storage 정책 (식단 사진)
-- 버킷은 'meal-photos' 하나. 비공개.
--   경로: {user_id}/{meal_id}.jpg  (첫 폴더 = 소유자)
--   업로드·교체·삭제: FastAPI(service_role)만 — EXIF 제거·재인코딩·크기 제한 후 저장
--   앱: 본인 폴더 '읽기'만 → 서명 URL(유효 10분)로 표시
-- 저장하지 않는 것: 눈바디 사진, 인바디 결과지 이미지, 프로필 사진(기능 없음)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meal-photos', 'meal-photos', false, 5242880, array['image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy meal_photos_owner_read on storage.objects for select to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
-- insert / update / delete 정책 없음 → authenticated·anon 은 업로드·삭제 불가

-- ===== 20261103000004_consent_withdrawal.sql =====
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

commit;
