-- Reconocimiento facial para la máquina EcoRewards.
-- Guarda solo vectores numéricos (embeddings SFace de 128 valores), nunca fotos.

-- 1) Permitir sesiones iniciadas por reconocimiento facial
alter table public.recycling_sessions
  drop constraint if exists recycling_sessions_source_check;

alter table public.recycling_sessions
  add constraint recycling_sessions_source_check
  check (source in ('qr', 'keypad', 'face'));

-- 2) Consentimiento biométrico en el perfil
alter table public.profiles
  add column if not exists face_consent_at timestamptz;

-- 3) Vectores faciales (varias muestras por usuario)
create table if not exists public.face_embeddings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  embedding double precision[] not null,
  created_at timestamptz not null default now(),
  constraint face_embeddings_dim check (array_length(embedding, 1) = 128)
);

create index if not exists idx_face_embeddings_user_id
  on public.face_embeddings(user_id);

alter table public.face_embeddings enable row level security;

-- El usuario puede ver y borrar sus propios datos faciales.
-- El kiosko (laptop) usa la service role key, que salta RLS.
drop policy if exists "Users can view own face embeddings" on public.face_embeddings;
create policy "Users can view own face embeddings"
  on public.face_embeddings for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own face embeddings" on public.face_embeddings;
create policy "Users can delete own face embeddings"
  on public.face_embeddings for delete
  to authenticated
  using (auth.uid() = user_id);
