-- ============================================================
-- E-VOTING SYSTEM — SEED DATA
-- Safe to re-run: uses ON CONFLICT DO NOTHING everywhere
-- ============================================================

-- ============================================================
-- ELIGIBLE VOTERS (pre-loaded government registry)
-- ============================================================
insert into eligible_voters (full_name, voter_id_number, phone, email, district, state, date_of_birth, gender) values
('Rajesh Kumar Sharma',  'ECI0001234', '+91-9876543210', 'rajesh@example.com',  'New Delhi',  'Delhi',     '1985-03-15', 'male'),
('Priya Singh',          'ECI0002345', '+91-9876543211', 'priya@example.com',   'Mumbai',     'Maharashtra','1990-07-22', 'female'),
('Amit Patel',           'ECI0003456', '+91-9876543212', 'amit@example.com',    'Ahmedabad',  'Gujarat',   '1978-11-08', 'male'),
('Sneha Reddy',          'ECI0004567', '+91-9876543213', 'sneha@example.com',   'Hyderabad',  'Telangana', '1995-01-30', 'female'),
('Vikram Nair',          'ECI0005678', '+91-9876543214', 'vikram@example.com',  'Kochi',      'Kerala',    '1988-09-12', 'male'),
('Ananya Bose',          'ECI0006789', '+91-9876543215', 'ananya@example.com',  'Kolkata',    'West Bengal','1992-05-18', 'female'),
('Suresh Gupta',         'ECI0007890', '+91-9876543216', 'suresh@example.com',  'Jaipur',     'Rajasthan', '1975-12-03', 'male'),
('Meera Pillai',         'ECI0008901', '+91-9876543217', 'meera@example.com',   'Chennai',    'Tamil Nadu','1987-04-25', 'female'),
('Rahul Verma',          'ECI0009012', '+91-9876543218', 'rahul@example.com',   'Lucknow',    'Uttar Pradesh','1993-08-14','male'),
('Deepika Joshi',        'ECI0010123', '+91-9876543219', 'deepika@example.com', 'Pune',       'Maharashtra','1991-02-07', 'female'),
('Arjun Mishra',         'ECI0011234', '+91-9876543220', 'arjun@example.com',   'Patna',      'Bihar',     '1983-06-20', 'male'),
('Kavitha Krishnan',     'ECI0012345', '+91-9876543221', 'kavitha@example.com', 'Bengaluru',  'Karnataka', '1996-10-11', 'female'),
('Sanjay Yadav',         'ECI0013456', '+91-9876543222', 'sanjay@example.com',  'Bhopal',     'Madhya Pradesh','1980-03-28','male'),
('Pooja Agarwal',        'ECI0014567', '+91-9876543223', 'pooja@example.com',   'Agra',       'Uttar Pradesh','1994-07-16','female'),
('Naveen Kapoor',        'ECI0015678', '+91-9876543224', 'naveen@example.com',  'Chandigarh', 'Punjab',    '1986-11-02', 'male'),
-- Admin account (special voter ID for demo)
('Admin User',           'ADMIN00001', '+91-9000000000', 'admin@evoting.gov.in','New Delhi',  'Delhi',     '1980-01-01', 'male')
on conflict (voter_id_number) do nothing;

