-- El botón "Activar con mi rostro" deja una petición. El script de la máquina
-- la lee, compara el rostro de la webcam con los vectores de face-api (128)
-- y abre la sesión. Las reglas usan current_profile_id() por Clerk.

create table if not exists public.face_requests (
  id uuid default gen_random_uuid() primary key,
  machine_id uuid references public.machines(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  status text not null default 'pending'
    check (status in ('pending', 'matched', 'failed', 'expired')),
  session_id uuid references public.recycling_sessions(id) on delete set null,
  error text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 seconds'),
  updated_at timestamptz not null default now()
);

create index if not exists idx_face_requests_machine_status
  on public.face_requests(machine_id, status, created_at);

create unique index if not exists idx_face_requests_one_pending_per_user
  on public.face_requests(user_id)
  where status = 'pending';

alter table public.face_requests add column if not exists session_id uuid references public.recycling_sessions(id) on delete set null;
alter table public.face_requests add column if not exists error text;
alter table public.face_requests add column if not exists expires_at timestamptz not null default (now() + interval '90 seconds');
alter table public.face_requests add column if not exists updated_at timestamptz not null default now();

drop trigger if exists on_face_request_updated on public.face_requests;
create trigger on_face_request_updated
  before update on public.face_requests
  for each row execute function public.handle_updated_at();

alter table public.face_requests enable row level security;

drop policy if exists "Users can view own face requests" on public.face_requests;
create policy "Users can view own face requests"
  on public.face_requests for select
  to authenticated
  using (user_id = public.current_profile_id());

drop policy if exists "Users can create own face requests" on public.face_requests;
create policy "Users can create own face requests"
  on public.face_requests for insert
  to authenticated
  with check (
    user_id = public.current_profile_id()
    and status = 'pending'
    and session_id is null
    and exists (
      select 1 from public.machines
      where machines.id = machine_id and machines.is_active = true
    )
  );

drop policy if exists "Users can delete own pending face requests" on public.face_requests;
create policy "Users can delete own pending face requests"
  on public.face_requests for delete
  to authenticated
  using (user_id = public.current_profile_id() and status = 'pending');

grant select, insert, delete on public.face_requests to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.face_requests;
exception
  when duplicate_object then null;
end $$;
