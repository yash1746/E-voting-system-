-- ============================================================
-- E-VOTING SYSTEM — SUPABASE SCHEMA
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. Pre-loaded Eligible Voters (seeded by admin/govt)
-- ============================================================
create table if not exists eligible_voters (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  voter_id_number text not null unique,    -- Unique voter card number (e.g. ABC1234567)
  phone text not null,                      -- Registered phone (last 4 digits shown to user)
  email text,                               -- Optional email for OTP fallback
  district text not null,
  state text not null,
  date_of_birth date not null,
  gender text check (gender in ('male','female','other')),
  is_active boolean default true,           -- Can be deactivated by admin
  registered_at timestamptz default now()
);

-- ============================================================
-- 2. Auth Sessions (created when voter verifies identity)
-- ============================================================
create table if not exists voter_sessions (
  id uuid primary key default uuid_generate_v4(),
  eligible_voter_id uuid references eligible_voters(id) on delete cascade,
  session_token text not null unique,
  otp_code text,
  otp_expires_at timestamptz,
  otp_verified boolean default false,
  role text default 'voter' check (role in ('voter','admin')),
  ip_address text,
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '8 hours')
);

-- ============================================================
-- 3. Elections
-- ============================================================
create table if not exists elections (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  candidates jsonb not null default '[]',  -- [{id, name, party, party_id, symbol}]
  start_date timestamptz not null,
  end_date timestamptz not null,
  status text default 'upcoming' check (status in ('upcoming','active','paused','closed')),
  eligible_districts text[] default '{}',  -- Empty = all districts
  eligible_states text[] default '{}',     -- Empty = all states (National)
  created_by text,
  created_at timestamptz default now()
);

-- ============================================================
-- 4. Anonymous Votes (NO voter reference — anonymity guaranteed)
-- ============================================================
create table if not exists votes (
  id uuid primary key default uuid_generate_v4(),
  election_id uuid references elections(id) on delete cascade,
  encrypted_ballot text not null,          -- AES-256 encrypted {candidateId, electionId}
  vote_hash text not null unique,          -- SHA-256 of encrypted ballot
  previous_hash text not null,             -- Hash of previous vote (chain integrity)
  receipt_token text not null unique,      -- What voter gets to verify their vote was counted
  cast_at timestamptz default now()
  -- NO voter_id or user reference here! This is the anonymity guarantee.
);

-- ============================================================
-- 5. Vote Receipts (separate table for duplicate prevention)
-- Stores WHO voted in WHICH election, but NOT what they voted
-- ============================================================
create table if not exists vote_receipts (
  id uuid primary key default uuid_generate_v4(),
  eligible_voter_id uuid references eligible_voters(id) on delete cascade,
  election_id uuid references elections(id) on delete cascade,
  receipt_token text not null,             -- Same token in votes table (for lookup only)
  voted_at timestamptz default now(),
  unique(eligible_voter_id, election_id)   -- Enforce one vote per election per voter
);

-- ============================================================
-- 6. Parties
-- ============================================================
create table if not exists parties (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  abbreviation text,
  symbol_emoji text default '🏛️',
  color text default '#4f8ef7',
  leader_name text,
  founded_year int,
  headquarters text,
  ideology text,
  description text,
  eligible_states text[] default '{}',     -- States where the party is eligible to contest
  created_at timestamptz default now()
);

-- ============================================================
-- 7. Party Key Actions (voting records, major decisions)
-- ============================================================
create table if not exists party_actions (
  id uuid primary key default uuid_generate_v4(),
  party_id uuid references parties(id) on delete cascade,
  title text not null,
  description text,
  action_date date not null,
  category text check (category in ('legislation','policy','controversy','achievement','promise')),
  impact text check (impact in ('positive','negative','neutral')),
  source_url text,
  created_at timestamptz default now()
);

-- ============================================================
-- 8. Party Speeches (YouTube links / video URLs)
-- ============================================================
create table if not exists party_speeches (
  id uuid primary key default uuid_generate_v4(),
  party_id uuid references parties(id) on delete cascade,
  speaker_name text not null,
  title text not null,
  video_url text,
  speech_date date not null,
  event_name text,
  summary text,
  created_at timestamptz default now()
);

