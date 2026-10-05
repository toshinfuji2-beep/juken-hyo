-- 受験票ジェネレーター：ファイル保管（受験票PDF・画像素材・資料）
-- 何度実行しても安全。ログイン済みスタッフのみ読み書き可。

insert into storage.buckets (id, name, public, file_size_limit)
values ('juken-files', 'juken-files', false, 52428800)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit;

drop policy if exists "jf_obj_sel" on storage.objects;
drop policy if exists "jf_obj_ins" on storage.objects;
drop policy if exists "jf_obj_upd" on storage.objects;
drop policy if exists "jf_obj_del" on storage.objects;

create policy "jf_obj_sel" on storage.objects
  for select to authenticated
  using (bucket_id = 'juken-files');

create policy "jf_obj_ins" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'juken-files');

create policy "jf_obj_upd" on storage.objects
  for update to authenticated
  using (bucket_id = 'juken-files')
  with check (bucket_id = 'juken-files');

create policy "jf_obj_del" on storage.objects
  for delete to authenticated
  using (bucket_id = 'juken-files');

create table if not exists public.juken_files (
  id          uuid primary key default gen_random_uuid(),
  path        text not null unique,
  name        text not null,
  kind        text not null
              check (kind in ('pdf', 'image', 'doc')),
  folder      text not null default '',
  mime        text,
  size        bigint,
  note        text not null default '',
  uploaded_by uuid default auth.uid(),
  created_at  timestamptz not null default now()
);

create index if not exists juken_files_folder_idx
  on public.juken_files (folder, created_at desc);

alter table public.juken_files enable row level security;

drop policy if exists "jf_sel" on public.juken_files;
drop policy if exists "jf_ins" on public.juken_files;
drop policy if exists "jf_upd" on public.juken_files;
drop policy if exists "jf_del" on public.juken_files;

create policy "jf_sel" on public.juken_files
  for select to authenticated using (true);

create policy "jf_ins" on public.juken_files
  for insert to authenticated with check (true);

create policy "jf_upd" on public.juken_files
  for update to authenticated
  using (true) with check (true);

create policy "jf_del" on public.juken_files
  for delete to authenticated using (true);

revoke all on public.juken_files from anon;

grant select, insert, update, delete
  on public.juken_files to authenticated;
