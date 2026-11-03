-- SlimLog 마이그레이션 007 (음식 검색 인덱스) — 005~006 적용한 클라우드에 이어서 Run
-- SlimLog 007 · 음식 검색 속도 (비파괴: 인덱스만 추가)
-- 식약처 데이터(수만~수십만 건)를 넣으면 '%닭가슴%' 같은 중간 일치 검색이 느려진다 → 3글자 조각(trigram) 인덱스
create extension if not exists pg_trgm;
create index if not exists foods_name_trgm on public.foods using gin (name gin_trgm_ops);
create index if not exists foods_brand_trgm on public.foods using gin (brand gin_trgm_ops) where brand is not null;
