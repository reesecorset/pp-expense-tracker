create table if not exists public.expense_records (
  id text primary key,
  user_id uuid not null default auth.uid(),
  encrypted_payload text not null,
  iv text not null,
  updated_at timestamptz not null default now()
);

alter table public.expense_records enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.expense_records to anon, authenticated;

drop policy if exists "Users can read their encrypted records" on public.expense_records;
create policy "Users can read their encrypted records"
  on public.expense_records
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their encrypted records" on public.expense_records;
create policy "Users can insert their encrypted records"
  on public.expense_records
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their encrypted records" on public.expense_records;
create policy "Users can update their encrypted records"
  on public.expense_records
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their encrypted records" on public.expense_records;
create policy "Users can delete their encrypted records"
  on public.expense_records
  for delete
  using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_expense_records_updated_at on public.expense_records;
create trigger set_expense_records_updated_at
  before update on public.expense_records
  for each row
  execute function public.set_updated_at();
