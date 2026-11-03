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
