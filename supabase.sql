-- 受験票ジェネレーター：共有デザイン（プリセット）テーブル
-- WAVE と同じ Supabase プロジェクトの SQL Editor で1回だけ実行する。
-- 名簿（個人情報）はここには保存しない。デザイン設定のみ。

create table if not exists public.juken_presets (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  template    text not null,
  data        jsonb not null default '{}'::jsonb,
  updated_by  uuid default auth.uid(),
  updated_at  timestamptz not null default now()
);

alter table public.juken_presets enable row level security;

-- ログイン済み（WAVEのスタッフアカウント）だけ読み書き可
drop policy if exists "juken_presets_select" on public.juken_presets;
drop policy if exists "juken_presets_insert" on public.juken_presets;
drop policy if exists "juken_presets_update" on public.juken_presets;
drop policy if exists "juken_presets_delete" on public.juken_presets;

create policy "juken_presets_select" on public.juken_presets for select to authenticated using (true);
create policy "juken_presets_insert" on public.juken_presets for insert to authenticated with check (true);
create policy "juken_presets_update" on public.juken_presets for update to authenticated using (true) with check (true);
create policy "juken_presets_delete" on public.juken_presets for delete to authenticated using (true);

-- 匿名キーでは一切触れない
revoke all on public.juken_presets from anon;
grant select, insert, update, delete on public.juken_presets to authenticated;
