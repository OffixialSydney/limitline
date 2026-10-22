-- Limitline initial schema. Run in the Supabase SQL Editor, or with `supabase db push`.
-- All tables have Row Level Security enabled. Every policy is scoped to auth.uid().

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- helpers
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 80),
  preferred_currency char(3) not null default 'USD' check (preferred_currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'UTC',
  locale text not null default 'en-US',
  warning_threshold_pct integer not null default 80 check (warning_threshold_pct between 1 and 99),
  stale_after_hours integer not null default 48 check (stale_after_hours between 1 and 720),
  notify_in_app boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(left(new.raw_user_meta_data ->> 'display_name', 80), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- challenges
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  firm_name text not null check (char_length(firm_name) between 1 and 80),
  account_currency char(3) not null check (account_currency ~ '^[A-Z]{3}$'),
  starting_balance numeric(18,2) not null check (starting_balance > 0),
  current_phase text not null default 'phase_1'
    check (current_phase in ('phase_1','phase_2','phase_3','funded','other')),
  status text not null default 'active' check (status in ('active','passed','failed','archived')),
  archived_from_status text check (archived_from_status in ('active','passed','failed')),
  start_date date not null,
  deadline date,
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (deadline is null or deadline >= start_date)
);
create index challenges_user_status_idx on public.challenges (user_id, status);
create trigger challenges_updated_at before update on public.challenges
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- challenge_rules
-- configuration is validated by the application (src/lib/validation/rules.ts) before writes.
create table public.challenge_rules (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  rule_type text not null
    check (rule_type in ('profit_target','daily_loss','overall_loss','trading_days','consistency')),
  configuration jsonb not null check (jsonb_typeof(configuration) = 'object'),
  source_reference text check (source_reference is null or char_length(source_reference) <= 500),
  version integer not null default 1 check (version >= 1),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (challenge_id, rule_type)
);
create trigger challenge_rules_updated_at before update on public.challenge_rules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- trades
create table public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  instrument text not null check (char_length(instrument) between 1 and 40),
  direction text not null check (direction in ('long','short')),
  entry_time timestamptz not null,
  exit_time timestamptz,
  entry_price numeric(24,8) check (entry_price is null or entry_price > 0),
  exit_price numeric(24,8) check (exit_price is null or exit_price > 0),
  stop_loss numeric(24,8) check (stop_loss is null or stop_loss > 0),
  take_profit numeric(24,8) check (take_profit is null or take_profit > 0),
  position_size numeric(18,4) check (position_size is null or position_size > 0),
  gross_pnl numeric(18,2),
  costs numeric(18,2) check (costs is null or costs >= 0),
  net_pnl numeric(18,2),
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (exit_time is null or exit_time >= entry_time)
);
create index trades_user_entry_idx on public.trades (user_id, entry_time desc);
create index trades_challenge_entry_idx on public.trades (challenge_id, entry_time desc);
create trigger trades_updated_at before update on public.trades
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- balance_events
create table public.balance_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  event_type text not null check (event_type in ('deposit','withdrawal','fee','credit','adjustment')),
  amount numeric(18,2) not null check (amount <> 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  occurred_at timestamptz not null,
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  -- deposits, withdrawals, fees and credits are entered as positive amounts; only adjustments are signed
  check (event_type = 'adjustment' or amount > 0)
);
create index balance_events_challenge_idx on public.balance_events (challenge_id, occurred_at desc);
create index balance_events_user_idx on public.balance_events (user_id, occurred_at desc);

-- ---------------------------------------------------------------- account_snapshots
create table public.account_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  balance numeric(18,2),
  equity numeric(18,2),
  observed_at timestamptz not null,
  source text not null default 'manual' check (source in ('manual','import','api')),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  check (balance is not null or equity is not null)
);
create index snapshots_challenge_idx on public.account_snapshots (challenge_id, observed_at desc);
create index snapshots_user_idx on public.account_snapshots (user_id, observed_at desc);

-- ---------------------------------------------------------------- trading_days
create table public.trading_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  trading_date date not null,
  status text not null default 'traded' check (status in ('traded','not_counted')),
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  unique (challenge_id, trading_date)
);
create index trading_days_user_idx on public.trading_days (user_id);

