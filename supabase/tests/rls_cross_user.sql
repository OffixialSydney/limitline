-- Cross-user access test for Row Level Security.
-- Run in the Supabase SQL Editor AFTER creating two real users (Authentication -> Users)
-- and replacing the two UUIDs below. Everything runs in a transaction that is rolled back.
begin;

-- 1. Act as user A and create a challenge.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"REPLACE-WITH-USER-A-UUID","role":"authenticated"}', true);
insert into public.challenges (user_id, name, firm_name, account_currency, starting_balance, start_date)
values ('REPLACE-WITH-USER-A-UUID', 'RLS test', 'Test firm', 'USD', 10000, current_date);

-- 2. Act as user B. EXPECT: 0 rows.
select set_config('request.jwt.claims', '{"sub":"REPLACE-WITH-USER-B-UUID","role":"authenticated"}', true);
select count(*) as challenges_visible_to_b from public.challenges where name = 'RLS test';

-- 3. B tries to insert a trade into A's challenge. EXPECT: error "new row violates row-level security policy".
-- insert into public.trades (user_id, challenge_id, instrument, direction, entry_time)
-- select 'REPLACE-WITH-USER-B-UUID', id, 'EURUSD', 'long', now() from public.challenges where name = 'RLS test';
-- (the select returns nothing for B, so run this variant with A's challenge id pasted in to see the policy error)

-- 4. B tries to update A's challenge. EXPECT: UPDATE 0.
update public.challenges set name = 'hijacked' where name = 'RLS test';

rollback;
