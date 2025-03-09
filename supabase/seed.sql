-- Clear existing data (if needed)
TRUNCATE members, users, subteams, divisions, roles, orders, apply_positions, applications RESTART IDENTITY CASCADE;

-- Insert Members (at least 10)
INSERT INTO members (member_id, has_pp, prt_email, mobile_number, discord, nda_signed_at, nda_name) VALUES
(1, true, 'marco.rossi@polito.it', '+39123456789', 'marco#1234', '2023-01-15 10:00:00+01'::timestamptz, 'Marco Rossi NDA'),
(2, true, 'giulia.ferrari@polito.it', '+39234567890', 'giulia#5678', '2023-01-20 11:30:00+01'::timestamptz, 'Giulia Ferrari NDA'),
(3, false, 'alessandro.russo@polito.it', '+39345678901', 'alex#9012', '2023-02-05 09:15:00+01'::timestamptz, 'Alessandro Russo NDA'),
(4, true, 'valentina.esposito@polito.it', '+39456789012', 'vale#3456', '2023-02-10 14:20:00+01'::timestamptz, 'Valentina Esposito NDA'),
(5, true, 'luca.bianchi@polito.it', '+39567890123', 'luca#7890', '2023-03-01 16:45:00+01'::timestamptz, 'Luca Bianchi NDA'),
(6, true, 'sofia.ricci@polito.it', '+39678901234', 'sofia#2345', '2023-03-15 10:30:00+01'::timestamptz, 'Sofia Ricci NDA'),
(7, false, 'matteo.conti@polito.it', '+39789012345', 'matteo#6789', '2023-04-01 13:15:00+02'::timestamptz, 'Matteo Conti NDA'),
(8, true, 'elena.martini@polito.it', '+39890123456', 'elena#0123', '2023-04-10 11:45:00+02'::timestamptz, 'Elena Martini NDA'),
(9, true, 'andrea.gallo@polito.it', '+39901234567', 'andrea#4567', '2023-04-20 14:30:00+02'::timestamptz, 'Andrea Gallo NDA'),
(10, false, 'francesca.leone@polito.it', '+39012345678', 'fran#8901', '2023-05-01 09:20:00+02'::timestamptz, 'Francesca Leone NDA'),
(11, true, 'simone.lombardi@polito.it', '+39123456780', 'simone#3456', '2023-05-10 10:15:00+02'::timestamptz, 'Simone Lombardi NDA'),
(12, true, 'claudia.marino@polito.it', '+39234567891', 'claudia#7890', '2023-05-15 13:30:00+02'::timestamptz, 'Claudia Marino NDA');

