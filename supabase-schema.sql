-- DesignLab Task Tracker v2.1.0 — permanent owner login
-- Run this entire file in Supabase Dashboard → SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  legacy_task_id text,
  task_date date not null,
  time_slot time,
  task_name text not null check (char_length(task_name) between 1 and 180),
  category text not null default 'WORK',
  urgency text not null default 'Low Priority',
  status text not null default 'Pending',
  remarks text not null default '',
  sort_order numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint tasks_category_check check (category in ('PERSONAL','PAGE','BUSINESS','WORK','LEISURE')),
  constraint tasks_urgency_check check (urgency in ('Today’s Priority','High Priority','Weekly Task','Daily Task','Low Priority')),
  constraint tasks_status_check check (status in ('Pending','In Progress','Completed','Cancelled')),
  constraint tasks_user_legacy_unique unique (user_id, legacy_task_id)
);

create index if not exists tasks_user_date_idx on public.tasks (user_id, task_date);
create index if not exists tasks_user_status_idx on public.tasks (user_id, status);
create index if not exists tasks_user_updated_idx on public.tasks (user_id, updated_at desc);

create or replace function public.set_task_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at is not distinct from old.updated_at then
    new.updated_at = now();
  end if;

  if new.status = 'Completed' then
    if tg_op = 'INSERT' then
      new.completed_at = coalesce(new.completed_at, now());
    elsif old.status is distinct from 'Completed' then
      new.completed_at = coalesce(new.completed_at, now());
    end if;
  else
    new.completed_at = null;
  end if;

  return new;
end;
$$;

drop trigger if exists set_task_updated_at on public.tasks;
create trigger set_task_updated_at
before insert or update on public.tasks
for each row execute function public.set_task_updated_at();

alter table public.tasks enable row level security;

-- The frontend signs in with one permanent owner account. Supabase stores the session
-- in the browser, while auth.uid() keeps every task tied to that permanent Auth user.
-- Disable public signups and anonymous sign-ins after creating the owner account.

-- Recreate policies safely when rerunning this setup.
drop policy if exists "Users can read their own tasks" on public.tasks;
drop policy if exists "Users can create their own tasks" on public.tasks;
drop policy if exists "Users can update their own tasks" on public.tasks;
drop policy if exists "Users can delete their own tasks" on public.tasks;

create policy "Users can read their own tasks"
on public.tasks for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can create their own tasks"
on public.tasks for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can update their own tasks"
on public.tasks for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can delete their own tasks"
on public.tasks for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

-- Required for the simple Postgres Changes subscription used by the frontend.
-- If the table is already in the publication, Supabase may report it as a duplicate;
-- that message can be safely ignored.
do $$
begin
  alter publication supabase_realtime add table public.tasks;
exception
  when duplicate_object then null;
end $$;