-- ============================================================
-- PARTIES
-- ============================================================
insert into parties (id, name, abbreviation, symbol_emoji, color, leader_name, founded_year, headquarters, ideology, description) values
('a1b2c3d4-0001-0001-0001-000000000001', 'Progressive National Alliance', 'PNA', '🌿', '#22c55e', 'Arun Mehta',   1952, 'New Delhi', 'Centrist, Development-focused', 'A centrist party focused on inclusive growth, digital infrastructure, and social welfare for all citizens.'),
('a1b2c3d4-0002-0002-0002-000000000002', 'Bharatiya Samajwadi Party',    'BSP', '⚡', '#f59e0b', 'Sunita Devi',  1984, 'Lucknow',   'Socialist, Rural-focused',     'Advocates for farmers, rural communities, and equitable distribution of resources across all states.'),
('a1b2c3d4-0003-0003-0003-000000000003', 'National Reform Congress',      'NRC', '🔵', '#3b82f6', 'Vijay Sharma', 1947, 'Mumbai',    'Liberal, Economic reform',     'Pro-business liberal party focused on economic liberalization, trade, and modernizing governance.'),
('a1b2c3d4-0004-0004-0004-000000000004', 'Ecological Citizens Party',    'ECP', '🌱', '#10b981', 'Ritu Verma',   2008, 'Bengaluru', 'Green, Environmental',         'India''s leading green party, pushing for renewable energy, climate action, and sustainable development.'),
('a1b2c3d4-0005-0005-0005-000000000005', 'People''s Democratic Front',   'PDF', '❤️', '#ef4444', 'Mohan Das',    1967, 'Chennai',   'Left-wing, Workers rights',    'Represents workers, unions, and marginalized communities with focus on labor rights and poverty reduction.')
on conflict (id) do nothing;

-- ============================================================
-- PARTY ACTIONS
-- ============================================================
insert into party_actions (party_id, title, description, action_date, category, impact, source_url) values
-- PNA
('a1b2c3d4-0001-0001-0001-000000000001', 'Digital India 2.0 Initiative', 'Launched comprehensive plan to bring 5G internet and digital services to 500,000 villages by 2026.', '2023-08-15', 'policy', 'positive', 'https://example.com/digital-india'),
('a1b2c3d4-0001-0001-0001-000000000001', 'Infrastructure Act 2022',      'Passed ₹10 lakh crore infrastructure bill for roads, railways, and airports across 28 states.',        '2022-03-10', 'legislation', 'positive', 'https://example.com/infra-act'),
('a1b2c3d4-0001-0001-0001-000000000001', 'Health Insurance Expansion',   'Extended universal health insurance to 300 million more citizens below poverty line.',                  '2023-01-20', 'achievement', 'positive', null),
-- BSP
('a1b2c3d4-0002-0002-0002-000000000002', 'Farmers Loan Waiver Scheme',   'Proposed complete waiver of agricultural loans up to ₹2 lakh for small and marginal farmers.',          '2023-11-05', 'policy', 'positive', 'https://example.com/loan-waiver'),
('a1b2c3d4-0002-0002-0002-000000000002', 'Rural Employment Guarantee',   'Increased MGNREGA work days from 100 to 150 per year when in power in 3 states.',                      '2022-07-15', 'achievement', 'positive', null),
('a1b2c3d4-0002-0002-0002-000000000002', 'Seed Distribution Controversy','Distribution program faced corruption allegations; 40% seeds reportedly diverted to black market.',    '2023-05-20', 'controversy', 'negative', 'https://example.com/seed-controversy'),
-- NRC
('a1b2c3d4-0003-0003-0003-000000000003', 'GST Simplification Bill',      'Proposed reducing GST slabs from 5 to 3 tiers to simplify compliance for small businesses.',            '2023-09-12', 'legislation', 'positive', 'https://example.com/gst-bill'),
('a1b2c3d4-0003-0003-0003-000000000003', 'Free Trade Agreement Push',    'Advocated for and helped negotiate trade agreements with 8 ASEAN nations.',                              '2022-11-30', 'achievement', 'positive', null),
-- ECP
('a1b2c3d4-0004-0004-0004-000000000004', 'Solar Villages Mission',       'Committed to converting 10,000 villages to 100% solar power by 2027.',                                  '2023-04-22', 'promise', 'positive', null),
('a1b2c3d4-0004-0004-0004-000000000004', 'Plastic Ban Legislation',      'Drafted comprehensive single-use plastic ban bill that passed in 4 states they governed.',              '2022-06-05', 'legislation', 'positive', 'https://example.com/plastic-ban'),
-- PDF
('a1b2c3d4-0005-0005-0005-000000000005', 'Minimum Wage Act Amendment',   'Successfully lobbied for 40% increase in national minimum wage affecting 200 million workers.',         '2023-02-28', 'legislation', 'positive', null),
('a1b2c3d4-0005-0005-0005-000000000005', 'Labor Strike Support',         'Organized national labor strike that led to reversal of controversial labor code amendments.',          '2022-09-08', 'policy', 'positive', null)
on conflict do nothing;

