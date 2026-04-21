alter table public.reward_redemptions
  add column if not exists admin_message text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by text;
