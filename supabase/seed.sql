-- Clear existing data (if needed)
TRUNCATE members, users, departments, divisions, roles, orders, apply_positions, applications RESTART IDENTITY CASCADE;

-- Insert Members (at least 10)
INSERT INTO members (member_id, prt_email, mobile_number, discord, nda_signed_at, nda_name, nda_confirmed_by, picture) VALUES
('14', null, null, null, null, '2025-04-20 11:48:39.054985+00', null, null),
('15', null, null, null, null, '2025-04-20 12:18:42.002016+00', null, null),
('16', null, null, null, null, '2025-04-20 12:19:08.364813+00', null, null),
('17', null, null, null, null, '2025-04-20 12:19:35.42492+00', null, null),
(1, 'marco.rossi@prt.it', '+39123456789', 'marco#1234', '2023-01-15 10:00:00+01'::timestamptz, 'Marco Rossi NDA', 1, 'https://avatar.iran.liara.run/public'),
(2, 'giulia.ferrari@prt.it', '+39234567890', 'giulia#5678', '2023-01-20 11:30:00+01'::timestamptz, 'Giulia Ferrari NDA', 2, 'https://avatar.iran.liara.run/public'),
(3, 'alessandro.russo@prt.it', '+39345678901', 'alex#9012', '2023-02-05 09:15:00+01'::timestamptz, 'Alessandro Russo NDA', 3, 'https://avatar.iran.liara.run/public'),
(4, 'valentina.esposito@prt.it', '+39456789012', 'vale#3456', '2023-02-10 14:20:00+01'::timestamptz, 'Valentina Esposito NDA', 4, 'https://avatar.iran.liara.run/public'),
(5, 'luca.bianchi@prt.it', '+39567890123', 'luca#7890', '2023-03-01 16:45:00+01'::timestamptz, 'Luca Bianchi NDA', 5, 'https://avatar.iran.liara.run/public'),
(6, 'sofia.ricci@prt.it', '+39678901234', 'sofia#2345', '2023-03-15 10:30:00+01'::timestamptz, 'Sofia Ricci NDA', 1, 'https://avatar.iran.liara.run/public'),
(7,  'matteo.conti@prt.it', '+39789012345', 'matteo#6789', '2023-04-01 13:15:00+02'::timestamptz, 'Matteo Conti NDA', 1, 'https://avatar.iran.liara.run/public'),
(8, 'elena.martini@prt.it', '+39890123456', 'elena#0123', '2023-04-10 11:45:00+02'::timestamptz, 'Elena Martini NDA', 1, 'https://avatar.iran.liara.run/public'),
(9, 'andrea.gallo@prt.it', '+39901234567', 'andrea#4567', '2023-04-20 14:30:00+02'::timestamptz, 'Andrea Gallo NDA', 1, 'https://avatar.iran.liara.run/public'),
(10,  'francesca.leone@prt.it', '+39012345678', 'fran#8901', '2023-05-01 09:20:00+02'::timestamptz, 'Francesca Leone NDA', 1, 'https://avatar.iran.liara.run/public'),
(11, 'simone.lombardi@prt.it', '+39123456780', 'simone#3456', '2023-05-10 10:15:00+02'::timestamptz, 'Simone Lombardi NDA', 1, 'https://avatar.iran.liara.run/public'),
(12, 'claudia.marino@prt.it', '+39234567891', 'claudia#7890', '2023-05-15 13:30:00+02'::timestamptz, 'Claudia Marino NDA', 1, 'https://avatar.iran.liara.run/public'),
(13, 'developer@prt.it', '+39234567891', 'test#7890', '2023-05-15 13:30:00+02'::timestamptz, 'developer NDA', 1, 'https://avatar.iran.liara.run/public');


