alter table public.loyalty_submissions
  add column if not exists client_has_unread_update boolean not null default false,
  add column if not exists client_last_update_at timestamptz;

create index if not exists idx_loyalty_submissions_client_has_unread_update
  on public.loyalty_submissions (client_has_unread_update);

create index if not exists idx_loyalty_submissions_client_last_update_at
  on public.loyalty_submissions (client_last_update_at desc);
