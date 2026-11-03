-- SlimLog 005 · 약 기준 정보 시드 + 주사 부위 값 보완 (비파괴)
-- 1) doses.site: 화면은 배 왼쪽/오른쪽을 구분한다 → 허용 값에 추가 (기존 값은 그대로 허용)
alter table public.doses drop constraint if exists doses_site_check;
alter table public.doses add constraint doses_site_check
  check (site in ('abdomen', 'abdomen_left', 'abdomen_right', 'thigh_left', 'thigh_right', 'arm_left', 'arm_right', 'thigh', 'arm'));

-- 2) medications 시드 — 값과 출처는 src/fixtures/medications.mock.ts 와 같다 (허가자료에서 확인한 값만, 없으면 null)
--    verified = 'secondary': 보도·안내 자료로 확인, 의약품안전나라 원문 대조 필요
insert into public.medications (med_id, name, ingredient, half_life_h, pk_params, dose_options, sites, source, verified) values
('mounjaro', '마운자로', '터제파타이드', 120,
 '{"half_life_h": {"value": 120, "text": "약 5일", "source": "https://medical.lilly.com/us/products/answers/what-is-the-half-life-of-mounjaro-tirzepatide-311137"},
   "bioavailability": {"value": 0.8, "text": "80%", "source": "https://medlibrary.org/lib/rx/meds/mounjaro/page/4/"},
   "tmax_h": {"value": [8, 72], "text": "8~72시간", "source": "https://medlibrary.org/lib/rx/meds/mounjaro/page/4/"},
   "ka": null}'::jsonb,
 array[2.5, 5, 7.5, 10, 12.5, 15], array['abdomen', 'thigh', 'upper_arm'],
 'https://www.dailypharm.com/user/news/2409', 'secondary'),
('wegovy', '위고비', '세마글루타이드', 168,
 '{"half_life_h": {"value": 168, "text": "약 1주", "source": "https://trial.medpath.com/drug/approvals/fda/712ad53e4899f372"},
   "bioavailability": {"value": 0.89, "text": "89%", "source": "https://medlibrary.org/lib/rx/meds/wegovy/page/7/"},
   "tmax_h": {"value": [24, 72], "text": "1~3일", "source": "https://medlibrary.org/lib/rx/meds/wegovy/page/7/"},
   "ka": null}'::jsonb,
 array[0.25, 0.5, 1, 1.7, 2.4], array['abdomen', 'thigh', 'upper_arm'],
 'https://kormedi.com/1586984/', 'secondary'),
('efpe', '에페', '에페글레나타이드', null,
 '{"half_life_h": null, "bioavailability": null,
   "tmax_h": {"value": [0, 95], "text": "항정상태 0~95시간(중앙값 48시간) — 단회 투여 값 아님, 곡선에 사용 안 함", "source": "https://nedrug.mfds.go.kr/pbp/CCBBB01/getItemDetailCache?cacheSeq=202603059aupdateTs2026-10-20+08%3A11%3A12.723686b"},
   "ka": null}'::jsonb,
 array[2, 4, 6, 8, 10], array['abdomen'],
 'https://nedrug.mfds.go.kr/pbp/CCBBB01/getItemDetailCache?cacheSeq=202603059aupdateTs2026-10-20+08%3A11%3A12.723686b', 'secondary')
on conflict (med_id) do update set
  name = excluded.name, ingredient = excluded.ingredient, half_life_h = excluded.half_life_h, pk_params = excluded.pk_params,
  dose_options = excluded.dose_options, sites = excluded.sites, source = excluded.source, verified = excluded.verified, updated_at = now();
