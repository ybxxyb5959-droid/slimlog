-- 011 되돌리기 (필요할 때만). AI 이름만 있고 food_id 가 없는 예측 행은 not null 복구 전에 지워야 하므로 개수를 먼저 확인할 것:
--   select count(*) from predictions where predicted_food_id is null;
begin;
alter table public.consents drop constraint if exists consents_type_check;
delete from public.consents where type = 'food_ai';
alter table public.consents add constraint consents_type_check
  check (type in ('terms', 'privacy', 'sensitive', 'photo_improve', 'marketing'));
drop table if exists public.ai_requests;
alter table public.predictions drop constraint if exists predictions_food_or_name;
delete from public.predictions where predicted_food_id is null;
alter table public.predictions alter column predicted_food_id set not null;
alter table public.predictions drop column if exists needs_review, drop column if exists confidence,
  drop column if exists portion_text, drop column if exists servings, drop column if exists predicted_name;
commit;
