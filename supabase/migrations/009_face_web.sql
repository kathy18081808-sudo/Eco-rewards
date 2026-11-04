-- Reconocimiento facial 100% web.
-- - Cada usuario registra su rostro desde la app (vectores face-api.js de 128 valores, nunca fotos).
-- - La página /kiosko envía el vector de la cara que ve la webcam; la comparación se hace AQUÍ,
--   en el servidor, para que los datos faciales nunca lleguen al navegador del kiosko.
-- - El kiosko se identifica con el código de la máquina + una clave (tabla machine_kiosk_keys).

-- 1) Tipo de modelo de cada vector (los del programa Python eran 'sface') -----------
alter table public.face_embeddings
  add column if not exists model text not null default 'sface';

-- El usuario puede guardar sus propios vectores (desde la app).
drop policy if exists "Users can add own face embeddings" on public.face_embeddings;
create policy "Users can add own face embeddings"
  on public.face_embeddings for insert
  to authenticated
  with check (user_id = public.current_profile_id());

grant select, insert, delete on public.face_embeddings to authenticated;

-- 2) Clave del kiosko por máquina ----------------------------------------------------
-- Tabla aparte con RLS y sin reglas: la app no puede leerla; solo el panel de Supabase
-- y las funciones del servidor (security definer).
create table if not exists public.machine_kiosk_keys (
  machine_id uuid primary key references public.machines(id) on delete cascade,
  kiosk_key text not null,
  created_at timestamptz not null default now()
);

alter table public.machine_kiosk_keys enable row level security;
revoke all on public.machine_kiosk_keys from anon, authenticated;

insert into public.machine_kiosk_keys (machine_id, kiosk_key)
select id, upper(substr(md5(random()::text || clock_timestamp()::text || id::text), 1, 10))
  from public.machines
on conflict (machine_id) do nothing;

create or replace function public.kiosk_machine(p_code text, p_key text)
returns public.machines
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_machine public.machines;
begin
  select m.* into v_machine
  from public.machines m
  join public.machine_kiosk_keys k on k.machine_id = m.id
  where m.machine_code = upper(trim(p_code))
    and k.kiosk_key = upper(trim(p_key))
    and m.is_active = true;
  if not found then
    raise exception 'Código de máquina o clave del kiosko incorrectos';
  end if;
  return v_machine;
end;
$$;

revoke all on function public.kiosk_machine(text, text) from public, anon, authenticated;

-- 3) Estado de la máquina para la pantalla del kiosko --------------------------------
create or replace function public.kiosk_status(p_code text, p_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_machine public.machines := public.kiosk_machine(p_code, p_key);
  v_session record;
begin
  select s.id, s.source, s.expires_at, s.items_processed, s.user_id,
         coalesce(nullif(trim(p.alias), ''), nullif(trim(p.full_name), ''), 'Reciclador') as display_name,
         p.points_balance
    into v_session
    from public.recycling_sessions s
    join public.profiles p on p.id = s.user_id
   where s.machine_id = v_machine.id
     and s.status = 'armed'
     and s.expires_at > now()
   order by s.armed_at desc
   limit 1;

  if not found then
    return jsonb_build_object(
      'machine_name', v_machine.name,
      'machine_code', v_machine.machine_code,
      'session', null
    );
  end if;

  return jsonb_build_object(
    'machine_name', v_machine.name,
    'machine_code', v_machine.machine_code,
    'session', jsonb_build_object(
      'id', v_session.id,
      'source', v_session.source,
      'display_name', v_session.display_name,
      'points_balance', v_session.points_balance,
      'items', v_session.items_processed,
      'expires_at', v_session.expires_at,
      'user_ref', md5(v_session.user_id::text)
    )
  );
end;
$$;

-- 4) Identificar una cara y abrir la sesión ------------------------------------------
create or replace function public.kiosk_identify(
  p_code text,
  p_key text,
  p_descriptor double precision[],
  p_ignore_user_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_machine public.machines := public.kiosk_machine(p_code, p_key);
  v_threshold constant double precision := 0.45;  -- distancia máxima aceptada (face-api.js; menor = más estricto)
  v_user uuid;
  v_distance double precision;
begin
  if coalesce(array_length(p_descriptor, 1), 0) <> 128 then
    raise exception 'Vector facial inválido';
  end if;

  -- Si ya hay una sesión abierta en esta máquina, no se abre otra.
  if exists (
    select 1 from public.recycling_sessions
    where machine_id = v_machine.id and status = 'armed' and expires_at > now()
  ) then
    return jsonb_build_object('matched', false, 'busy', true) || public.kiosk_status(p_code, p_key);
  end if;

  select t.user_id, t.distance
    into v_user, v_distance
    from (
      select fe.user_id, sqrt(sum((a.x - b.x) ^ 2)) as distance
        from public.face_embeddings fe,
             lateral unnest(fe.embedding) with ordinality as a(x, i),
             lateral unnest(p_descriptor) with ordinality as b(x, i)
       where fe.model = 'faceapi'
         and a.i = b.i
       group by fe.id, fe.user_id
    ) t
   where p_ignore_user_ref is null or md5(t.user_id::text) <> p_ignore_user_ref
   order by t.distance
   limit 1;

  if v_user is null or v_distance > v_threshold then
    return jsonb_build_object('matched', false, 'distance', v_distance);
  end if;

  update public.recycling_sessions
     set status = 'cancelled'
   where status = 'armed'
     and (user_id = v_user or machine_id = v_machine.id);

  insert into public.recycling_sessions (machine_id, user_id, status, source, expires_at)
  values (v_machine.id, v_user, 'armed', 'face', now() + interval '60 seconds');

  return jsonb_build_object('matched', true, 'distance', v_distance) || public.kiosk_status(p_code, p_key);
end;
$$;

-- 5) Terminar la sesión desde el kiosko ----------------------------------------------
create or replace function public.kiosk_end(p_code text, p_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_machine public.machines := public.kiosk_machine(p_code, p_key);
begin
  update public.recycling_sessions
     set status = 'completed'
   where machine_id = v_machine.id
     and status = 'armed';
end;
$$;

revoke all on function public.kiosk_status(text, text) from public;
revoke all on function public.kiosk_identify(text, text, double precision[], text) from public;
revoke all on function public.kiosk_end(text, text) from public;
grant execute on function public.kiosk_status(text, text) to anon, authenticated;
grant execute on function public.kiosk_identify(text, text, double precision[], text) to anon, authenticated;
grant execute on function public.kiosk_end(text, text) to anon, authenticated;