-- ============================================================
-- PARTY SPEECHES (YouTube / video links)
-- ============================================================
insert into party_speeches (party_id, speaker_name, title, video_url, speech_date, event_name, summary) values
('a1b2c3d4-0001-0001-0001-000000000001', 'Arun Mehta',    'Vision for Digital India',  'https://www.youtube.com/embed/dQw4w9WgXcQ', '2024-01-15', 'National Development Summit 2024', 'Speech outlining the roadmap for technology-driven governance and e-services for all citizens.'),
('a1b2c3d4-0001-0001-0001-000000000001', 'Arun Mehta',    'Annual Budget Address',     'https://www.youtube.com/embed/dQw4w9WgXcQ', '2024-02-01', 'Parliament Session',             'Detailed breakdown of the union budget with focus on infrastructure and education spending.'),
('a1b2c3d4-0002-0002-0002-000000000002', 'Sunita Devi',   'Farmers First Policy',      'https://www.youtube.com/embed/dQw4w9WgXcQ', '2024-01-20', 'Kisan Sammelan Agra',            'Comprehensive address on BSP''s 10-point farmer welfare agenda for the 2024 election cycle.'),
('a1b2c3d4-0003-0003-0003-000000000003', 'Vijay Sharma',  'Economic Reform Blueprint', 'https://www.youtube.com/embed/dQw4w9WgXcQ', '2024-01-10', 'CII Annual Conference',          'Detailed economic reform plan focused on manufacturing, export promotion, and startup ecosystem.'),
('a1b2c3d4-0004-0004-0004-000000000004', 'Ritu Verma',    'Climate Action Now',        'https://www.youtube.com/embed/dQw4w9WgXcQ', '2023-11-05', 'India Climate Summit',           'Urgent call for net-zero by 2045, renewable energy targets, and green job creation.'),
('a1b2c3d4-0005-0005-0005-000000000005', 'Mohan Das',     'Workers Rights Address',    'https://www.youtube.com/embed/dQw4w9WgXcQ', '2024-01-05', 'National Labor Convention',      'Outlining PDF''s commitment to repealing anti-worker labor codes and universal social security.')
on conflict do nothing;

-- ============================================================
-- DEMO ELECTION (skip if already exists)
-- ============================================================
insert into elections (title, description, candidates, start_date, end_date, status)
select
  'General Election 2024 — National Assembly',
  'Cast your vote to elect representatives for the 18th National Assembly. This election will determine the composition of the government for the next 5 years.',
  '[
    {"id": "c1", "name": "Arun Mehta",   "party": "Progressive National Alliance", "party_id": "a1b2c3d4-0001-0001-0001-000000000001", "symbol": "🌿", "color": "#22c55e"},
    {"id": "c2", "name": "Sunita Devi",  "party": "Bharatiya Samajwadi Party",    "party_id": "a1b2c3d4-0002-0002-0002-000000000002", "symbol": "⚡", "color": "#f59e0b"},
    {"id": "c3", "name": "Vijay Sharma", "party": "National Reform Congress",      "party_id": "a1b2c3d4-0003-0003-0003-000000000003", "symbol": "🔵", "color": "#3b82f6"},
    {"id": "c4", "name": "Ritu Verma",   "party": "Ecological Citizens Party",    "party_id": "a1b2c3d4-0004-0004-0004-000000000004", "symbol": "🌱", "color": "#10b981"},
    {"id": "c5", "name": "Mohan Das",    "party": "People''s Democratic Front",   "party_id": "a1b2c3d4-0005-0005-0005-000000000005", "symbol": "❤️", "color": "#ef4444"}
  ]'::jsonb,
  now() - interval '1 hour',
  now() + interval '7 days',
  'active'
where not exists (
  select 1 from elections where title = 'General Election 2024 — National Assembly'
);