-- ---------------------------------------------------------------- notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  challenge_id uuid references public.challenges (id) on delete cascade,
  notification_type text not null check (notification_type in (
    'daily_warning','daily_limit','overall_warning','overall_limit','breach_recorded',
    'target_reached','trading_days_incomplete','deadline_approaching','data_incomplete')),
  severity text not null check (severity in ('info','warning','critical')),
  title text not null check (char_length(title) <= 120),
  message text not null check (char_length(message) <= 600),
  dedupe_key text,
  calculated_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create unique index notifications_dedupe_idx on public.notifications (user_id, dedupe_key)
  where dedupe_key is not null;

-- ---------------------------------------------------------------- audit_logs (append-only for users)
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  challenge_id uuid references public.challenges (id) on delete set null,
  action text not null check (char_length(action) <= 60),
  entity_type text not null check (char_length(entity_type) <= 40),
  entity_id uuid,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);
create index audit_user_idx on public.audit_logs (user_id, created_at desc);
create index audit_challenge_idx on public.audit_logs (challenge_id, created_at desc);

-- ================================================================ Row Level Security
alter table public.profiles enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_rules enable row level security;
alter table public.trades enable row level security;
alter table public.balance_events enable row level security;
alter table public.account_snapshots enable row level security;
alter table public.trading_days enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

-- profiles
create policy profiles_select_own on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- challenges
create policy challenges_select_own on public.challenges for select to authenticated using (user_id = (select auth.uid()));
create policy challenges_insert_own on public.challenges for insert to authenticated with check (user_id = (select auth.uid()));
create policy challenges_update_own on public.challenges for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy challenges_delete_own on public.challenges for delete to authenticated using (user_id = (select auth.uid()));

-- challenge_rules: ownership flows through the parent challenge
create policy rules_select_own on public.challenge_rules for select to authenticated
  using (exists (select 1 from public.challenges c where c.id = challenge_id and c.user_id = (select auth.uid())));
create policy rules_insert_own on public.challenge_rules for insert to authenticated
  with check (exists (select 1 from public.challenges c where c.id = challenge_id and c.user_id = (select auth.uid())));
create policy rules_update_own on public.challenge_rules for update to authenticated
  using (exists (select 1 from public.challenges c where c.id = challenge_id and c.user_id = (select auth.uid())))
  with check (exists (select 1 from public.challenges c where c.id = challenge_id and c.user_id = (select auth.uid())));
create policy rules_delete_own on public.challenge_rules for delete to authenticated
  using (exists (select 1 from public.challenges c where c.id = challenge_id and c.user_id = (select auth.uid())));

-- Child tables carrying user_id: the row must belong to the caller AND point at the caller's own challenge.
do $$
declare t text;
begin
  foreach t in array array['trades','balance_events','account_snapshots','trading_days'] loop
    execute format($f$create policy %1$s_select_own on public.%1$s for select to authenticated using (user_id = (select auth.uid()))$f$, t);
    execute format($f$create policy %1$s_insert_own on public.%1$s for insert to authenticated
      with check (user_id = (select auth.uid())
        and exists (select 1 from public.challenges c where c.id = challenge_id and c.user_id = (select auth.uid())))$f$, t);
    execute format($f$create policy %1$s_update_own on public.%1$s for update to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid())
        and exists (select 1 from public.challenges c where c.id = challenge_id and c.user_id = (select auth.uid())))$f$, t);
    execute format($f$create policy %1$s_delete_own on public.%1$s for delete to authenticated using (user_id = (select auth.uid()))$f$, t);
  end loop;
end $$;

-- notifications: users read, mark read, delete, and the app inserts on their behalf
create policy notifications_select_own on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_insert_own on public.notifications for insert to authenticated
  with check (user_id = (select auth.uid())
    and (challenge_id is null or exists (select 1 from public.challenges c where c.id = challenge_id and c.user_id = (select auth.uid()))));
create policy notifications_update_own on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete_own on public.notifications for delete to authenticated using (user_id = (select auth.uid()));

-- audit_logs: read and append only. No update or delete policy exists, so neither is allowed.
create policy audit_select_own on public.audit_logs for select to authenticated using (user_id = (select auth.uid()));
create policy audit_insert_own on public.audit_logs for insert to authenticated
  with check (user_id = (select auth.uid())
    and (challenge_id is null or exists (select 1 from public.challenges c where c.id = challenge_id and c.user_id = (select auth.uid()))));

-- The anon role gets nothing: no policies means no rows, and we revoke table privileges as defence in depth.
revoke all on all tables in schema public from anon;