-- Insert Users with timestamptz for created_at and NULL for updated_at
INSERT INTO users (id, email, first_name, last_name, origin, level_of_study, linkedin, polito_id, program, member, created_at, updated_at, access) VALUES
('user3.wdd@wdd.com', '2025-04-20 12:17:10+00', '2025-04-20 12:17:31+00', 'd1c7255c-bb5f-4f01-8a6e-37c755d74f49', 'Mr. Third', 'Developer', 'Italy', null, null, null, null, '17', null),
('user2.wdd@wdd.com', '2025-04-20 12:15:52+00', '2025-04-20 12:16:20+00', 'c94f7201-2a19-43b4-8c13-bd763e0bfa33', 'Mr. Second', 'developer', 'Italy', null, null, null, null, '16', null),
('user1.wdd@wdd.com', '2025-04-20 12:10:18+00', null, 'f93e2a6b-1c9d-4c9a-9e9f-3b4adcb1429b', 'Mr. First', 'Developer', 'Italy', 'master', null, null, null, '15', null),
('it.lead.prt.dev@gmail.com', '2025-04-20 11:47:36.116989+00', null, '3495ac05-30e0-4326-92a3-2e86035d75c7', 'Mr. Website Lead', 'Trump', 'USA', 'PhD', null, null, 'master of being president', '14', null),
('pioneering.meti@gmail.com', '2025-04-19 14:24:56.127601+00', null, 'd80e9799-515e-40e5-84ec-6d8d41917538', null, null, null, null, null, null, null, null, null),
('11111111-1111-1111-1111-111111111111', 'marco.rossi@example.com', 'Marco', 'Rossi', 'Italy', 'Master', 'linkedin.com/in/marcorossi', 's123456', 'Computer Engineering', 1, '2023-01-10 10:00:00+01'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('22222222-2222-2222-2222-222222222222', 'giulia.ferrari@example.com', 'Giulia', 'Ferrari', 'Italy', 'Bachelor', 'linkedin.com/in/giuliaferrari', 's234567', 'Electronic Engineering', 2, '2023-01-15 11:30:00+01'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('33333333-3333-3333-3333-333333333333', 'alessandro.russo@example.com', 'Alessandro', 'Russo', 'Italy', 'PhD', 'linkedin.com/in/alessandrorusso', 's345678', 'Mechanical Engineering', 3, '2023-02-01 09:15:00+01'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('44444444-4444-4444-4444-444444444444', 'valentina.esposito@example.com', 'Valentina', 'Esposito', 'Italy', 'Master', 'linkedin.com/in/valentinaesposito', 's456789', 'Management Engineering', 4, '2023-02-05 14:20:00+01'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('55555555-5555-5555-5555-555555555555', 'luca.bianchi@example.com', 'Luca', 'Bianchi', 'Italy', 'Bachelor', 'linkedin.com/in/lucabianchi', 's567890', 'Computer Science', 5, '2023-02-20 16:45:00+01'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('66666666-6666-6666-6666-666666666666', 'sofia.ricci@example.com', 'Sofia', 'Ricci', 'Italy', 'Master', 'linkedin.com/in/sofiaricci', 's678901', 'Data Science', 6, '2023-03-10 10:30:00+01'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('77777777-7777-7777-7777-777777777777', 'matteo.conti@example.com', 'Matteo', 'Conti', 'Italy', 'Bachelor', 'linkedin.com/in/matteoconti', 's789012', 'Electronic Engineering', 7, '2023-03-15 13:15:00+01'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('88888888-8888-8888-8888-888888888888', 'elena.martini@example.com', 'Elena', 'Martini', 'Italy', 'Master', 'linkedin.com/in/elenamartini', 's890123', 'Architecture', 8, '2023-04-05 11:45:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('99999999-9999-9999-9999-999999999999', 'andrea.gallo@example.com', 'Andrea', 'Gallo', 'Italy', 'PhD', 'linkedin.com/in/andreagallo', 's901234', 'Mechanical Engineering', 9, '2023-04-15 14:30:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'francesca.leone@example.com', 'Francesca', 'Leone', 'Italy', 'Bachelor', 'linkedin.com/in/francescaleone', 's012345', 'Energy Engineering', 10, '2023-04-25 09:20:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'simone.lombardi@example.com', 'Simone', 'Lombardi', 'Italy', 'Master', 'linkedin.com/in/simonelombardi', 's123457', 'Computer Engineering', 11, '2023-05-10 10:15:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'claudia.marino@example.com', 'Claudia', 'Marino', 'Italy', 'Bachelor', 'linkedin.com/in/claudiamarino', 's234568', 'Biomedical Engineering', 12, '2023-05-15 13:30:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('dddddddd-dddd-dddd-dddd-dddddddddddd', 'chiara.verdi@example.com', 'Chiara', 'Verdi', 'Italy', 'Master', 'linkedin.com/in/chiaraverdi', 's678902', 'Biomedical Engineering', NULL, '2023-03-05 10:30:00+01'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'davide.marino@example.com', 'Davide', 'Marino', 'Italy', 'Bachelor', 'linkedin.com/in/davidemarino', 's789013', 'Aerospace Engineering', NULL, '2023-03-10 13:15:00+01'::timestamptz, NULL, ARRAY['drive', 'wiki']);

-- Insert Subteams (2 subteams)
INSERT INTO departments (name, started_at, closed_at, code) VALUES
('Aerodynamics', '2022-09-01'::date, NULL, 'AER'),
('Electronics', '2022-04-01'::date, NULL, 'ELT'),
('Propulsion', '2022-05-01'::date, NULL, 'PRP'),
('Recovery', '2022-06-01'::date, NULL, 'RCV'),
('Operations', '2022-10-01'::date, NULL, 'OPS'),
('Project Management Office', '2023-09-01'::date, NULL, 'PMO');

-- Insert Divisions (2 per subteam = 4 total)
INSERT INTO divisions (dept_id, name, started_at, closed_at, code) VALUES
(1, 'Optimization & Analysis', '2022-09-01'::date, NULL, 'OPA'),
(1, 'Mission Analysis', '2022-09-01'::date, NULL, 'MSA'),
(1, 'Control & Systems', '2022-09-01'::date, NULL, 'CAS'),
(2, 'Firmware', '2022-09-01'::date, NULL, 'FMW'),
(2, 'Ground Station', '2022-09-01'::date, NULL, 'GNS'),
(2, 'Hardware', '2022-09-01'::date, NULL, 'HDW'),
(3, 'Engine Control', '2022-09-01'::date, NULL, 'EGC'),
(3, 'CFD Analysis', '2022-09-01'::date, NULL, 'CFD'),
(3, 'Test Bench', '2022-09-01'::date, NULL, 'TBE'),
(4, 'Parachutes Analysis', '2022-09-01'::date, NULL, 'PRA'),
(4, 'Actuators', '2022-09-01'::date, NULL, 'ACT'),
(5, 'Logistics', '2022-09-01'::date, NULL, 'LGS'),
(5, 'Media', '2022-09-01'::date, NULL, 'MDA'),
(5, 'Information Technology', '2022-09-01'::date, NULL, 'IT'),
(6, 'Efesto', '2022-09-01'::date, NULL, 'EFS'),
(6, 'Amerigo Vespucci', '2022-09-01'::date, NULL, 'AMV'),
(6, 'Vittorio Emanuele', '2022-09-01'::date, NULL, 'VES');

-- Insert Roles with the required structure:
-- For each division: a lead and core
-- And a President
INSERT INTO roles (member_id, dept_id, division_id, title, started_at, leaved_at, type) VALUES
(13, NULL, NULL, 'President', '2022-09-01'::date, NULL, 'president'),

(2, 1, NULL, 'Head of Electronics', '2022-09-10'::date, NULL, 'head'),
(3, 1, NULL, 'Software Development', '2022-09-15'::date, NULL, 'core'),

(4, 1, 1, 'Web Development Lead', '2022-09-20'::date, NULL, 'lead'),
(5, 1, 1, 'Web Developer', '2022-09-25'::date, NULL, 'core'),

(6, 1, 2, 'Mobile Development Lead', '2022-10-01'::date, NULL, 'lead'),
(7, 1, 2, 'Mobile Developer', '2022-10-05'::date, NULL, 'core'),

(8, 2, NULL, 'Head of Mechanical Design', '2022-09-10'::date, NULL, 'head'),
(9, 2, NULL, 'Mechanical Design', '2022-09-15'::date, NULL, 'core'),

(10, 2, 3, 'CAD Design Lead', '2022-09-20'::date, NULL, 'lead'),
(11, 2, 3, 'CAD Designer', '2022-09-25'::date, NULL, 'core'),

(12, 2, 4, 'Prototyping Lead', '2022-10-01'::date, NULL, 'lead'),
(13, 2, 4, 'Prototyper', '2022-10-05'::date, NULL, 'core');

INSERT INTO orders (status, requester, description, reason, quantity, price, name, created_at, quote_name) VALUES
('accepted', 1, 'Arduino Mega', 'For prototyping self-driving algorithms', 2, 80, 'Arduino Order', '2023-02-01 10:00:00+01'::timestamptz, 'quote_arduino.pdf'),
('pending', 2, 'Sensors Kit', 'Testing electronics for robot', 1, 150, 'Sensors Kit Order', '2023-02-15 11:30:00+01'::timestamptz, 'quote_sensors.pdf'),
('rejected', 3, 'CNC Machine Parts', 'Manufacturing prototype chassis', 10, 500, 'CNC Parts Order', '2023-03-01 09:15:00+01'::timestamptz, 'quote_cnc.pdf'),
('accepted', 4, 'Branded T-shirts', 'Team event promotion', 50, 750, 'T-shirt Order', '2023-03-15 14:20:00+01'::timestamptz, 'quote_tshirts.pdf'),
('pending', 5, 'Office Supplies', 'For team workspace', 1, 200, 'Office Supplies Order', '2023-04-01 16:45:00+02'::timestamptz, 'quote_office.pdf'),
('accepted', 6, 'Development Boards', 'For IoT prototyping', 5, 250, 'Dev Boards Order', '2023-04-15 10:30:00+02'::timestamptz, 'quote_devboards.pdf'),
('pending', 7, '3D Printing Filament', 'For rapid prototyping', 10, 300, '3D Filament Order', '2023-05-01 13:15:00+02'::timestamptz, 'quote_filament.pdf');

-- Insert Apply Positions with text array for custom_questions
INSERT INTO apply_positions (status, division_id, title, description, required_skills, desirable_skills, custom_questions, created_at) VALUES
('true', 1, 'Full-Stack Developer', 'We are looking for a Full-Stack Developer to join our team and help build and maintain our new website using Next.js, Supabase, and ShadCN. Our biggest goal is to develop a recruitment management system directly on our platform, making it easier for leads and chiefs to handle applications and organize team information.
What You will Do:

- Develop and maintain the team website using Next.js, Supabase, and ShadCN

- Implement and expand the admin section, where team leads manage recruitment and team data

- Enhance the website with smooth UI/UX improvements, animations, and interactions

- Improve existing pages and develop new ones as needed

- Work with Three.js to create engaging 3D elements and visualizations', 
   ARRAY['Strong fundamentals in HTML, CSS, and JavaScript', 'Problem-solving skills and ability to work independently on development tasks'], 
   ARRAY['Experience with Next.js and TypeScript', 'Familiarity with Supabase (authentication, database, storage)', 'Knowledge of ShadCN/UI for building modern and accessible interfaces', 'Knowledge and previous use of the Three.js library', 'Previous experience with Git and GitHub', 'Previous experience with PostgreSQL', 'Basic knowledge of Accessible Rich Internet Applications (ARIA)'], 
   ARRAY['Describe your experience with frontend frameworks', 'What React hooks do you use most frequently?']::text[], 
   '2023-02-01 10:00:00+01'::timestamptz),
   
('true', 2, 'Embedded Software Engineer', 'We are looking for a Full-Stack Developer to join our team and help build and maintain our new website using Next.js, Supabase, and ShadCN. Our biggest goal is to develop a recruitment management system directly on our platform, making it easier for leads and chiefs to handle applications and organize team information.
What You will Do:

- Develop and maintain the team website using Next.js, Supabase, and ShadCN

- Implement and expand the admin section, where team leads manage recruitment and team data

- Enhance the website with smooth UI/UX improvements, animations, and interactions

- Improve existing pages and develop new ones as needed

- Work with Three.js to create engaging 3D elements and visualizations', 
   ARRAY['Strong fundamentals in HTML, CSS, and JavaScript', 'Problem-solving skills and ability to work independently on development tasks'], 
   ARRAY['Experience with Next.js and TypeScript', 'Familiarity with Supabase (authentication, database, storage)', 'Knowledge of ShadCN/UI for building modern and accessible interfaces', 'Knowledge and previous use of the Three.js library', 'Previous experience with Git and GitHub', 'Previous experience with PostgreSQL', 'Basic knowledge of Accessible Rich Internet Applications (ARIA)'],
   ARRAY['What mobile apps have you built?', 'Do you prefer native or cross-platform development?']::text[], 
   '2023-02-15 11:30:00+01'::timestamptz),
   
('false', 3, 'Hardware Engineer', 'We are looking for a Full-Stack Developer to join our team and help build and maintain our new website using Next.js, Supabase, and ShadCN. Our biggest goal is to develop a recruitment management system directly on our platform, making it easier for leads and chiefs to handle applications and organize team information.
What You will Do:

- Develop and maintain the team website using Next.js, Supabase, and ShadCN

- Implement and expand the admin section, where team leads manage recruitment and team data

- Enhance the website with smooth UI/UX improvements, animations, and interactions

- Improve existing pages and develop new ones as needed

- Work with Three.js to create engaging 3D elements and visualizations', 
   ARRAY['Strong fundamentals in HTML, CSS, and JavaScript', 'Problem-solving skills and ability to work independently on development tasks'], 
   ARRAY['Experience with Next.js and TypeScript', 'Familiarity with Supabase (authentication, database, storage)', 'Knowledge of ShadCN/UI for building modern and accessible interfaces', 'Knowledge and previous use of the Three.js library', 'Previous experience with Git and GitHub', 'Previous experience with PostgreSQL', 'Basic knowledge of Accessible Rich Internet Applications (ARIA)'],  
   ARRAY['Describe your CAD design experience', 'Have you worked with parametric modeling?']::text[], 
   '2023-03-01 09:15:00+01'::timestamptz),
   
('true', 4, 'Mission Analyst', 'We are looking for a Full-Stack Developer to join our team and help build and maintain our new website using Next.js, Supabase, and ShadCN. Our biggest goal is to develop a recruitment management system directly on our platform, making it easier for leads and chiefs to handle applications and organize team information.
What You will Do:

- Develop and maintain the team website using Next.js, Supabase, and ShadCN

- Implement and expand the admin section, where team leads manage recruitment and team data

- Enhance the website with smooth UI/UX improvements, animations, and interactions

- Improve existing pages and develop new ones as needed

- Work with Three.js to create engaging 3D elements and visualizations', 
   ARRAY['Strong fundamentals in HTML, CSS, and JavaScript', 'Problem-solving skills and ability to work independently on development tasks'], 
   ARRAY['Experience with Next.js and TypeScript', 'Familiarity with Supabase (authentication, database, storage)', 'Knowledge of ShadCN/UI for building modern and accessible interfaces', 'Knowledge and previous use of the Three.js library', 'Previous experience with Git and GitHub', 'Previous experience with PostgreSQL', 'Basic knowledge of Accessible Rich Internet Applications (ARIA)'], 
   ARRAY['Have you built any physical prototypes before?', 'What fabrication tools are you familiar with?']::text[], 
   '2023-03-15 14:20:00+01'::timestamptz);



-- Insert Applications with timestamptz for applied_at
INSERT INTO applications (apply_position_id, user_id, ml_name, cv_name, applied_at, status, custom_answers) VALUES
(1, 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'chiara_ml.pdf', 'chiara_cv.pdf', '2023-02-05 16:45:00+01'::timestamptz, 'accepted', 
   ARRAY[
     jsonb_build_object(
       'question', 'Describe your experience with frontend frameworks',
       'answer', 'I have 2 years of experience with React and Vue, building responsive web applications'
     ),
     jsonb_build_object(
       'question', 'What React hooks do you use most frequently?',
       'answer', 'I primarily use useState, useEffect, useContext, and custom hooks for API calls'
     )
   ]),
(2, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'davide_ml.pdf', 'davide_cv.pdf', '2023-02-20 10:30:00+01'::timestamptz, 'pending', 
   ARRAY[
     jsonb_build_object(
       'question', 'What mobile apps have you built?',
       'answer', 'I built a fitness tracking app with Flutter and a social media app with React Native'
     ),
     jsonb_build_object(
       'question', 'Do you prefer native or cross-platform development?',
       'answer', 'I prefer cross-platform for rapid development, but native for performance-critical applications'
     )
   ]),
(3, 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'chiara_ml_cad.pdf', 'chiara_cv.pdf', '2023-03-05 13:15:00+01'::timestamptz, 'rejected', 
   ARRAY[
     jsonb_build_object(
       'question', 'Describe your CAD design experience',
       'answer', 'I have used SolidWorks for 3 years in university projects, designing mechanical parts and assemblies'
     ),
     jsonb_build_object(
       'question', 'Have you worked with parametric modeling?',
       'answer', 'Yes, I frequently use parametric modeling for creating adaptive designs that can be easily modified'
     )
   ]),
(4, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'davide_ml_proto.pdf', 'davide_cv_updated.pdf', '2023-03-20 11:45:00+01'::timestamptz, 'received', 
   ARRAY[
     jsonb_build_object(
       'question', 'Have you built any physical prototypes before?',
       'answer', 'Yes, I built a weather station prototype with Arduino and various sensors'
     ),
     jsonb_build_object(
       'question', 'What fabrication tools are you familiar with?',
       'answer', 'I am proficient with 3D printers, laser cutters, and basic electronics assembly tools'
     )
   ]);
