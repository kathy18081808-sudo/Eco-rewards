-- Machine registry and QR-armed recycling sessions.
-- After applying this migration, promote the first operator manually:
-- update public.profiles set role = 'admin' where email = 'operator@example.com';

alter table public.profiles
  add column if not exists role text not null default 'user'
  check (role in ('user', 'admin'));

create table if not exists public.machines (
  id uuid default gen_random_uuid() primary key,
  machine_code text not null unique,
  name text not null,
  location text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint machines_machine_code_not_blank check (btrim(machine_code) <> ''),
  constraint machines_name_not_blank check (btrim(name) <> '')
);

create table if not exists public.recycling_sessions (
  id uuid default gen_random_uuid() primary key,
  machine_id uuid references public.machines(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  status text not null default 'armed'
    check (status in ('armed', 'completed', 'expired', 'cancelled')),
  source text not null default 'qr' check (source in ('qr', 'keypad')),
  armed_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '60 seconds'),
  items_processed integer not null default 0 check (items_processed >= 0),
  last_item_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.transactions
  add column if not exists machine_id uuid references public.machines(id) on delete set null,
  add column if not exists session_id uuid references public.recycling_sessions(id) on delete set null;

create index if not exists idx_machines_machine_code
  on public.machines(machine_code);

create index if not exists idx_machines_active
  on public.machines(is_active)
  where is_active = true;

create unique index if not exists idx_recycling_sessions_one_armed_per_user
  on public.recycling_sessions(user_id)
  where status = 'armed';

create unique index if not exists idx_recycling_sessions_one_armed_per_machine
  on public.recycling_sessions(machine_id)
  where status = 'armed';

create index if not exists idx_recycling_sessions_machine_status_expires
  on public.recycling_sessions(machine_id, status, expires_at desc);

create index if not exists idx_transactions_machine_id
  on public.transactions(machine_id);

create index if not exists idx_transactions_session_id
  on public.transactions(session_id);

drop trigger if exists on_machine_updated on public.machines;
create trigger on_machine_updated
  before update on public.machines
  for each row execute function public.handle_updated_at();

drop trigger if exists on_recycling_session_updated on public.recycling_sessions;
create trigger on_recycling_session_updated
  before update on public.recycling_sessions
  for each row execute function public.handle_updated_at();

alter table public.machines enable row level security;
alter table public.recycling_sessions enable row level security;

drop policy if exists "Authenticated users can view active machines" on public.machines;
create policy "Authenticated users can view active machines"
  on public.machines for select
  to authenticated
  using (is_active = true);

drop policy if exists "Admins can create machines" on public.machines;
create policy "Admins can create machines"
  on public.machines for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
    and created_by = auth.uid()
  );

drop policy if exists "Admins can update machines" on public.machines;
create policy "Admins can update machines"
  on public.machines for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

drop policy if exists "Users can view own recycling sessions" on public.recycling_sessions;
create policy "Users can view own recycling sessions"
  on public.recycling_sessions for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create own recycling sessions" on public.recycling_sessions;
create policy "Users can create own recycling sessions"
  on public.recycling_sessions for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can cancel own recycling sessions" on public.recycling_sessions;
create policy "Users can cancel own recycling sessions"
  on public.recycling_sessions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and status = 'cancelled');

alter publication supabase_realtime add table public.machines;
alter publication supabase_realtime add table public.recycling_sessions;
