-- Run this once in Supabase SQL Editor.
-- It adds a user-facing incoming manifest number while keeping the UUID id internal.

alter table public.incoming_manifests
add column if not exists manifest_number text;

alter table public.incoming_manifests
add column if not exists batch_token_id text;

alter table public.incoming_manifests
add column if not exists minted_at text;

alter table public.incoming_manifests
add column if not exists wallet_address text;

with numbered as (
  select
    id,
    'INC-2026-' || lpad(row_number() over (order by created_at, id)::text, 3, '0') as generated_manifest_number
  from public.incoming_manifests
  where manifest_number is null
)
update public.incoming_manifests as incoming
set manifest_number = numbered.generated_manifest_number
from numbered
where incoming.id = numbered.id;

create unique index if not exists incoming_manifests_manifest_number_key
on public.incoming_manifests (manifest_number);

-- Outgoing requests should also keep their user-facing DR number in the database.
alter table public.outgoing_requests
add column if not exists dr_number text;

alter table public.outgoing_requests
add column if not exists handover_contract_id text;

alter table public.outgoing_requests
add column if not exists sender_signature text;

alter table public.outgoing_requests
add column if not exists receiver_signature text;

alter table public.outgoing_requests
add column if not exists wallet_address text;

alter table public.outgoing_requests
add column if not exists allocated_batches jsonb;

create unique index if not exists outgoing_requests_dr_number_key
on public.outgoing_requests (dr_number);

do $$
begin
  alter publication supabase_realtime add table public.incoming_manifests;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.outgoing_requests;
exception
  when duplicate_object then null;
end $$;

alter table public.incoming_manifests enable row level security;
alter table public.outgoing_requests enable row level security;

drop policy if exists "Allow anon read incoming" on public.incoming_manifests;
create policy "Allow anon read incoming"
on public.incoming_manifests for select
to anon
using (true);

drop policy if exists "Allow anon insert incoming" on public.incoming_manifests;
create policy "Allow anon insert incoming"
on public.incoming_manifests for insert
to anon
with check (true);

drop policy if exists "Allow anon update incoming" on public.incoming_manifests;
create policy "Allow anon update incoming"
on public.incoming_manifests for update
to anon
using (true)
with check (true);

drop policy if exists "Allow anon read outgoing" on public.outgoing_requests;
create policy "Allow anon read outgoing"
on public.outgoing_requests for select
to anon
using (true);

drop policy if exists "Allow anon insert outgoing" on public.outgoing_requests;
create policy "Allow anon insert outgoing"
on public.outgoing_requests for insert
to anon
with check (true);

drop policy if exists "Allow anon update outgoing" on public.outgoing_requests;
create policy "Allow anon update outgoing"
on public.outgoing_requests for update
to anon
using (true)
with check (true);