-- ============================================================
-- 9. Audit Log
-- ============================================================
create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  action text not null,
  performed_by text,                       -- voter_id or 'admin' or 'system'
  details jsonb,
  ip_address text,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY (enable for production)
-- ============================================================
alter table eligible_voters enable row level security;
alter table voter_sessions enable row level security;
alter table elections enable row level security;
alter table votes enable row level security;
alter table vote_receipts enable row level security;
alter table parties enable row level security;
alter table party_actions enable row level security;
alter table party_speeches enable row level security;
alter table audit_logs enable row level security;

-- Allow service role full access (backend uses service key)
-- Drop first so this script is safe to re-run multiple times
drop policy if exists "Service role full access" on eligible_voters;
drop policy if exists "Service role full access" on voter_sessions;
drop policy if exists "Service role full access" on elections;
drop policy if exists "Service role full access" on votes;
drop policy if exists "Service role full access" on vote_receipts;
drop policy if exists "Service role full access" on parties;
drop policy if exists "Service role full access" on party_actions;
drop policy if exists "Service role full access" on party_speeches;
drop policy if exists "Service role full access" on audit_logs;

create table if not exists voter_applications (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  voter_id_number text, -- Allocated upon approval or provided for reference
  phone text not null,
  email text,
  date_of_birth date not null,
  district text not null,
  state text not null,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  applied_at timestamptz default now(),
  reviewed_by text,
  reviewed_at timestamptz
);

alter table voter_applications enable row level security;
drop policy if exists "Anyone can apply" on voter_applications;
create policy "Anyone can apply" on voter_applications for insert with check (true);
drop policy if exists "Service role full access" on voter_applications;
create policy "Service role full access" on voter_applications for all using (true);

create policy "Service role full access" on eligible_voters for all using (true);
create policy "Service role full access" on voter_sessions for all using (true);
create policy "Service role full access" on elections for all using (true);
create policy "Service role full access" on votes for all using (true);
create policy "Service role full access" on vote_receipts for all using (true);
create policy "Service role full access" on parties for all using (true);
create policy "Service role full access" on party_actions for all using (true);
create policy "Service role full access" on party_speeches for all using (true);
create policy "Service role full access" on audit_logs for all using (true);
-- ============================================================
-- INITIAL SEED DATA
-- ============================================================
INSERT INTO eligible_voters (full_name, voter_id_number, phone, email, district, state, date_of_birth, is_active)
VALUES 
('Admin User', 'ADMIN00001', '+91-9000000000', 'admin@evoting.gov.in', 'New Delhi', 'Delhi', '1980-01-01', true),
('Rajesh Sharma', 'ECI0001234', '+91-9876543210', 'rajesh@example.com', 'New Delhi', 'Delhi', '1985-03-15', true)
ON CONFLICT (voter_id_number) DO UPDATE SET is_active = true;

-- Political Parties Seed
INSERT INTO parties (name, abbreviation, symbol_emoji, color, description, eligible_states) VALUES
('Progressive National Alliance', 'PNA', '🌿', '#22c55e', 'Centrist, Development-focused party.', '{"National"}'),
('Bharatiya Samajwadi Party', 'BSP', '⚡', '#f59e0b', 'Socialist, Rural-focused party.', '{"National"}'),
('National Reform Congress', 'NRC', '🔵', '#3b82f6', 'Liberal, Economic reform party.', '{"National"}'),
('Ecological Citizens Party', 'ECP', '🌱', '#10b981', 'Green, Environmental party.', '{"National"}'),
('People''s Democratic Front', 'PDF', '❤️', '#ef4444', 'Left-wing, Workers rights party.', '{"National"}')
ON CONFLICT DO NOTHING;

-- Ensure election status constraint includes 'paused'
ALTER TABLE elections DROP CONSTRAINT IF EXISTS elections_status_check;
ALTER TABLE elections ADD CONSTRAINT elections_status_check CHECK (status IN ('upcoming', 'active', 'paused', 'closed'));
