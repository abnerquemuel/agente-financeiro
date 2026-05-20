create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  cpf text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.finance_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"monthlyGoals": {}, "selectedMonth": "", "expenses": []}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.finance_data enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can create own profile" on public.profiles;
drop policy if exists "Users can read own finance data" on public.finance_data;
drop policy if exists "Users can create own finance data" on public.finance_data;
drop policy if exists "Users can update own finance data" on public.finance_data;

create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "Users can create own profile"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "Users can read own finance data"
on public.finance_data
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create own finance data"
on public.finance_data
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own finance data"
on public.finance_data
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
