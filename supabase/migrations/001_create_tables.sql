-- Profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  alias text,
  full_name text,
  age integer,
  date_of_birth date,
  avatar_url text,
  points_balance integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Transactions table
create table if not exists public.transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null check (type in ('bottle', 'can', 'redemption')),
  points integer not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

-- Rewards table
create table if not exists public.rewards (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text not null default '',
  image_url text not null default '',
  points_cost integer not null check (points_cost >= 200),
  category text not null check (category in ('coffee', 'food', 'drinks', 'snacks')),
  brand text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Redemptions table
create table if not exists public.redemptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  reward_id uuid references public.rewards(id) not null,
  points_spent integer not null,
  redemption_code text not null,
  redeemed_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_transactions_user_id on public.transactions(user_id);
create index if not exists idx_transactions_created_at on public.transactions(created_at desc);
create index if not exists idx_rewards_active on public.rewards(is_active) where is_active = true;
create index if not exists idx_redemptions_user_id on public.redemptions(user_id);

-- Auto-update updated_at on profiles
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_profile_updated
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.transactions enable row level security;
alter table public.rewards enable row level security;
alter table public.redemptions enable row level security;

-- RLS Policies: profiles
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- RLS Policies: transactions
create policy "Users can view own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);

-- RLS Policies: rewards
create policy "Anyone authenticated can view active rewards"
  on public.rewards for select
  using (auth.role() = 'authenticated');

-- RLS Policies: redemptions
create policy "Users can view own redemptions"
  on public.redemptions for select
  using (auth.uid() = user_id);

-- Enable realtime for profiles and transactions
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.transactions;
