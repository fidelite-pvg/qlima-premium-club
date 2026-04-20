create table if not exists public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  email text,
  reward_title text not null,
  reward_type text not null default 'standard',
  points_used integer not null check (points_used > 0),
  status text not null default 'pending',
  rib text,
  iban text,
  bank_account_holder text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.reward_redemptions enable row level security;

drop policy if exists "Users can view their reward redemptions" on public.reward_redemptions;
create policy "Users can view their reward redemptions"
  on public.reward_redemptions
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their reward redemptions" on public.reward_redemptions;
create policy "Users can create their reward redemptions"
  on public.reward_redemptions
  for insert
  with check (auth.uid() = user_id);

create or replace function public.set_reward_redemptions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_reward_redemptions_updated_at on public.reward_redemptions;
create trigger trg_reward_redemptions_updated_at
before update on public.reward_redemptions
for each row
execute function public.set_reward_redemptions_updated_at();