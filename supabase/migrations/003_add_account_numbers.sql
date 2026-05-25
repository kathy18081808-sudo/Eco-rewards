create sequence if not exists public.account_number_seq
  start 100001
  increment 1;

alter table public.profiles
  add column if not exists account_number text;

create or replace function public.assign_account_number()
returns trigger as $$
begin
  if new.account_number is null or btrim(new.account_number) = '' then
    new.account_number := lpad(nextval('public.account_number_seq')::text, 6, '0');
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_profile_account_number on public.profiles;

create trigger on_profile_account_number
  before insert on public.profiles
  for each row execute function public.assign_account_number();

update public.profiles
set account_number = lpad(nextval('public.account_number_seq')::text, 6, '0')
where account_number is null or btrim(account_number) = '';

create unique index if not exists idx_profiles_account_number
  on public.profiles(account_number);
