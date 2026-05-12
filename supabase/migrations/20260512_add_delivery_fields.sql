alter table public.reward_redemptions
  add column if not exists reward_code text,
  add column if not exists serial_number text,
  add column if not exists warranty_confirmed boolean default false,
  add column if not exists supporting_documents jsonb,
  add column if not exists delivery_first_name text,
  add column if not exists delivery_last_name text,
  add column if not exists delivery_email text,
  add column if not exists delivery_phone text,
  add column if not exists delivery_address text,
  add column if not exists delivery_postal_code text,
  add column if not exists delivery_city text;
