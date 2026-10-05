-- 受験票ジェネレーター：デザインのエクスプローラー（フォルダ・サムネイル・ゴミ箱）
-- 何度実行しても安全。

alter table public.juken_presets
  add column if not exists folder text not null default '';

alter table public.juken_presets
  add column if not exists thumb text;

alter table public.juken_presets
  add column if not exists deleted_at timestamptz;

create index if not exists juken_presets_folder_idx
  on public.juken_presets (folder, name);

-- 空のフォルダも残せるようにフォルダ一覧を持つ
create table if not exists public.juken_folders (
  path       text primary key,
  created_at timestamptz not null default now()
);

alter table public.juken_folders enable row level security;

drop policy if exists "jfo_sel" on public.juken_folders;
drop policy if exists "jfo_ins" on public.juken_folders;
drop policy if exists "jfo_upd" on public.juken_folders;
drop policy if exists "jfo_del" on public.juken_folders;

create policy "jfo_sel" on public.juken_folders
  for select to authenticated using (true);

create policy "jfo_ins" on public.juken_folders
  for insert to authenticated with check (true);

create policy "jfo_upd" on public.juken_folders
  for update to authenticated
  using (true) with check (true);

create policy "jfo_del" on public.juken_folders
  for delete to authenticated using (true);

revoke all on public.juken_folders from anon;

grant select, insert, update, delete
  on public.juken_folders to authenticated;

-- 同じ名前でもフォルダが違えば保存できるようにする（名前の一意制約を「フォルダ内・ゴミ箱以外」に変更）
alter table public.juken_presets drop constraint if exists juken_presets_name_key;
create unique index if not exists juken_presets_folder_name_uq
  on public.juken_presets (folder, name) where deleted_at is null;
