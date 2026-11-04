-- SlimLog 013 · 음식 검색 빠르게 (비파괴: 인덱스 2개 + 검색 함수 1개 추가)
-- 문제: ① '이름순 정렬 + 30개'라서 맞는 걸 전부(예: '치킨' 5천 개) 모은 뒤 정렬 ② 2글자 이하 검색어는 3글자 조각 인덱스(007)를 못 써서 33만 개를 훑음
-- 해결: 2글자 이하는 '앞부분 일치'(아래 인덱스) + 중간 일치는 정렬 없이 앞에서 멈춤, 3글자 이상은 007 인덱스로 후보만 모아 순위 정렬
create index if not exists foods_name_lower_prefix on public.foods (lower(name) text_pattern_ops);
create index if not exists foods_brand_lower_prefix on public.foods (lower(brand) text_pattern_ops) where brand is not null;

-- 순위: 이름이 검색어와 같음 → 이름이 검색어로 시작 → 일반 음식(가공식품 아님) → 짧은 이름
-- ⚠️ RLS 가 걸린 테이블에서는 like/ilike(누출 안전 함수 아님)로 인덱스를 못 써서 33만 개를 다 훑는다 (실측 340ms → 6ms).
--    그래서 이 함수만 security definer 로 RLS 를 건너뛰고, 대신 아래 쿼리마다 '공용 음식 + 내 음식' 조건을 직접 건다 (foods_select 정책과 같음).
-- 검색어를 상수로 넣어 실행(format %L) → 매번 인덱스를 쓰는 계획이 나옴 (변수로 넘기면 인덱스를 못 씀)
create or replace function public.search_foods(q text, lim int default 30)
returns setof public.foods
language plpgsql stable security definer set search_path = public
as $$
declare
  s text := lower(btrim(regexp_replace(coalesce(q, ''), '[%_\\]', '', 'g')));
  me uuid := auth.uid();
  n int := least(greatest(coalesce(lim, 30), 1), 50);
begin
  if s = '' then
    return;
  end if;
  if char_length(s) >= 3 then
    return query execute format($q$
      select f.* from foods f
      where (f.owner_id is null or f.owner_id = %5$L::uuid) and (f.name ilike %1$L or (f.brand is not null and f.brand ilike %1$L))
      order by (lower(f.name) = %2$L) desc, (lower(f.name) like %3$L) desc, (f.category = '가공식품'), char_length(f.name), f.name
      limit %4$s
    $q$, '%' || s || '%', s, s || '%', n, me);
  else
    return query execute format($q$
      with hits as (
        (select f.food_id, 0 as r from foods f where (f.owner_id is null or f.owner_id = %5$L::uuid) and lower(f.name) like %1$L order by char_length(f.name) limit %3$s)
        union all
        (select f.food_id, 1 from foods f where (f.owner_id is null or f.owner_id = %5$L::uuid) and f.brand is not null and lower(f.brand) like %1$L limit %3$s)
        union all
        (select f.food_id, 2 from foods f where (f.owner_id is null or f.owner_id = %5$L::uuid) and f.name ilike %2$L limit %3$s)
      ), best as (
        select food_id, min(r) as r from hits group by food_id
      )
      select f.* from best b join foods f using (food_id)
      order by b.r, (lower(f.name) = %4$L) desc, (f.category = '가공식품'), char_length(f.name), f.name
      limit %3$s
    $q$, s || '%', '%' || s || '%', n, s, me);
  end if;
end;
$$;

revoke all on function public.search_foods(text, int) from public, anon;
grant execute on function public.search_foods(text, int) to authenticated;
