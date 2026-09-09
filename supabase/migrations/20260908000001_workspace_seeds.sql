-- WorkSpace Master Data Idempotent Seeds
-- Seeds official courses, academic timetable (MCA DS & MCA General), calendar, hostels, mess, and laundry

-- 1. COURSES SEED
INSERT INTO public.courses (id, code, title, teacher, token_color, icon, type, credits, room)
VALUES
  ('c-mca110126', 'MCA110126', 'Computational Probability & Statistics', 'Mr. Sanjeev Kumar', 'orange', 'fa-calculator', 'Theory', 4, 'R605 / R512'),
  ('c-mca110226', 'MCA110226', 'Advanced Python Programming', 'Dr. Jaspreet Singh', 'blue', 'fa-python', 'Theory', 4, 'R512 / R603'),
  ('c-mca110326', 'MCA110326', 'Advanced Python Programming Lab', 'Mr. Rohit', 'blue', 'fa-laptop-code', 'Lab', 2, 'L204'),
  ('c-mca110426', 'MCA110426', 'Foundations of Artificial Intelligence', 'Dr. Saloni Manhas', 'purple', 'fa-brain', 'Theory', 4, 'R605 / R512'),
  ('c-mca110526', 'MCA110526', 'Foundations of AI Lab', 'Mr. Davinder', 'purple', 'fa-network-wired', 'Lab', 2, 'L604'),
  ('c-mca110626', 'MCA110626', 'Professional Communication', 'Dr. Ankita', 'pink', 'fa-comments', 'Theory', 2, 'L604 / L212'),
  ('c-mca110726', 'MCA110726', 'Database Systems', 'Mr. Vijay Kumar', 'emerald', 'fa-database', 'Theory', 4, 'R512 / R603'),
  ('c-mca110826', 'MCA110826', 'Database Systems Lab', 'Ms. Mandeep Kaur', 'emerald', 'fa-server', 'Lab', 2, 'L205'),
  ('c-mca110926', 'MCA110926', 'Advanced Data Structures & Algorithms', 'Dr. Harmeet Kaur', 'rose', 'fa-sitemap', 'Theory', 4, 'R311 / R512 / R603'),
  ('c-mca111026', 'MCA111026', 'Advanced DSA Lab', 'Ms. Anjula', 'rose', 'fa-diagram-project', 'Lab', 2, 'L604'),
  ('c-mmp2025', 'MMP', 'Mentor Mentee Program', 'Dr. Saloni Manhas', 'slate', 'fa-users', 'Mentorship', 1, 'L204'),
  ('c-ss', 'SS', 'Soft Skills', 'Hina', 'amber', 'fa-comments', 'Skill', 1, 'R605'),
  ('c-va', 'VA', 'Verbal Ability', 'Hina', 'amber', 'fa-language', 'Skill', 1, 'R605'),
  ('c-lr', 'LR', 'Logical Reasoning', 'Shivani Sahaye', 'amber', 'fa-brain', 'Skill', 1, 'R605'),
  ('c-qa', 'QA', 'Quantitative Aptitude', 'Shivani Sahaye', 'amber', 'fa-calculator', 'Skill', 1, 'R605'),
  ('c-bdij', 'BDIJ', 'Big Data with Industry Java', 'Saurav Chauhan', 'indigo', 'fa-cubes', 'Practice', 3, 'L105 / L604')
ON CONFLICT (code) DO NOTHING;

-- 2. HOSTELS SEED
INSERT INTO public.hostels (id, name, blocks, laundry_days)
VALUES
  (
    'hostel-einstein',
    'Einstein Hall',
    '["Block A", "Block B", "Block C", "Block D"]'::jsonb,
    '[{"day": 2, "timeSlot": "08:00 AM - 12:00 PM", "description": "Tuesday Morning Drop-off"}, {"day": 5, "timeSlot": "04:00 PM - 08:00 PM", "description": "Friday Evening Collection"}]'::jsonb
  ),
  (
    'hostel-curie',
    'Curie Hall (Girls)',
    '["Block 1", "Block 2", "Block 3"]'::jsonb,
    '[{"day": 1, "timeSlot": "08:00 AM - 12:00 PM", "description": "Monday Morning Drop-off"}, {"day": 4, "timeSlot": "04:00 PM - 08:00 PM", "description": "Thursday Evening Collection"}]'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.hostel_wardens (id, hostel_id, name, role_or_floor, phone)
VALUES
  ('w-einstein-1', 'hostel-einstein', 'Mr. Rameshwar Singh', 'Chief Warden', '+91 98765 43210'),
  ('w-einstein-2', 'hostel-einstein', 'Mr. Rajesh Sharma', 'Ground & 1st Floor', '+91 98765 43211'),
  ('w-einstein-3', 'hostel-einstein', 'Mr. Amit Verma', '2nd & 3rd Floor', '+91 98765 43212'),
  ('w-curie-1', 'hostel-curie', 'Dr. Sunita Rao', 'Chief Warden', '+91 98765 54321'),
  ('w-curie-2', 'hostel-curie', 'Ms. Priya Menon', 'Hostel Supervisor', '+91 98765 54322')
ON CONFLICT (id) DO NOTHING;
