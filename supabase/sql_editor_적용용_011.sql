-- SlimLog 마이그레이션 011 (에페 반감기) — 010 적용한 클라우드에 이어서 Run
begin;
-- SlimLog 011 · 에페 반감기 추가 (비파괴)
-- 허가자료에서 반감기 수치를 못 찾아, 2상 약동학 논문(Yoon et al. 2020, DOM)의 135~180시간 중간값 157.5시간을 쓴다.
-- 출처: https://pmc.ncbi.nlm.nih.gov/articles/PMC7383501
update public.medications
set half_life_h = 157.5,
    pk_params = jsonb_set(coalesce(pk_params, '{}'::jsonb), '{half_life_h}',
      '{"value": 157.5, "text": "약 6~7일 (135~180시간)", "source": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7383501"}'::jsonb),
    updated_at = now()
where med_id = 'efpe';
commit;