-- Insert Users with timestamptz for created_at and NULL for updated_at
INSERT INTO users (id, email, first_name, last_name, origin, level_of_study, linkedin, polito_id, program, member, created_at, updated_at) VALUES
('11111111-1111-1111-1111-111111111111', 'marco.rossi@studenti.polito.it', 'Marco', 'Rossi', 'Italy', 'Master', 'linkedin.com/in/marcorossi', 's123456', 'Computer Engineering', 1, '2023-01-10 10:00:00+01'::timestamptz, NULL),
('22222222-2222-2222-2222-222222222222', 'giulia.ferrari@studenti.polito.it', 'Giulia', 'Ferrari', 'Italy', 'Bachelor', 'linkedin.com/in/giuliaferrari', 's234567', 'Electronic Engineering', 2, '2023-01-15 11:30:00+01'::timestamptz, NULL),
('33333333-3333-3333-3333-333333333333', 'alessandro.russo@studenti.polito.it', 'Alessandro', 'Russo', 'Italy', 'PhD', 'linkedin.com/in/alessandrorusso', 's345678', 'Mechanical Engineering', 3, '2023-02-01 09:15:00+01'::timestamptz, NULL),
('44444444-4444-4444-4444-444444444444', 'valentina.esposito@studenti.polito.it', 'Valentina', 'Esposito', 'Italy', 'Master', 'linkedin.com/in/valentinaesposito', 's456789', 'Management Engineering', 4, '2023-02-05 14:20:00+01'::timestamptz, NULL),
('55555555-5555-5555-5555-555555555555', 'luca.bianchi@studenti.polito.it', 'Luca', 'Bianchi', 'Italy', 'Bachelor', 'linkedin.com/in/lucabianchi', 's567890', 'Computer Science', 5, '2023-02-20 16:45:00+01'::timestamptz, NULL),
('66666666-6666-6666-6666-666666666666', 'sofia.ricci@studenti.polito.it', 'Sofia', 'Ricci', 'Italy', 'Master', 'linkedin.com/in/sofiaricci', 's678901', 'Data Science', 6, '2023-03-10 10:30:00+01'::timestamptz, NULL),
('77777777-7777-7777-7777-777777777777', 'matteo.conti@studenti.polito.it', 'Matteo', 'Conti', 'Italy', 'Bachelor', 'linkedin.com/in/matteoconti', 's789012', 'Electronic Engineering', 7, '2023-03-15 13:15:00+01'::timestamptz, NULL),
('88888888-8888-8888-8888-888888888888', 'elena.martini@studenti.polito.it', 'Elena', 'Martini', 'Italy', 'Master', 'linkedin.com/in/elenamartini', 's890123', 'Architecture', 8, '2023-04-05 11:45:00+02'::timestamptz, NULL),
('99999999-9999-9999-9999-999999999999', 'andrea.gallo@studenti.polito.it', 'Andrea', 'Gallo', 'Italy', 'PhD', 'linkedin.com/in/andreagallo', 's901234', 'Mechanical Engineering', 9, '2023-04-15 14:30:00+02'::timestamptz, NULL),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'francesca.leone@studenti.polito.it', 'Francesca', 'Leone', 'Italy', 'Bachelor', 'linkedin.com/in/francescaleone', 's012345', 'Energy Engineering', 10, '2023-04-25 09:20:00+02'::timestamptz, NULL),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'simone.lombardi@studenti.polito.it', 'Simone', 'Lombardi', 'Italy', 'Master', 'linkedin.com/in/simonelombardi', 's123457', 'Computer Engineering', 11, '2023-05-10 10:15:00+02'::timestamptz, NULL),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'claudia.marino@studenti.polito.it', 'Claudia', 'Marino', 'Italy', 'Bachelor', 'linkedin.com/in/claudiamarino', 's234568', 'Biomedical Engineering', 12, '2023-05-15 13:30:00+02'::timestamptz, NULL),
('dddddddd-dddd-dddd-dddd-dddddddddddd', 'chiara.verdi@studenti.polito.it', 'Chiara', 'Verdi', 'Italy', 'Master', 'linkedin.com/in/chiaraverdi', 's678902', 'Biomedical Engineering', NULL, '2023-03-05 10:30:00+01'::timestamptz, NULL),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'davide.marino@studenti.polito.it', 'Davide', 'Marino', 'Italy', 'Bachelor', 'linkedin.com/in/davidemarino', 's789013', 'Aerospace Engineering', NULL, '2023-03-10 13:15:00+01'::timestamptz, NULL);

-- Insert Subteams (2 subteams)
INSERT INTO subteams (id, name, started_at, closed_at, code) VALUES
(1, 'Software Development', '2022-09-01'::date, NULL, 'SD'),
(2, 'Mechanical Design', '2022-09-01'::date, NULL, 'MD');

-- Insert Divisions (2 per subteam = 4 total)
INSERT INTO divisions (id, name, started_at, closed_at, code) VALUES
(1, 'Web Development', '2022-09-01'::date, NULL, 'WEB'),
(2, 'Mobile Development', '2022-09-01'::date, NULL, 'MOB'),
(3, 'CAD Design', '2022-09-01'::date, NULL, 'CAD'),
(4, 'Prototyping', '2022-09-01'::date, NULL, 'PRO');

-- Insert Roles with the required structure:
-- For each division: a lead and core-member
-- For each subteam: a chief and coordinator
-- And a President
INSERT INTO roles (id, member_id, subteam_id, division_id, title, started_at, leaved_at, type) VALUES
-- President (no subteam or division)
(1, 1, NULL, NULL, 'President', '2022-09-01'::date, NULL, 'chief'),

-- Software Development Subteam
-- Chief and Coordinator for Software Development
(2, 2, 1, NULL, 'Software Development Chief', '2022-09-10'::date, NULL, 'chief'),
(3, 3, 1, NULL, 'Software Development Coordinator', '2022-09-15'::date, NULL, 'coordinator'),

-- Web Development Division (under Software Dev)
(4, 4, 1, 1, 'Web Development Lead', '2022-09-20'::date, NULL, 'lead'),
(5, 5, 1, 1, 'Web Developer', '2022-09-25'::date, NULL, 'core_member'),

-- Mobile Development Division (under Software Dev)
(6, 6, 1, 2, 'Mobile Development Lead', '2022-10-01'::date, NULL, 'lead'),
(7, 7, 1, 2, 'Mobile Developer', '2022-10-05'::date, NULL, 'core_member'),

-- Mechanical Design Subteam
-- Chief and Coordinator for Mechanical Design
(8, 8, 2, NULL, 'Mechanical Design Chief', '2022-09-10'::date, NULL, 'chief'),
(9, 9, 2, NULL, 'Mechanical Design Coordinator', '2022-09-15'::date, NULL, 'coordinator'),

-- CAD Design Division (under Mechanical Design)
(10, 10, 2, 3, 'CAD Design Lead', '2022-09-20'::date, NULL, 'lead'),
(11, 11, 2, 3, 'CAD Designer', '2022-09-25'::date, NULL, 'core_member'),

