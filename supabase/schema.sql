-- PropPilot AI schema (re-runnable: drops and recreates everything)
drop table if exists followups cascade;
drop table if exists site_visits cascade;
drop table if exists messages cascade;
drop table if exists activity_events cascade;
drop table if exists leads cascade;
drop table if exists properties cascade;
drop table if exists agents cascade;

create table agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  avatar_url text,
  color text not null default '#0b0b0f',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table properties (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  project_name text not null,
  builder text not null,
  locality text not null,
  city text not null,
  lat double precision,
  lng double precision,
  bhk int not null,
  area_sqft int,
  price_inr bigint not null,
  status text not null default 'available'
    check (status in ('available', 'few_left', 'sold')),
  possession text,
  amenities text[] not null default '{}',
  image_url text,
  created_at timestamptz not null default now()
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text,
  email text,
  source text not null default 'website'
    check (source in ('99acres', 'magicbricks', 'housing', 'facebook', 'whatsapp', 'website')),
  budget_min bigint,
  budget_max bigint,
  bhk int,
  preferred_locations text[] not null default '{}',
  timeline text not null default 'unknown'
    check (timeline in ('immediate', '1-3 months', '3-6 months', '6+ months', 'unknown')),
  needs_loan boolean,
  purpose text not null default 'unknown'
    check (purpose in ('self-use', 'investment', 'unknown')),
  intent text,
  summary text,
  score int not null default 0,
  score_breakdown jsonb,
  temperature text not null default 'cold'
    check (temperature in ('hot', 'warm', 'cold')),
  stage text not null default 'new'
    check (stage in ('new', 'qualified', 'site_visit', 'negotiation', 'booked', 'lost')),
  assigned_agent_id uuid references agents (id) on delete set null,
  deal_value_estimate bigint,
  first_response_ms int,
  human_baseline_ms int,  -- seeded "typical human team" first response, for AI vs human comparison
  last_contact_at timestamptz,
  created_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads (id) on delete cascade,
  sender text not null check (sender in ('lead', 'ai', 'agent', 'system')),
  channel text not null default 'chat',
  content text not null,
  property_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table site_visits (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads (id) on delete cascade,
  property_id uuid references properties (id) on delete set null,
  agent_id uuid references agents (id) on delete set null,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'no_show', 'rescheduled')),
  created_at timestamptz not null default now()
);

create table followups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads (id) on delete cascade,
  step int not null,
  scheduled_for timestamptz not null,
  message text,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'cancelled')),
  sent_at timestamptz
);

create table activity_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Indexes
create index leads_stage_idx on leads (stage);
create index leads_temperature_idx on leads (temperature);
create index messages_lead_created_idx on messages (lead_id, created_at);
create index site_visits_scheduled_idx on site_visits (scheduled_at);
create index activity_events_created_idx on activity_events (created_at desc);

-- Row Level Security: public read for the demo; all writes go through
-- server routes using the secret key (which bypasses RLS).
alter table agents enable row level security;
alter table properties enable row level security;
alter table leads enable row level security;
alter table messages enable row level security;
alter table site_visits enable row level security;
alter table followups enable row level security;
alter table activity_events enable row level security;

create policy "public read agents" on agents for select to anon, authenticated using (true);
create policy "public read properties" on properties for select to anon, authenticated using (true);
create policy "public read leads" on leads for select to anon, authenticated using (true);
create policy "public read messages" on messages for select to anon, authenticated using (true);
create policy "public read site_visits" on site_visits for select to anon, authenticated using (true);
create policy "public read followups" on followups for select to anon, authenticated using (true);
create policy "public read activity_events" on activity_events for select to anon, authenticated using (true);

-- Realtime
alter publication supabase_realtime add table
  public.leads, public.messages, public.site_visits, public.activity_events;