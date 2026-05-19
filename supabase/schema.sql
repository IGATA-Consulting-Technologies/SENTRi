-- ============================================================
-- SENTRi — Movement Intelligence Platform
-- Multi-Tenant Supabase Schema v1.0
-- by IGATA Technologies
--
-- Run this in your Supabase SQL Editor (SENTRi project)
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- TENANTS
-- Every installation (cantonment, oil facility, etc) is a tenant
-- ============================================================
create table tenants (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,           -- used in gate URLs e.g. "ikeja-cantonment"
  sector text not null default 'military', -- 'military' | 'oil_gas' | 'industrial' | 'corporate' | 'government' | 'other'
  branch text,                         -- 'army' | 'navy' | 'airforce' | 'police' | 'dss' | null for non-military
  address text,
  city text,
  state text,
  logo_url text,                       -- stored in Supabase Storage
  contact_name text,
  contact_email text,
  contact_phone text,
  report_emails text[],                -- array of report recipient emails
  report_frequency text default 'both', -- 'weekly' | 'monthly' | 'both'
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Seed: Ikeja Cantonment (pilot tenant)
insert into tenants (name, slug, sector, branch, address, city, state, contact_name, report_frequency)
values (
  'Ikeja Cantonment',
  'ikeja-cantonment',
  'military',
  'army',
  'Adeniyi Jones Avenue',
  'Ikeja',
  'Lagos',
  'Commanding Officer',
  'both'
);

-- ============================================================
-- GATES
-- Each tenant has one or more gates
-- ============================================================
create table gates (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,                  -- "Main Gate"
  slug text not null,                  -- "main-gate" — used in URL
  location text,                       -- physical description
  is_active boolean default true,
  created_at timestamptz default now(),
  unique(tenant_id, slug)
);

-- Seed: Ikeja Cantonment gates
insert into gates (tenant_id, name, slug, location)
select id, 'Main Gate', 'main-gate', 'Adeniyi Jones Avenue entrance'
from tenants where slug = 'ikeja-cantonment';

insert into gates (tenant_id, name, slug, location)
select id, 'Side Gate B', 'side-gate-b', 'North perimeter'
from tenants where slug = 'ikeja-cantonment';

insert into gates (tenant_id, name, slug, location)
select id, 'Rear Gate', 'rear-gate', 'Internal access point'
from tenants where slug = 'ikeja-cantonment';

-- ============================================================
-- OFFICERS
-- Guards and command staff per tenant
-- ============================================================
create table officers (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  rank text,
  service_number text,
  role text not null default 'guard',  -- 'guard' | 'command' | 'admin'
  email text,                          -- for command/admin login via Supabase Auth
  gate_id uuid references gates(id),  -- default gate assignment
  is_active boolean default true,
  last_login timestamptz,
  created_at timestamptz default now(),
  unique(tenant_id, service_number)
);

-- ============================================================
-- MOVEMENTS
-- Core log table — every entry and exit
-- ============================================================
create table movements (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id),
  gate_id uuid references gates(id),

  -- Type
  type text not null,                  -- 'vehicle' | 'pedestrian'

  -- Vehicle fields
  plate_number text,
  ocr_confidence integer,              -- 0-100

  -- Visitor fields
  visitor_name text,
  id_number text,                      -- NIN, staff ID, military ID
  destination text not null,
  purpose text not null,
  occupants integer default 1,

  -- Timestamps
  entry_time timestamptz default now(),
  exit_time timestamptz,
  duration_minutes integer,            -- auto-computed on checkout

  -- Attribution
  entry_officer_id uuid references officers(id),
  exit_officer_id uuid references officers(id),

  -- Intelligence
  flag_triggered boolean default false,
  watchlist_hit_id uuid,

  -- Meta
  notes text,
  synced boolean default true,
  created_at timestamptz default now()
);

-- Indexes for performance
create index idx_movements_tenant on movements(tenant_id);
create index idx_movements_plate on movements(plate_number);
create index idx_movements_entry_time on movements(entry_time desc);
create index idx_movements_gate on movements(gate_id);
create index idx_movements_active on movements(tenant_id, exit_time) where exit_time is null;

-- ============================================================
-- WATCHLIST
-- COS/command flags vehicles, names, or IDs to watch
-- ============================================================
create table watchlist (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id),
  type text not null,                  -- 'plate' | 'name' | 'id_number'
  value text not null,
  reason text,                         -- internal, never shown to guards
  added_by uuid references officers(id),
  is_active boolean default true,
  created_at timestamptz default now(),
  expires_at timestamptz
);

create index idx_watchlist_tenant on watchlist(tenant_id);
create index idx_watchlist_lookup on watchlist(tenant_id, type, value) where is_active = true;

-- ============================================================
-- FLAG ALERTS
-- Every watchlist hit generates an alert
-- ============================================================
create table flag_alerts (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id),
  watchlist_id uuid references watchlist(id),
  movement_id uuid references movements(id),
  gate_id uuid references gates(id),
  officer_id uuid references officers(id),
  alerted_at timestamptz default now(),
  acknowledged boolean default false,
  acknowledged_at timestamptz,
  acknowledged_by uuid references officers(id)
);

create index idx_flag_alerts_tenant on flag_alerts(tenant_id);
create index idx_flag_alerts_unread on flag_alerts(tenant_id, acknowledged) where acknowledged = false;

