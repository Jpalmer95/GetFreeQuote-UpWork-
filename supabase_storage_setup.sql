-- Supabase Storage Buckets Setup
-- Run this in the Supabase SQL Editor after the main schema

-- Create storage buckets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('job-attachments', 'job-attachments', true, 10485760, array['image/jpeg','image/png','image/webp','image/gif','application/pdf']),
  ('vendor-assets', 'vendor-assets', true, 10485760, array['image/jpeg','image/png','image/webp','image/gif']),
  ('community-images', 'community-images', true, 10485760, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

-- Storage policies for job-attachments
create policy "Authenticated users can upload job attachments"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'job-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Anyone can view job attachments"
  on storage.objects for select
  to public
  using (bucket_id = 'job-attachments');

create policy "Users can delete own job attachments"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'job-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

-- Storage policies for vendor-assets
create policy "Authenticated users can upload vendor assets"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'vendor-assets' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Anyone can view vendor assets"
  on storage.objects for select
  to public
  using (bucket_id = 'vendor-assets');

create policy "Users can delete own vendor assets"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'vendor-assets' and (storage.foldername(name))[1] = auth.uid()::text);

-- Storage policies for community-images
create policy "Authenticated users can upload community images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'community-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Anyone can view community images"
  on storage.objects for select
  to public
  using (bucket_id = 'community-images');

create policy "Users can delete own community images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'community-images' and (storage.foldername(name))[1] = auth.uid()::text);
