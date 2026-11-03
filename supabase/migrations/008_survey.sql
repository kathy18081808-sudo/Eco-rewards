-- Encuesta de evaluación del prototipo EcoRewards (pruebas con personas).
-- Cualquiera puede responder (con o sin cuenta). Solo los administradores pueden leer.

create table if not exists public.survey_responses (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz not null default now(),
  profile_id uuid references public.profiles(id) on delete set null,

  -- Perfil
  age_range text,
  occupation text,
  recycling_frequency text,

  -- Uso de la máquina
  used_machine boolean,
  id_method text,                 -- face | qr | pin | none
  ease_register smallint check (ease_register between 1 and 5),
  ease_identify smallint check (ease_identify between 1 and 5),
  ease_deposit smallint check (ease_deposit between 1 and 5),
  instructions_clarity smallint check (instructions_clarity between 1 and 5),
  detection_correct text,         -- yes | no | not_sure
  app_ease smallint check (app_ease between 1 and 5),
  face_comfort smallint check (face_comfort between 1 and 5),

  -- Valor
  motivation smallint check (motivation between 1 and 5),
  nps smallint check (nps between 0 and 10),
  preferred_places text[],
  preferred_rewards text[],

  -- Comentarios
  liked text,
  improve text,
  problems text,

  consent boolean not null default false,
  constraint survey_consent_required check (consent = true)
);

create index if not exists idx_survey_responses_created_at
  on public.survey_responses(created_at desc);

alter table public.survey_responses enable row level security;

-- Responder: sin cuenta (profile_id vacío) o con cuenta (solo con su propio perfil).
drop policy if exists "Anyone can submit survey" on public.survey_responses;
create policy "Anyone can submit survey"
  on public.survey_responses for insert
  to anon, authenticated
  with check (profile_id is null or profile_id = public.current_profile_id());

-- Leer: solo administradores (para ver resultados desde la app).
drop policy if exists "Admins can read survey" on public.survey_responses;
create policy "Admins can read survey"
  on public.survey_responses for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = public.current_profile_id()
        and profiles.role = 'admin'
    )
  );

-- La regla de inserción llama current_profile_id(); para visitantes sin cuenta devuelve null.
grant execute on function public.current_profile_id() to anon;

grant insert on public.survey_responses to anon, authenticated;
grant select on public.survey_responses to authenticated;