-- ============================================================
-- SHIFT LOGS
-- Every shift start and handover is recorded
-- ============================================================
create table shift_logs (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id),
  gate_id uuid references gates(id),
  officer_name text not null,
  service_number text,
  shift_start timestamptz default now(),
  shift_end timestamptz,
  vehicles_inside_at_handover integer default 0,
  handover_to_name text,
  handover_to_service_number text,
  notes text,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Tenant isolation enforced at database level
-- ============================================================
alter table tenants enable row level security;
alter table gates enable row level security;
alter table officers enable row level security;
alter table movements enable row level security;
alter table watchlist enable row level security;
alter table flag_alerts enable row level security;
alter table shift_logs enable row level security;

-- Helper function: get tenant_id for the current authenticated user
create or replace function get_my_tenant_id()
returns uuid as $$
  select tenant_id from officers
  where email = auth.email()
  and is_active = true
  limit 1;
$$ language sql security definer;

-- Helper function: get role for current user
create or replace function get_my_role()
returns text as $$
  select role from officers
  where email = auth.email()
  and is_active = true
  limit 1;
$$ language sql security definer;

-- GATES: officers see only their tenant's gates
create policy "officers_see_own_gates"
  on gates for select to authenticated
  using (tenant_id = get_my_tenant_id());

-- OFFICERS: officers see only their own tenant
create policy "officers_see_own_officers"
  on officers for select to authenticated
  using (tenant_id = get_my_tenant_id());

-- MOVEMENTS: full access within tenant
create policy "movements_tenant_insert"
  on movements for insert to authenticated
  with check (tenant_id = get_my_tenant_id());

create policy "movements_tenant_select"
  on movements for select to authenticated
  using (tenant_id = get_my_tenant_id());

create policy "movements_tenant_update"
  on movements for update to authenticated
  using (tenant_id = get_my_tenant_id());

-- WATCHLIST: command role only
create policy "watchlist_command_only"
  on watchlist for all to authenticated
  using (
    tenant_id = get_my_tenant_id()
    and get_my_role() in ('command', 'admin')
  );

-- FLAG ALERTS: command role only
create policy "flag_alerts_command_only"
  on flag_alerts for all to authenticated
  using (
    tenant_id = get_my_tenant_id()
    and get_my_role() in ('command', 'admin')
  );

-- SHIFT LOGS: all authenticated within tenant
create policy "shift_logs_tenant"
  on shift_logs for all to authenticated
  using (tenant_id = get_my_tenant_id())
  with check (tenant_id = get_my_tenant_id());

-- TENANTS: officers can read their own tenant profile
create policy "officers_read_own_tenant"
  on tenants for select to authenticated
  using (id = get_my_tenant_id());

-- ============================================================
-- AUTO-COMPUTE DURATION ON CHECKOUT
-- ============================================================
create or replace function compute_duration()
returns trigger as $$
begin
  if new.exit_time is not null and old.exit_time is null then
    new.duration_minutes := round(
      extract(epoch from (new.exit_time - new.entry_time)) / 60
    );
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_compute_duration
  before update on movements
  for each row execute function compute_duration();

-- ============================================================
-- AUTO-CHECK WATCHLIST ON ENTRY
-- Tenant-scoped — only checks own tenant's watchlist
-- ============================================================
create or replace function check_watchlist()
returns trigger as $$
declare
  hit watchlist%rowtype;
begin
  select * into hit
  from watchlist
  where tenant_id = new.tenant_id
    and is_active = true
    and (expires_at is null or expires_at > now())
    and (
      (type = 'plate' and lower(value) = lower(coalesce(new.plate_number, '')))
      or (type = 'name' and lower(new.visitor_name) like '%' || lower(value) || '%')
      or (type = 'id_number' and lower(value) = lower(coalesce(new.id_number, '')))
    )
  limit 1;

  if hit.id is not null then
    new.flag_triggered := true;
    new.watchlist_hit_id := hit.id;
    insert into flag_alerts (tenant_id, watchlist_id, movement_id, gate_id, officer_id)
    values (new.tenant_id, hit.id, new.id, new.gate_id, new.entry_officer_id);
  end if;

  return new;
end;
$$ language plpgsql;

create trigger trg_check_watchlist
  before insert on movements
  for each row execute function check_watchlist();

-- ============================================================
-- ANALYTICS VIEWS (tenant-safe — filter in application layer)
-- ============================================================
create or replace view v_weekly_summary as
select
  tenant_id,
  gate_id,
  date_trunc('week', entry_time) as week_start,
  type,
  count(*) as total_entries,
  count(exit_time) as completed_exits,
  count(*) filter (where exit_time is null) as still_inside,
  round(avg(duration_minutes) filter (where duration_minutes is not null)) as avg_duration_minutes,
  count(*) filter (where flag_triggered = true) as flag_hits
from movements
group by tenant_id, gate_id, week_start, type;

create or replace view v_repeat_visitors as
select
  tenant_id,
  plate_number,
  visitor_name,
  count(*) as visit_count,
  max(entry_time) as last_seen,
  array_agg(distinct destination) as destinations_visited,
  round(avg(duration_minutes) filter (where duration_minutes is not null)) as avg_duration_minutes
from movements
where entry_time > now() - interval '30 days'
  and plate_number is not null
group by tenant_id, plate_number, visitor_name
order by visit_count desc;
