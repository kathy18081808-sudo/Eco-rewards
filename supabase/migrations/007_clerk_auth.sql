-- Autenticación con Clerk (Supabase "Third-Party Auth").
--
-- Idea: los perfiles conservan su id uuid (así no cambia ninguna tabla relacionada)
-- y se agrega clerk_user_id con el "sub" del token de Clerk.
-- Las reglas RLS usan public.current_profile_id() en lugar de auth.uid().
--
-- Requisitos en Clerk:
--   1) Integración Supabase activada (agrega el claim "role": "authenticated").
--   2) Claim personalizado en el session token: { "email": "{{user.primary_email_address}}" }
-- Requisito en Supabase: Authentication > Third-Party Auth > Clerk (con el dominio de Clerk).

-- 1) Perfiles independientes de auth.users -------------------------------------
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles alter column id set default gen_random_uuid();
alter table public.profiles add column if not exists clerk_user_id text;
create unique index if not exists idx_profiles_clerk_user_id
  on public.profiles(clerk_user_id) where clerk_user_id is not null;

-- 2) Funciones auxiliares ------------------------------------------------------
create or replace function public.clerk_user_id()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'sub', '');
$$;

-- security definer: evita recursión de RLS al consultar profiles desde las propias reglas.
create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profiles where clerk_user_id = public.clerk_user_id();
$$;

revoke all on function public.current_profile_id() from public, anon;
grant execute on function public.current_profile_id() to authenticated, service_role;

-- Devuelve el perfil del usuario de Clerk; lo crea en el primer inicio de sesión.
-- Si ya existía un perfil con el mismo correo (cuenta antigua), lo vincula y conserva sus puntos.
create or replace function public.ensure_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub text := public.clerk_user_id();
  v_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  v_profile public.profiles;
begin
  if v_sub is null then
    raise exception 'No hay sesión de Clerk válida';
  end if;

  select * into v_profile from public.profiles where clerk_user_id = v_sub;
  if found then
    return v_profile;
  end if;

  if v_email is null then
    raise exception 'El token de Clerk no trae el correo. Agrega el claim "email" en Clerk > Sessions.';
  end if;

  update public.profiles
     set clerk_user_id = v_sub
   where lower(email) = v_email
     and clerk_user_id is null
  returning * into v_profile;
  if found then
    return v_profile;
  end if;

  insert into public.profiles (clerk_user_id, email)
  values (v_sub, v_email)
  returning * into v_profile;

  return v_profile;
end;
$$;

revoke all on function public.ensure_profile() from public, anon;
grant execute on function public.ensure_profile() to authenticated;

-- 3) Campos que el usuario NO puede cambiarse a sí mismo -----------------------
-- (puntos, rol, número de cuenta, vínculo con Clerk). Las funciones del servidor sí pueden.
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.points_balance := old.points_balance;
    new.monthly_eco_points := old.monthly_eco_points;
    new.role := old.role;
    new.account_number := old.account_number;
    new.clerk_user_id := old.clerk_user_id;
    new.email := old.email;
  end if;
  return new;
end;
$$;

drop trigger if exists on_profile_protect_fields on public.profiles;
create trigger on_profile_protect_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- 4) Canje de premios en el servidor (antes se hacía desde la app sin permisos) --
create or replace function public.redeem_reward(p_reward_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_cost integer;
  v_balance integer;
  v_code text;
begin
  if v_profile_id is null then
    raise exception 'No hay sesión válida';
  end if;

  select points_cost into v_cost
  from public.rewards
  where id = p_reward_id and is_active = true;
  if not found then
    raise exception 'Premio no encontrado';
  end if;

  select points_balance into v_balance
  from public.profiles
  where id = v_profile_id
  for update;

  if v_balance < v_cost then
    raise exception 'Insufficient points';
  end if;

  v_code := 'ECO-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

  insert into public.transactions (user_id, type, points, description)
  values (v_profile_id, 'redemption', -v_cost, 'Reward redeemed');

  update public.profiles
     set points_balance = points_balance - v_cost
   where id = v_profile_id;

  insert into public.redemptions (user_id, reward_id, points_spent, redemption_code)
  values (v_profile_id, p_reward_id, v_cost, v_code);

  return v_code;
end;
$$;

revoke all on function public.redeem_reward(uuid) from public, anon;
grant execute on function public.redeem_reward(uuid) to authenticated;

-- 5) Reglas RLS con el usuario de Clerk ----------------------------------------
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using (id = public.current_profile_id());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (id = public.current_profile_id())
  with check (id = public.current_profile_id());

drop policy if exists "Users can view own transactions" on public.transactions;
create policy "Users can view own transactions"
  on public.transactions for select
  to authenticated
  using (user_id = public.current_profile_id());

drop policy if exists "Users can view own redemptions" on public.redemptions;
create policy "Users can view own redemptions"
  on public.redemptions for select
  to authenticated
  using (user_id = public.current_profile_id());

drop policy if exists "Users can view own recycling sessions" on public.recycling_sessions;
create policy "Users can view own recycling sessions"
  on public.recycling_sessions for select
  to authenticated
  using (user_id = public.current_profile_id());

drop policy if exists "Users can create own recycling sessions" on public.recycling_sessions;
create policy "Users can create own recycling sessions"
  on public.recycling_sessions for insert
  to authenticated
  with check (user_id = public.current_profile_id());

drop policy if exists "Users can cancel own recycling sessions" on public.recycling_sessions;
create policy "Users can cancel own recycling sessions"
  on public.recycling_sessions for update
  to authenticated
  using (user_id = public.current_profile_id())
  with check (user_id = public.current_profile_id() and status = 'cancelled');

drop policy if exists "Admins can create machines" on public.machines;
create policy "Admins can create machines"
  on public.machines for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = public.current_profile_id()
        and profiles.role = 'admin'
    )
    and created_by = public.current_profile_id()
  );

drop policy if exists "Admins can update machines" on public.machines;
create policy "Admins can update machines"
  on public.machines for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = public.current_profile_id()
        and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = public.current_profile_id()
        and profiles.role = 'admin'
    )
  );

drop policy if exists "Anyone authenticated can view active rewards" on public.rewards;
create policy "Anyone authenticated can view active rewards"
  on public.rewards for select
  to authenticated
  using (true);

-- Reconocimiento facial (migración 006), si ya existe la tabla
do $$
begin
  if to_regclass('public.face_embeddings') is not null then
    execute 'drop policy if exists "Users can view own face embeddings" on public.face_embeddings';
    execute 'create policy "Users can view own face embeddings" on public.face_embeddings
             for select to authenticated using (user_id = public.current_profile_id())';
    execute 'drop policy if exists "Users can delete own face embeddings" on public.face_embeddings';
    execute 'create policy "Users can delete own face embeddings" on public.face_embeddings
             for delete to authenticated using (user_id = public.current_profile_id())';
  end if;
end;
$$;