-- Prototyping Division (under Mechanical Design)
(12, 12, 2, 4, 'Prototyping Lead', '2022-10-01'::date, NULL, 'lead'),
(13, 3, 2, 4, 'Prototyper', '2022-10-05'::date, NULL, 'core_member');

-- Insert Orders with timestamptz for created_at
INSERT INTO orders (id, status, requester, description, reason, quantity, price, name, created_at, quote_name) VALUES
(1, 'accepted', 1, 'Arduino Mega', 'For prototyping self-driving algorithms', 2, 80, 'Arduino Order', '2023-02-01 10:00:00+01'::timestamptz, 'quote_arduino.pdf'),
(2, 'pending', 2, 'Sensors Kit', 'Testing electronics for robot', 1, 150, 'Sensors Kit Order', '2023-02-15 11:30:00+01'::timestamptz, 'quote_sensors.pdf'),
(3, 'rejected', 3, 'CNC Machine Parts', 'Manufacturing prototype chassis', 10, 500, 'CNC Parts Order', '2023-03-01 09:15:00+01'::timestamptz, 'quote_cnc.pdf'),
(4, 'accepted', 4, 'Branded T-shirts', 'Team event promotion', 50, 750, 'T-shirt Order', '2023-03-15 14:20:00+01'::timestamptz, 'quote_tshirts.pdf'),
(5, 'pending', 5, 'Office Supplies', 'For team workspace', 1, 200, 'Office Supplies Order', '2023-04-01 16:45:00+02'::timestamptz, 'quote_office.pdf'),
(6, 'accepted', 6, 'Development Boards', 'For IoT prototyping', 5, 250, 'Dev Boards Order', '2023-04-15 10:30:00+02'::timestamptz, 'quote_devboards.pdf'),
(7, 'pending', 7, '3D Printing Filament', 'For rapid prototyping', 10, 300, '3D Filament Order', '2023-05-01 13:15:00+02'::timestamptz, 'quote_filament.pdf');

-- Insert Apply Positions with text array for custom_questions
INSERT INTO apply_positions (id, status, division_id, title, description, desirable_skills, required_skills, custom_questions, created_at) VALUES
(1, 'true', 1, 'Frontend Developer', 'Join our web team to develop the frontend of our applications', 
   ARRAY['React', 'Vue.js', 'UX/UI design', 'Responsive design'], 
   ARRAY['HTML', 'CSS', 'JavaScript', 'Git'], 
   ARRAY['Describe your experience with frontend frameworks', 'What React hooks do you use most frequently?']::text[], 
   '2023-02-01 10:00:00+01'::timestamptz),
   
(2, 'true', 2, 'Mobile App Developer', 'Work on our mobile applications', 
   ARRAY['Flutter', 'React Native', 'UI/UX for mobile', 'State management'], 
   ARRAY['Java', 'Swift', 'Mobile development', 'REST APIs'], 
   ARRAY['What mobile apps have you built?', 'Do you prefer native or cross-platform development?']::text[], 
   '2023-02-15 11:30:00+01'::timestamptz),
   
(3, 'false', 3, 'CAD Designer', 'Design mechanical components for our projects', 
   ARRAY['3D printing', 'Simulation', 'FEA analysis', 'GD&T'], 
   ARRAY['SolidWorks', 'AutoCAD', '3D modeling', 'Technical drawing'], 
   ARRAY['Describe your CAD design experience', 'Have you worked with parametric modeling?']::text[], 
   '2023-03-01 09:15:00+01'::timestamptz),
   
(4, 'true', 4, 'Prototyping Engineer', 'Build and test prototypes', 
   ARRAY['PCB design', 'Soldering', 'CNC machining', 'Microcontroller programming'], 
   ARRAY['Mechanical assembly', 'Testing procedures', 'Prototype documentation', 'Basic electronics'], 
   ARRAY['Have you built any physical prototypes before?', 'What fabrication tools are you familiar with?']::text[], 
   '2023-03-15 14:20:00+01'::timestamptz);



-- Insert Applications with timestamptz for applied_at
INSERT INTO applications (id, open_position_id, user_id, ml_name, cv_name, applied_at, status, custom_answers) VALUES
(1, 1, 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'chiara_ml.pdf', 'chiara_cv.pdf', '2023-02-05 16:45:00+01'::timestamptz, 'accepted', 
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
(2, 2, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'davide_ml.pdf', 'davide_cv.pdf', '2023-02-20 10:30:00+01'::timestamptz, 'pending', 
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
(3, 3, 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'chiara_ml_cad.pdf', 'chiara_cv.pdf', '2023-03-05 13:15:00+01'::timestamptz, 'rejected', 
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
(4, 4, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'davide_ml_proto.pdf', 'davide_cv_updated.pdf', '2023-03-20 11:45:00+01'::timestamptz, 'received', 
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
