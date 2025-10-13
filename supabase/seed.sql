-- Clear existing data (if needed)
TRUNCATE members, users, departments, divisions, roles, orders, apply_positions, applications, scopes RESTART IDENTITY CASCADE;

-- Insert Members (at least 10)
INSERT INTO members (member_id, prt_email, mobile_number, discord, nda_signed_at, nda_name, nda_confirmed_by, picture) VALUES
(13, 'marco.rossi@prt.it', '+39123456789', 'marco#1234', '2023-01-15 10:00:00+01'::timestamptz, 'Marco Rossi NDA', 1, 'https://avatar.iran.liara.run/public'),
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
(1, 'developer@prt.it', '+39234567891', 'test#7890', '2023-05-15 13:30:00+02'::timestamptz, 'developer NDA', 1, 'https://avatar.iran.liara.run/public'),

-- Additional members for division coverage
(14, 'giovanni.bruno@prt.it', '+39345678902', 'giovanni#1111', '2023-05-20 10:00:00+02'::timestamptz, 'Giovanni Bruno NDA', 1, 'https://avatar.iran.liara.run/public'),
(15, 'martina.costa@prt.it', '+39456789013', 'martina#2222', '2023-05-25 11:30:00+02'::timestamptz, 'Martina Costa NDA', 1, 'https://avatar.iran.liara.run/public'),
(16, 'federico.romano@prt.it', '+39567890124', 'federico#3333', '2023-06-01 09:15:00+02'::timestamptz, 'Federico Romano NDA', 1, 'https://avatar.iran.liara.run/public'),
(17, 'alice.fontana@prt.it', '+39678901235', 'alice#4444', '2023-06-05 14:20:00+02'::timestamptz, 'Alice Fontana NDA', 1, 'https://avatar.iran.liara.run/public'),
(18, 'lorenzo.sala@prt.it', '+39789012346', 'lorenzo#5555', '2023-06-10 16:45:00+02'::timestamptz, 'Lorenzo Sala NDA', 1, 'https://avatar.iran.liara.run/public'),
(19, 'beatrice.moro@prt.it', '+39890123457', 'beatrice#6666', '2023-06-15 10:30:00+02'::timestamptz, 'Beatrice Moro NDA', 1, 'https://avatar.iran.liara.run/public'),
(20, 'tommaso.ferrari@prt.it', '+39901234568', 'tommaso#7777', '2023-06-20 13:15:00+02'::timestamptz, 'Tommaso Ferrari NDA', 1, 'https://avatar.iran.liara.run/public'),
(21, 'sara.barbieri@prt.it', '+39012345679', 'sara#8888', '2023-06-25 11:45:00+02'::timestamptz, 'Sara Barbieri NDA', 1, 'https://avatar.iran.liara.run/public'),
(22, 'nicolo.benedetti@prt.it', '+39123456791', 'nicolo#9999', '2023-07-01 14:30:00+02'::timestamptz, 'Nicolò Benedetti NDA', 1, 'https://avatar.iran.liara.run/public'),
(23, 'camilla.de.santis@prt.it', '+39234567892', 'camilla#0000', '2023-07-05 09:20:00+02'::timestamptz, 'Camilla De Santis NDA', 1, 'https://avatar.iran.liara.run/public'),
(24, 'riccardo.grassi@prt.it', '+39345678903', 'riccardo#1010', '2023-07-10 10:15:00+02'::timestamptz, 'Riccardo Grassi NDA', 1, 'https://avatar.iran.liara.run/public'),
(25, 'anna.serra@prt.it', '+39456789014', 'anna#2020', '2023-07-15 13:30:00+02'::timestamptz, 'Anna Serra NDA', 1, 'https://avatar.iran.liara.run/public'),
(26, 'manuel.vitale@prt.it', '+39567890125', 'manuel#3030', '2023-07-20 10:30:00+02'::timestamptz, 'Manuel Vitale NDA', 1, 'https://avatar.iran.liara.run/public'),
(27, 'jessica.monti@prt.it', '+39678901236', 'jessica#4040', '2023-07-25 13:15:00+02'::timestamptz, 'Jessica Monti NDA', 1, 'https://avatar.iran.liara.run/public'),
(28, 'antonio.palmieri@prt.it', '+39789012347', 'antonio#5050', '2023-08-01 11:45:00+02'::timestamptz, 'Antonio Palmieri NDA', 1, 'https://avatar.iran.liara.run/public'),
(29, 'chiara.santoro@prt.it', '+39890123458', 'chiara#6060', '2023-08-05 14:30:00+02'::timestamptz, 'Chiara Santoro NDA', 1, 'https://avatar.iran.liara.run/public'),
(30, 'marco.caruso@prt.it', '+39901234569', 'marco#7070', '2023-08-10 09:20:00+02'::timestamptz, 'Marco Caruso NDA', 1, 'https://avatar.iran.liara.run/public'),
(31, 'elena.moretti@prt.it', '+39012345680', 'elena#8080', '2023-08-15 10:15:00+02'::timestamptz, 'Elena Moretti NDA', 1, 'https://avatar.iran.liara.run/public'),
(32, 'luca.pellegrini@prt.it', '+39123456792', 'luca#9090', '2023-08-20 13:30:00+02'::timestamptz, 'Luca Pellegrini NDA', 1, 'https://avatar.iran.liara.run/public'),
(33, 'sofia.greco@prt.it', '+39234567893', 'sofia#1212', '2023-08-25 10:30:00+02'::timestamptz, 'Sofia Greco NDA', 1, 'https://avatar.iran.liara.run/public'),
(34, 'matteo.villa@prt.it', '+39345678904', 'matteo#2323', '2023-09-01 13:15:00+02'::timestamptz, 'Matteo Villa NDA', 1, 'https://avatar.iran.liara.run/public'),
(35, 'giulia.longo@prt.it', '+39456789015', 'giulia#3434', '2023-09-05 11:45:00+02'::timestamptz, 'Giulia Longo NDA', 1, 'https://avatar.iran.liara.run/public'),
(36, 'davide.rosso@prt.it', '+39567890126', 'davide#4545', '2023-09-10 14:30:00+02'::timestamptz, 'Davide Rosso NDA', 1, 'https://avatar.iran.liara.run/public'),
(37, 'laura.verde@prt.it', '+39678901237', 'laura#5656', '2023-09-15 09:20:00+02'::timestamptz, 'Laura Verde NDA', 1, 'https://avatar.iran.liara.run/public'),
(38, 'gabriele.azzurro@prt.it', '+39789012348', 'gabriele#6767', '2023-09-20 10:15:00+02'::timestamptz, 'Gabriele Azzurro NDA', 1, 'https://avatar.iran.liara.run/public');

-- Insert Users with timestamptz for created_at and NULL for updated_at
INSERT INTO users (id, email, first_name, last_name, origin, level_of_study, linkedin, polito_id, program, member, created_at, updated_at, access) VALUES
('11111111-1111-1111-1111-111111111111', 'marco.rossi@example.com', 'Marco', 'Rossi', 'Italy', 'Master', 'linkedin.com/in/marcorossi', 's123456', 'Computer Engineering', 13, '2023-01-10 10:00:00+01'::timestamptz, NULL, ARRAY['drive', 'wiki']),
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

-- Users for team members 14-38
('1a111111-1111-1111-1111-111111111111', 'giovanni.bruno@example.com', 'Giovanni', 'Bruno', 'Italy', 'Master', 'linkedin.com/in/giovannibruno', 's345902', 'Propulsion Engineering', 14, '2023-05-20 10:00:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('1a222222-2222-2222-2222-222222222222', 'martina.costa@example.com', 'Martina', 'Costa', 'Italy', 'Bachelor', 'linkedin.com/in/martinacosta', 's456013', 'Chemical Engineering', 15, '2023-05-25 11:30:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('1a333333-3333-3333-3333-333333333333', 'federico.romano@example.com', 'Federico', 'Romano', 'Italy', 'Master', 'linkedin.com/in/federicoromano', 's567124', 'Propulsion Engineering', 16, '2023-06-01 09:15:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('1a444444-4444-4444-4444-444444444444', 'alice.fontana@example.com', 'Alice', 'Fontana', 'Italy', 'PhD', 'linkedin.com/in/alicefontana', 's678235', 'Mechanical Engineering', 17, '2023-06-05 14:20:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('1a555555-5555-5555-5555-555555555555', 'lorenzo.sala@example.com', 'Lorenzo', 'Sala', 'Italy', 'Master', 'linkedin.com/in/lorenzosala', 's789346', 'Structural Engineering', 18, '2023-06-10 16:45:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('1a666666-6666-6666-6666-666666666666', 'beatrice.moro@example.com', 'Beatrice', 'Moro', 'Italy', 'Bachelor', 'linkedin.com/in/beatricemoro', 's890457', 'Aerospace Engineering', 19, '2023-06-15 10:30:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('1a777777-7777-7777-7777-777777777777', 'tommaso.ferrari@example.com', 'Tommaso', 'Ferrari', 'Italy', 'Master', 'linkedin.com/in/tommasoferrari', 's901568', 'Aerospace Engineering', 20, '2023-06-20 13:15:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('1a888888-8888-8888-8888-888888888888', 'sara.barbieri@example.com', 'Sara', 'Barbieri', 'Italy', 'PhD', 'linkedin.com/in/sarabarbieri', 's012679', 'Operations Management', 21, '2023-06-25 11:45:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('1a999999-9999-9999-9999-999999999999', 'nicolo.benedetti@example.com', 'Nicolò', 'Benedetti', 'Italy', 'Master', 'linkedin.com/in/nicolobenedetti', 's123790', 'Computer Engineering', 22, '2023-07-01 14:30:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('1b111111-1111-1111-1111-111111111111', 'camilla.de.santis@example.com', 'Camilla', 'De Santis', 'Italy', 'Bachelor', 'linkedin.com/in/camilladesantis', 's234891', 'Computer Science', 23, '2023-07-05 09:20:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('1b222222-2222-2222-2222-222222222222', 'riccardo.grassi@example.com', 'Riccardo', 'Grassi', 'Italy', 'Master', 'linkedin.com/in/riccardograssi', 's345902', 'Electronic Engineering', 24, '2023-07-10 10:15:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('1b333333-3333-3333-3333-333333333333', 'anna.serra@example.com', 'Anna', 'Serra', 'Italy', 'PhD', 'linkedin.com/in/annaserra', 's456013', 'Electronic Engineering', 25, '2023-07-15 13:30:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('1b444444-4444-4444-4444-444444444444', 'manuel.vitale@example.com', 'Manuel', 'Vitale', 'Italy', 'Master', 'linkedin.com/in/manuelvitale', 's567124', 'Control Systems Engineering', 26, '2023-07-20 10:30:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('1b555555-5555-5555-5555-555555555555', 'jessica.monti@example.com', 'Jessica', 'Monti', 'Italy', 'Bachelor', 'linkedin.com/in/jessicamonti', 's678235', 'Aerospace Engineering', 27, '2023-07-25 13:15:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('1b666666-6666-6666-6666-666666666666', 'antonio.palmieri@example.com', 'Antonio', 'Palmieri', 'Italy', 'Master', 'linkedin.com/in/antoniopalmieri', 's789346', 'Aerospace Engineering', 28, '2023-08-01 11:45:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('1b777777-7777-7777-7777-777777777777', 'chiara.santoro@example.com', 'Chiara', 'Santoro', 'Italy', 'PhD', 'linkedin.com/in/chiarasantoro', 's890457', 'Computer Science', 29, '2023-08-05 14:30:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('1b888888-8888-8888-8888-888888888888', 'marco.caruso@example.com', 'Marco', 'Caruso', 'Italy', 'Master', 'linkedin.com/in/marcocaruso', 's901568', 'Mechanical Engineering', 30, '2023-08-10 09:20:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('1b999999-9999-9999-9999-999999999999', 'elena.moretti@example.com', 'Elena', 'Moretti', 'Italy', 'Bachelor', 'linkedin.com/in/elenamoretti', 's012679', 'Mechanical Engineering', 31, '2023-08-15 10:15:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('1c111111-1111-1111-1111-111111111111', 'luca.pellegrini@example.com', 'Luca', 'Pellegrini', 'Italy', 'Master', 'linkedin.com/in/lucapellegrini', 's123790', 'Propulsion Engineering', 32, '2023-08-20 13:30:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('1c222222-2222-2222-2222-222222222222', 'sofia.greco@example.com', 'Sofia', 'Greco', 'Italy', 'PhD', 'linkedin.com/in/sofiagreco', 's234891', 'Chemical Engineering', 33, '2023-08-25 10:30:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('1c333333-3333-3333-3333-333333333333', 'matteo.villa@example.com', 'Matteo', 'Villa', 'Italy', 'Master', 'linkedin.com/in/matteovilla', 's345902', 'Propulsion Engineering', 34, '2023-09-01 13:15:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('1c444444-4444-4444-4444-444444444444', 'giulia.longo@example.com', 'Giulia', 'Longo', 'Italy', 'Bachelor', 'linkedin.com/in/giulialongo', 's456013', 'Chemical Engineering', 35, '2023-09-05 11:45:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('1c555555-5555-5555-5555-555555555555', 'davide.rosso@example.com', 'Davide', 'Rosso', 'Italy', 'Master', 'linkedin.com/in/daviderosso', 's567124', 'Communications Engineering', 36, '2023-09-10 14:30:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('1c666666-6666-6666-6666-666666666666', 'laura.verde@example.com', 'Laura', 'Verde', 'Italy', 'Bachelor', 'linkedin.com/in/lauraverde', 's678235', 'Management Engineering', 37, '2023-09-15 09:20:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('1c777777-7777-7777-7777-777777777777', 'gabriele.azzurro@example.com', 'Gabriele', 'Azzurro', 'Italy', 'Master', 'linkedin.com/in/gabrieleazzurro', 's789346', 'Computer Engineering', 38, '2023-09-20 10:15:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),

('dddddddd-dddd-dddd-dddd-dddddddddddd', 'chiara.verdi@example.com', 'Chiara', 'Verdi', 'Italy', 'Master', 'linkedin.com/in/chiaraverdi', 's678902', 'Biomedical Engineering', NULL, '2023-03-05 10:30:00+01'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'davide.marino@example.com', 'Davide', 'Marino', 'Italy', 'Bachelor', 'linkedin.com/in/davidemarino', 's789013', 'Aerospace Engineering', NULL, '2023-03-10 13:15:00+01'::timestamptz, NULL, ARRAY['drive', 'wiki']),

-- New applicants for the new positions (unique individuals, not team members)
('f1111111-1111-1111-1111-111111111111', 'lorenzo.bruno@example.com', 'Lorenzo', 'Bruno', 'Italy', 'Master', 'linkedin.com/in/lorenzobruno', 's345901', 'Communication Design', NULL, '2023-06-01 10:00:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('f2222222-2222-2222-2222-222222222222', 'martina.bianchi@example.com', 'Martina', 'Bianchi', 'Italy', 'Bachelor', 'linkedin.com/in/martinabianchi', 's456012', 'Cinema and Media Engineering', NULL, '2023-06-02 11:30:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('f3333333-3333-3333-3333-333333333333', 'federico.neri@example.com', 'Federico', 'Neri', 'Italy', 'Master', 'linkedin.com/in/federiconeri', 's567123', 'Communications Engineering', NULL, '2023-06-03 09:15:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('f4444444-4444-4444-4444-444444444444', 'alice.rossi@example.com', 'Alice', 'Rossi', 'Italy', 'PhD', 'linkedin.com/in/alicerossi', 's678234', 'Computer Engineering', NULL, '2023-06-04 14:20:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('f5555555-5555-5555-5555-555555555555', 'giovanni.villa@example.com', 'Giovanni', 'Villa', 'Italy', 'Master', 'linkedin.com/in/giovannivilla', 's789345', 'Management Engineering', NULL, '2023-06-05 16:45:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('f6666666-6666-6666-6666-666666666666', 'beatrice.conti@example.com', 'Beatrice', 'Conti', 'Italy', 'Bachelor', 'linkedin.com/in/beatriceconti', 's890456', 'Event Management', NULL, '2023-06-06 10:30:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('f7777777-7777-7777-7777-777777777777', 'tommaso.ricci@example.com', 'Tommaso', 'Ricci', 'Italy', 'Master', 'linkedin.com/in/tommasoricci', 's901567', 'Industrial Engineering', NULL, '2023-06-07 13:15:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('f8888888-8888-8888-8888-888888888888', 'sara.galli@example.com', 'Sara', 'Galli', 'Italy', 'PhD', 'linkedin.com/in/saragalli', 's012678', 'Safety Engineering', NULL, '2023-06-08 11:45:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('f9999999-9999-9999-9999-999999999999', 'nicolo.mancini@example.com', 'Nicolò', 'Mancini', 'Italy', 'Master', 'linkedin.com/in/nicolomancini', 's123789', 'Computer Engineering', NULL, '2023-06-09 14:30:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('1d111111-1111-1111-1111-111111111111', 'camilla.fabbri@example.com', 'Camilla', 'Fabbri', 'Italy', 'Bachelor', 'linkedin.com/in/camillafabbri', 's234890', 'Computer Science', NULL, '2023-06-10 09:20:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('1d222222-2222-2222-2222-222222222222', 'riccardo.monti@example.com', 'Riccardo', 'Monti', 'Italy', 'Master', 'linkedin.com/in/riccardomonti', 's345901', 'Electronic Engineering', NULL, '2023-06-11 10:15:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('1d333333-3333-3333-3333-333333333333', 'anna.lucchesi@example.com', 'Anna', 'Lucchesi', 'Italy', 'PhD', 'linkedin.com/in/annalucchesi', 's456012', 'Electronic Engineering', NULL, '2023-06-12 13:30:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('1d444444-4444-4444-4444-444444444444', 'manuel.testa@example.com', 'Manuel', 'Testa', 'Italy', 'Master', 'linkedin.com/in/manueltesta', 's567123', 'Control Systems Engineering', NULL, '2023-06-13 10:30:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('1d555555-5555-5555-5555-555555555555', 'jessica.orlando@example.com', 'Jessica', 'Orlando', 'Italy', 'Bachelor', 'linkedin.com/in/jessicaorlando', 's678234', 'Aerospace Engineering', NULL, '2023-06-14 13:15:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('1d666666-6666-6666-6666-666666666666', 'antonio.marchetti@example.com', 'Antonio', 'Marchetti', 'Italy', 'Master', 'linkedin.com/in/antoniomarchetti', 's789345', 'Aerospace Engineering', NULL, '2023-06-15 11:45:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('1d777777-7777-7777-7777-777777777777', 'chiara.milani@example.com', 'Chiara', 'Milani', 'Italy', 'PhD', 'linkedin.com/in/chiaramilani', 's890456', 'Computer Science', NULL, '2023-06-16 14:30:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('1d888888-8888-8888-8888-888888888888', 'marco.bernardi@example.com', 'Marco', 'Bernardi', 'Italy', 'Master', 'linkedin.com/in/marcobernardi', 's901567', 'Mechanical Engineering', NULL, '2023-06-17 09:20:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('1d999999-9999-9999-9999-999999999999', 'elena.barone@example.com', 'Elena', 'Barone', 'Italy', 'Bachelor', 'linkedin.com/in/elenabarone', 's012678', 'Mechanical Engineering', NULL, '2023-06-18 10:15:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('1e111111-1111-1111-1111-111111111111', 'luca.fiore@example.com', 'Luca', 'Fiore', 'Italy', 'Master', 'linkedin.com/in/lucafiore', 's123789', 'Propulsion Engineering', NULL, '2023-06-19 13:30:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('1e222222-2222-2222-2222-222222222222', 'sofia.colombo@example.com', 'Sofia', 'Colombo', 'Italy', 'PhD', 'linkedin.com/in/sofiacolombo', 's234890', 'Chemical Engineering', NULL, '2023-06-20 10:30:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('1e333333-3333-3333-3333-333333333333', 'matteo.leone@example.com', 'Matteo', 'Leone', 'Italy', 'Master', 'linkedin.com/in/matteoleone', 's345901', 'Propulsion Engineering', NULL, '2023-06-21 13:15:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']),
('1e444444-4444-4444-4444-444444444444', 'giulia.ferri@example.com', 'Giulia', 'Ferri', 'Italy', 'Bachelor', 'linkedin.com/in/giuliaferri', 's456012', 'Chemical Engineering', NULL, '2023-06-22 11:45:00+02'::timestamptz, NULL, ARRAY['drive', 'wiki']);

-- Insert Subteams (2 subteams)
INSERT INTO departments (name, started_at, closed_at, code) VALUES
('Propulsion', '2022-09-01'::date, NULL, 'PRO'),
('Structures', '2022-05-01'::date, NULL, 'STR'),
('Aerodynamics', '2022-05-01'::date, NULL, 'AER'),
('Recovery', '2022-06-01'::date, NULL, 'RCV'),
('Controls and Systems', '2022-05-01'::date, NULL, 'CAS'),
('Electronics', '2022-04-01'::date, NULL, 'ELT'),
('Operations', '2022-10-01'::date, NULL, 'OPS'),
('Research and Development', '2023-09-01'::date, NULL, 'RND');

-- Insert Divisions (2 per subteam = 4 total)
INSERT INTO divisions (dept_id, name, started_at, closed_at, code) VALUES
(1, 'Test Bench', '2022-09-01'::date, NULL, 'TBE'),
(1, 'Liquid Systems Architecture', '2022-09-01'::date, NULL, 'LSA'),
(1, 'Thrust Chamber Assembly', '2022-09-01'::date, NULL, 'TCA'),
(2, 'Design and Manufacturing', '2022-09-01'::date, NULL, 'DAM'),
(2, 'Structural Analysis', '2022-09-01'::date, NULL, 'SAN'),
(3, 'Mission Analysis', '2022-09-01'::date, NULL, 'MSA'),
(3, 'Optimization and Analysis', '2022-09-01'::date, NULL, 'AOA'),
(5, 'Flight Control Systems', '2022-09-01'::date, NULL, 'FCS'),
(5, 'Engine Control & Systems', '2022-09-01'::date, NULL, 'ECS'),
(6, 'Ground Station', '2022-09-01'::date, NULL, 'GNS'),
(6, 'Firmware', '2022-09-01'::date, NULL, 'FMW'),
(6, 'Hardware', '2022-09-01'::date, NULL, 'HDW'),
(4, 'Recovery', '2022-09-01'::date, NULL, 'RCV'),
(7, 'Safety', '2022-09-01'::date, NULL, 'SFT'),
(7, 'Logistics', '2022-09-01'::date, NULL, 'LGS'),
(7, 'Communications', '2022-09-01'::date, NULL, 'CMS'),
(7, 'Information Technology', '2022-09-01'::date, NULL, 'ITC');

-- Insert Roles with the required structure:
-- For each division: a lead and core
-- And a President
INSERT INTO roles (member_id, dept_id, division_id, title, started_at, leaved_at, type) VALUES
(1, NULL, NULL, 'President', '2022-09-01'::date, NULL, 'president'),

-- Propulsion Department (dept_id: 1)
(2, 1, NULL, 'Head of Propulsion', '2022-09-10'::date, NULL, 'head'),

-- Test Bench Division (division_id: 1)
(14, 1, 1, 'Test Bench Lead', '2022-09-20'::date, NULL, 'lead'),
(15, 1, 1, 'Test Operations Engineer', '2022-09-25'::date, NULL, 'core'),

-- Liquid Systems Architecture Division (division_id: 2)
(16, 1, 2, 'LSA Lead Engineer', '2022-10-01'::date, NULL, 'lead'),
(32, 1, 2, 'Feed Systems Engineer', '2022-10-05'::date, NULL, 'core'),

-- Thrust Chamber Assembly Division (division_id: 3)
(34, 1, 3, 'TCA Lead Engineer', '2022-10-10'::date, NULL, 'lead'),
(35, 1, 3, 'Combustion Engineer', '2022-10-15'::date, NULL, 'core'),

-- Structures Department (dept_id: 2)
(4, 2, NULL, 'Head of Structures', '2022-09-10'::date, NULL, 'head'),

-- Design and Manufacturing Division (division_id: 4)
(17, 2, 4, 'Design & Manufacturing Lead', '2022-09-20'::date, NULL, 'lead'),
(30, 2, 4, 'Manufacturing Engineer', '2022-09-25'::date, NULL, 'core'),

-- Structural Analysis Division (division_id: 5)
(18, 2, 5, 'Structural Analysis Lead', '2022-10-01'::date, NULL, 'lead'),
(31, 2, 5, 'FEA Specialist', '2022-10-05'::date, NULL, 'core'),

-- Aerodynamics Department (dept_id: 3)
(6, 3, NULL, 'Head of Aerodynamics', '2022-09-10'::date, NULL, 'head'),

-- Mission Analysis Division (division_id: 6)
(19, 3, 6, 'Mission Analysis Lead', '2022-09-20'::date, NULL, 'lead'),
(28, 3, 6, 'Mission Analyst', '2022-09-25'::date, NULL, 'core'),

-- Optimization and Analysis Division (division_id: 7)
(20, 3, 7, 'Optimization Lead', '2022-10-01'::date, NULL, 'lead'),
(29, 3, 7, 'Analysis Software Engineer', '2022-10-05'::date, NULL, 'core'),

-- Recovery Department (dept_id: 4)
(8, 4, NULL, 'Head of Recovery', '2022-09-10'::date, NULL, 'head'),

-- Recovery Division (division_id: 13)
(27, 4, 13, 'Recovery Lead Engineer', '2022-09-20'::date, NULL, 'lead'),
(21, 4, 13, 'Parachute Systems Engineer', '2022-09-25'::date, NULL, 'core'),

-- Controls and Systems Department (dept_id: 5)
(10, 5, NULL, 'Head of Controls', '2022-09-10'::date, NULL, 'head'),

-- Flight Control Systems Division (division_id: 8)
(26, 5, 8, 'Flight Control Lead', '2022-09-20'::date, NULL, 'lead'),
(22, 5, 8, 'GNC Engineer', '2022-09-25'::date, NULL, 'core'),

-- Engine Control & Systems Division (division_id: 9)
(23, 5, 9, 'Engine Control Lead', '2022-10-01'::date, NULL, 'lead'),
(24, 5, 9, 'Systems Integration Engineer', '2022-10-05'::date, NULL, 'core'),

-- Electronics Department (dept_id: 6)
(12, 6, NULL, 'Head of Electronics', '2022-09-10'::date, NULL, 'head'),

-- Ground Station Division (division_id: 10)
(33, 6, 10, 'Ground Station Lead', '2022-09-20'::date, NULL, 'lead'),
(36, 6, 10, 'RF Systems Engineer', '2022-09-25'::date, NULL, 'core'),

-- Firmware Division (division_id: 11)
(37, 6, 11, 'Firmware Lead', '2022-10-01'::date, NULL, 'lead'),
(38, 6, 11, 'Embedded Software Engineer', '2022-10-05'::date, NULL, 'core'),

-- Hardware Division (division_id: 12)
(13, 6, 12, 'Hardware Lead Engineer', '2022-10-10'::date, NULL, 'lead'),
(2, 6, 12, 'PCB Design Engineer', '2022-10-15'::date, NULL, 'core'),

-- Operations Department (dept_id: 7)
(3, 7, NULL, 'Head of Operations', '2022-09-10'::date, NULL, 'head'),

-- Safety Division (division_id: 14)
(5, 7, 14, 'Safety Officer', '2022-09-20'::date, NULL, 'lead'),
(6, 7, 14, 'Safety Engineer', '2022-09-25'::date, NULL, 'core'),

-- Logistics Division (division_id: 15)
(7, 7, 15, 'Logistics Lead', '2022-10-01'::date, NULL, 'lead'),
(8, 7, 15, 'Supply Chain Coordinator', '2022-10-05'::date, NULL, 'core'),

-- Communications Division (division_id: 16)
(9, 7, 16, 'Communications Lead', '2022-10-10'::date, NULL, 'lead'),
(10, 7, 16, 'Media Specialist', '2022-10-15'::date, NULL, 'core'),

-- Information Technology Division (division_id: 17)
(11, 7, 17, 'IT Lead', '2022-10-20'::date, NULL, 'lead'),
(12, 7, 17, 'Software Developer', '2022-10-25'::date, NULL, 'core');

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
('true', 17, 'Full-Stack Developer', 'We are looking for a Full-Stack Developer to join our team and help build and maintain our new website using Next.js, Supabase, and ShadCN. Our biggest goal is to develop a recruitment management system directly on our platform, making it easier for leads and chiefs to handle applications and organize team information. What You will Do: - Develop and maintain the team website using Next.js, Supabase, and ShadCN - Implement and expand the admin section, where team leads manage recruitment and team data - Enhance the website with smooth UI/UX improvements, animations, and interactions - Improve existing pages and develop new ones as needed - Work with Three.js to create engaging 3D elements and visualizations', 
   ARRAY['Strong fundamentals in HTML, CSS, and JavaScript', 'Problem-solving skills and ability to work independently on development tasks'], 
   ARRAY['Experience with Next.js and TypeScript', 'Familiarity with Supabase (authentication, database, storage)', 'Knowledge of ShadCN/UI for building modern and accessible interfaces', 'Knowledge and previous use of the Three.js library', 'Previous experience with Git and GitHub', 'Previous experience with PostgreSQL', 'Basic knowledge of Accessible Rich Internet Applications (ARIA)'], 
   ARRAY['Describe your experience with frontend frameworks', 'What React hooks do you use most frequently?']::text[], 
   '2023-02-01 10:00:00+01'::timestamptz),
   
-- New positions from the user request
('true', 16, 'Graphic Designer', 'Join our Communications team as a Graphic Designer to create compelling visual content for our rocket team. You will be responsible for designing promotional materials, technical diagrams, social media graphics, and brand assets that effectively communicate our mission and achievements.', 
   ARRAY['Proficiency in Adobe Creative Suite (Photoshop, Illustrator, InDesign)', 'Strong understanding of design principles and typography', 'Experience with brand guidelines and visual identity'], 
   ARRAY['Experience with technical illustration and engineering diagrams', 'Knowledge of web design and UI/UX principles', 'Familiarity with 3D rendering software', 'Video editing capabilities', 'Understanding of aerospace/engineering context'], 
   ARRAY['What design software do you use most frequently?', 'Can you share examples of technical illustrations you have created?']::text[], 
   '2023-06-01 10:00:00+02'::timestamptz),

('true', 16, 'Photographer & Videomaker', 'Capture and create stunning visual content documenting our rocket development journey. You will be responsible for photographing test events, creating promotional videos, documenting team activities, and producing engaging multimedia content for our communications channels.', 
   ARRAY['Experience with professional photography equipment', 'Video production and editing skills', 'Understanding of lighting and composition'], 
   ARRAY['Drone photography/videography certification', 'Experience with technical/industrial photography', 'Live streaming and event coverage experience', 'Color grading and post-production expertise', 'Social media content creation'], 
   ARRAY['What camera equipment are you familiar with?', 'Do you have experience filming technical/engineering content?']::text[], 
   '2023-06-01 10:15:00+02'::timestamptz),

('true', 16, 'Social Media Manager', 'Lead our digital presence and engage with the aerospace community through strategic social media management. You will develop content strategies, manage our social media channels, create engaging posts, and help build our brand presence across multiple platforms.', 
   ARRAY['Social media strategy and content planning', 'Strong written communication skills', 'Understanding of social media analytics'], 
   ARRAY['Experience with aerospace/engineering content', 'Graphic design skills for social media', 'Community management experience', 'Influencer outreach and partnerships', 'Crisis communication management'], 
   ARRAY['Which social media platforms do you have experience managing?', 'How do you measure social media success?']::text[], 
   '2023-06-01 10:30:00+02'::timestamptz),

('true', 15, 'Sponsoring Specialist', 'Lead our sponsorship and partnership efforts to secure funding and resources for our rocket projects. You will identify potential sponsors, develop sponsorship packages, maintain relationships with existing partners, and coordinate sponsor recognition activities.', 
   ARRAY['Business development and partnership skills', 'Strong communication and presentation abilities', 'Project management and organizational skills'], 
   ARRAY['Experience in aerospace or technical sponsorships', 'Knowledge of corporate partnership structures', 'Grant writing experience', 'Event planning and coordination', 'Understanding of aerospace industry'], 
   ARRAY['What types of partnerships have you developed before?', 'How do you approach sponsor relationship management?']::text[], 
   '2023-06-01 11:00:00+02'::timestamptz),

('true', 15, 'Events Specialist', 'Plan and execute engaging events that showcase our rocket team and connect with the aerospace community. You will organize test launches, public demonstrations, educational outreach events, and coordinate with venues, vendors, and attendees.', 
   ARRAY['Event planning and coordination experience', 'Project management skills', 'Strong organizational and time management abilities'], 
   ARRAY['Experience with technical or aerospace events', 'Vendor management and contract negotiation', 'Risk assessment and safety planning', 'Marketing and promotional experience', 'Budget management skills'], 
   ARRAY['What types of events have you organized before?', 'How do you handle event logistics and coordination?']::text[], 
   '2023-06-01 11:15:00+02'::timestamptz),

('true', 15, 'Test & Mission Support Specialist', 'Provide critical logistical support for our rocket testing and mission operations. You will coordinate test schedules, manage equipment logistics, ensure safety protocols are followed, and provide operational support during testing phases.', 
   ARRAY['Strong organizational and coordination skills', 'Understanding of safety protocols and procedures', 'Ability to work under pressure in dynamic environments'], 
   ARRAY['Experience with technical testing environments', 'Knowledge of aerospace safety standards', 'Equipment maintenance and inventory management', 'Communication with regulatory bodies', 'Data collection and documentation skills'], 
   ARRAY['Do you have experience with technical testing operations?', 'How do you prioritize safety in high-stakes environments?']::text[], 
   '2023-06-01 11:30:00+02'::timestamptz),

('true', 14, 'Safety Officer', 'Ensure the highest safety standards across all our rocket development and testing activities. You will develop safety protocols, conduct risk assessments, oversee safety training, and monitor compliance with safety regulations during all team operations.', 
   ARRAY['Knowledge of safety regulations and standards', 'Risk assessment and management skills', 'Strong attention to detail and analytical thinking'], 
   ARRAY['Aerospace or high-hazard industry safety experience', 'Safety certification (OSHA, NEBOSH, or equivalent)', 'Incident investigation and reporting', 'Safety training and education experience', 'Regulatory compliance knowledge'], 
   ARRAY['What safety certifications do you hold?', 'Describe your approach to risk assessment in technical environments']::text[], 
   '2023-06-01 11:45:00+02'::timestamptz),

('true', 11, 'Embedded Software Engineer', 'Develop embedded software solutions for our rocket systems, including flight computers, sensor interfaces, and control algorithms. You will work on real-time systems, implement communication protocols, and ensure reliable software performance in challenging environments.', 
   ARRAY['Embedded C/C++ programming experience', 'Understanding of microcontrollers and real-time systems', 'Knowledge of communication protocols (SPI, I2C, UART)'], 
   ARRAY['Experience with aerospace or automotive embedded systems', 'RTOS (Real-Time Operating Systems) experience', 'Hardware debugging and testing', 'Version control and collaborative development', 'Knowledge of safety-critical software standards'], 
   ARRAY['What embedded platforms have you worked with?', 'Describe your experience with real-time systems development']::text[], 
   '2023-06-01 12:00:00+02'::timestamptz),

('true', 10, 'Desktop Application Developer', 'Create desktop applications for ground station operations, data analysis, and mission control. You will develop user interfaces for rocket telemetry, real-time monitoring systems, and data visualization tools for mission operations.', 
   ARRAY['Desktop application development experience', 'UI/UX design and implementation skills', 'Understanding of real-time data processing'], 
   ARRAY['Experience with Qt, Electron, or similar frameworks', 'Data visualization and charting libraries', 'Network programming and communication protocols', 'Database integration and management', 'Cross-platform development experience'], 
   ARRAY['Which desktop development frameworks do you prefer?', 'How do you approach real-time data visualization?']::text[], 
   '2023-06-01 12:15:00+02'::timestamptz),

('true', 10, 'RF Specialist', 'Design and implement radio frequency systems for rocket telemetry, command, and control. You will work on antenna design, RF link budgets, communication protocols, and ensure reliable wireless communication with our rockets during flight.', 
   ARRAY['RF engineering and wireless communication knowledge', 'Understanding of antenna theory and design', 'Experience with RF testing and measurement equipment'], 
   ARRAY['Amateur radio license (HAM)', 'Experience with satellite communication systems', 'Knowledge of aerospace communication standards', 'RF simulation software experience', 'Regulatory compliance (FCC, ETSI) knowledge'], 
   ARRAY['What RF frequency bands have you worked with?', 'Do you hold an amateur radio license?']::text[], 
   '2023-06-01 12:30:00+02'::timestamptz),

('true', 12, 'Hardware Engineer', 'Design and develop electronic hardware systems for our rockets, including PCB design, component selection, and system integration. You will create robust electronics that can withstand the harsh environment of rocket flight while providing critical functionality.', 
   ARRAY['PCB design and electronic circuit development', 'Component selection and system integration', 'Understanding of electrical engineering principles'], 
   ARRAY['Experience with high-reliability electronics design', 'Knowledge of aerospace-grade components', 'EMI/EMC testing and compliance', 'Thermal management and environmental testing', 'Version control for hardware design'], 
   ARRAY['What PCB design software do you use?', 'Describe your experience with environmental testing of electronics']::text[], 
   '2023-06-01 12:45:00+02'::timestamptz),

('true', 8, 'Control System Engineer', 'Develop flight control systems and algorithms for rocket guidance, navigation, and control. You will design control algorithms, implement stability systems, and ensure precise rocket flight performance through advanced control theory applications.', 
   ARRAY['Control systems engineering knowledge', 'Mathematical modeling and simulation skills', 'Understanding of guidance and navigation principles'], 
   ARRAY['Experience with aerospace control systems', 'MATLAB/Simulink proficiency', 'Kalman filtering and state estimation', 'PID and advanced control algorithms', 'Real-time control system implementation'], 
   ARRAY['What control theory concepts are you most experienced with?', 'Describe your experience with flight control systems']::text[], 
   '2023-06-01 13:00:00+02'::timestamptz),

('true', 13, 'Recovery Engineer', 'Design and implement recovery systems for safe rocket retrieval after flight. You will work on parachute systems, recovery electronics, landing predictions, and ensure successful rocket recovery for reuse and data collection.', 
   ARRAY['Understanding of parachute and recovery system design', 'Knowledge of aerodynamics and flight mechanics', 'Experience with mechanical design and analysis'], 
   ARRAY['Aerospace engineering background', 'Experience with recovery system testing', 'Simulation and modeling software proficiency', 'Understanding of materials and textiles', 'Safety and reliability analysis experience'], 
   ARRAY['What types of recovery systems have you worked with?', 'How do you approach recovery system reliability and safety?']::text[], 
   '2023-06-01 13:15:00+02'::timestamptz),

('true', 6, 'Mission Analyst', 'Analyze mission requirements, trajectory optimization, and flight performance for our rocket projects. You will conduct mission planning, performance analysis, and provide critical insights for successful rocket missions through detailed analytical work.', 
   ARRAY['Mission analysis and trajectory optimization skills', 'Mathematical modeling and simulation experience', 'Understanding of rocket performance and flight mechanics'], 
   ARRAY['Aerospace engineering background', 'Experience with mission planning software', 'Knowledge of orbital mechanics', 'Statistical analysis and data interpretation', 'Technical report writing and presentation skills'], 
   ARRAY['What mission analysis tools are you familiar with?', 'Describe your experience with trajectory optimization']::text[], 
   '2023-06-01 13:30:00+02'::timestamptz),

('true', 6, 'Software Engineer', 'Develop software tools for mission analysis, flight simulation, and data processing. You will create computational tools for trajectory analysis, performance optimization, and mission planning to support our rocket development efforts.', 
   ARRAY['Strong programming skills in Python, MATLAB, or similar', 'Understanding of numerical methods and computational analysis', 'Experience with scientific computing and data analysis'], 
   ARRAY['Aerospace or scientific software development experience', 'Knowledge of simulation and modeling frameworks', 'Database design and management', 'Version control and collaborative development', 'Technical documentation and code quality practices'], 
   ARRAY['What programming languages do you use for scientific computing?', 'Describe your experience with simulation software development']::text[], 
   '2023-06-01 13:45:00+02'::timestamptz),

('true', 4, 'Design & Additive Manufacturing Engineer', 'Lead the design and 3D printing/additive manufacturing of rocket components. You will optimize designs for additive manufacturing, operate 3D printing equipment, and ensure high-quality production of custom rocket parts.', 
   ARRAY['CAD design and 3D modeling experience', 'Understanding of additive manufacturing processes', 'Knowledge of materials and manufacturing constraints'], 
   ARRAY['Experience with aerospace component design', 'Multiple 3D printing technologies (SLA, SLS, FDM)', 'Design for manufacturing (DfM) principles', 'Quality control and testing procedures', 'Materials science and selection knowledge'], 
   ARRAY['What CAD software do you use for design?', 'Which additive manufacturing technologies have you worked with?']::text[], 
   '2023-06-01 14:00:00+02'::timestamptz),

('true', 5, 'Structural Engineer', 'Perform structural analysis and design for rocket components and systems. You will conduct finite element analysis, validate structural integrity, and ensure our rockets can withstand the mechanical stresses of flight and operations.', 
   ARRAY['Structural analysis and finite element method (FEM) experience', 'Understanding of mechanics of materials and structural design', 'Knowledge of aerospace structures and loading conditions'], 
   ARRAY['Experience with aerospace structural analysis', 'Proficiency in ANSYS, Abaqus, or similar FEA software', 'Composite materials and advanced structures knowledge', 'Fatigue and fracture mechanics understanding', 'Structural testing and validation experience'], 
   ARRAY['What FEA software do you use for structural analysis?', 'Describe your experience with aerospace structures']::text[], 
   '2023-06-01 14:15:00+02'::timestamptz),

('true', 2, 'Feed System Engineer', 'Design and develop propellant feed systems for liquid rocket engines. You will work on pumps, valves, plumbing, and fluid systems that deliver propellants to the combustion chamber with precision and reliability.', 
   ARRAY['Fluid mechanics and thermodynamics knowledge', 'Understanding of pumps, valves, and fluid systems', 'Experience with pressure systems and fluid flow analysis'], 
   ARRAY['Rocket propulsion and liquid rocket engine experience', 'CFD analysis and simulation skills', 'High-pressure system design and safety', 'Materials compatibility with propellants', 'Testing and validation of fluid systems'], 
   ARRAY['What experience do you have with fluid systems design?', 'Describe your knowledge of rocket propellant handling']::text[], 
   '2023-06-01 14:30:00+02'::timestamptz),

('true', 2, 'Test Engineer', 'Lead testing operations for liquid rocket engine systems. You will plan test procedures, operate test equipment, collect and analyze test data, and ensure safe execution of propulsion system testing.', 
   ARRAY['Experience with test planning and execution', 'Understanding of instrumentation and data acquisition', 'Knowledge of safety procedures for hazardous testing'], 
   ARRAY['Rocket propulsion testing experience', 'High-pressure and cryogenic system testing', 'Data analysis and statistical methods', 'Test automation and control systems', 'Regulatory compliance and safety standards'], 
   ARRAY['What types of propulsion testing have you been involved with?', 'How do you ensure safety during hazardous testing operations?']::text[], 
   '2023-06-01 14:45:00+02'::timestamptz),

('true', 3, 'Test Engineer', 'Develop and execute testing procedures for thrust chamber assemblies and combustion systems. You will design test setups, monitor combustion performance, and analyze test results to optimize engine performance.', 
   ARRAY['Combustion testing and analysis experience', 'Understanding of test instrumentation and data collection', 'Knowledge of high-temperature and high-pressure testing'], 
   ARRAY['Rocket engine testing experience', 'Combustion diagnostics and measurement techniques', 'Heat transfer and thermal analysis', 'Materials testing at extreme conditions', 'Statistical analysis and test data interpretation'], 
   ARRAY['Describe your experience with combustion testing', 'What diagnostic techniques have you used for engine testing?']::text[], 
   '2023-06-01 15:00:00+02'::timestamptz),

('true', 3, 'Propulsion Engineer', 'Design and develop thrust chamber assemblies for liquid rocket engines. You will work on combustion chamber design, nozzle optimization, cooling systems, and overall engine performance to achieve maximum efficiency and reliability.', 
   ARRAY['Rocket propulsion and combustion theory knowledge', 'Understanding of thermodynamics and fluid mechanics', 'Experience with combustion chamber and nozzle design'], 
   ARRAY['Liquid rocket engine development experience', 'CFD analysis for combustion and nozzle flow', 'Heat transfer and cooling system design', 'Materials selection for high-temperature applications', 'Performance optimization and analysis'], 
   ARRAY['What is your experience with rocket engine design?', 'Describe your knowledge of combustion chamber cooling methods']::text[], 
   '2023-06-01 15:15:00+02'::timestamptz);



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

-- Applications for new positions
(2, 'f1111111-1111-1111-1111-111111111111', 'lorenzo_graphic_ml.pdf', 'lorenzo_graphic_cv.pdf', '2023-06-05 14:30:00+02'::timestamptz, 'pending', 
   ARRAY[
     jsonb_build_object(
       'question', 'What design software do you use most frequently?',
       'answer', 'I primarily use Adobe Creative Suite - Photoshop, Illustrator, and InDesign for most of my design work'
     ),
     jsonb_build_object(
       'question', 'Can you share examples of technical illustrations you have created?',
       'answer', 'I have created technical diagrams for engineering documentation and infographic-style explanations of complex systems'
     )
   ]),

(3, 'f2222222-2222-2222-2222-222222222222', 'martina_photo_ml.pdf', 'martina_photo_cv.pdf', '2023-06-06 09:15:00+02'::timestamptz, 'accepted', 
   ARRAY[
     jsonb_build_object(
       'question', 'What camera equipment are you familiar with?',
       'answer', 'I work with Canon DSLR cameras, various lenses, drones for aerial photography, and professional lighting equipment'
     ),
     jsonb_build_object(
       'question', 'Do you have experience filming technical/engineering content?',
       'answer', 'Yes, I have documented manufacturing processes and created educational videos for engineering projects'
     )
   ]),

(4, 'f3333333-3333-3333-3333-333333333333', 'federico_social_ml.pdf', 'federico_social_cv.pdf', '2023-06-07 11:20:00+02'::timestamptz, 'received', 
   ARRAY[
     jsonb_build_object(
       'question', 'Which social media platforms do you have experience managing?',
       'answer', 'I have managed Instagram, LinkedIn, Twitter, and YouTube channels for tech companies and personal brands'
     ),
     jsonb_build_object(
       'question', 'How do you measure social media success?',
       'answer', 'I track engagement rates, reach, conversions, and community growth, using analytics tools to optimize content strategy'
     )
   ]),

(5, 'f4444444-4444-4444-4444-444444444444', 'alice_fullstack_ml.pdf', 'alice_fullstack_cv.pdf', '2023-06-08 16:45:00+02'::timestamptz, 'pending', 
   ARRAY[
     jsonb_build_object(
       'question', 'Describe your experience with modern web frameworks',
       'answer', 'I have 3 years of experience with React and Next.js, building scalable web applications with TypeScript'
     ),
     jsonb_build_object(
       'question', 'What is your approach to database design?',
       'answer', 'I focus on normalization, performance optimization, and clear relationships, using tools like Prisma for type safety'
     )
   ]),

(6, 'f5555555-5555-5555-5555-555555555555', 'giovanni_sponsor_ml.pdf', 'giovanni_sponsor_cv.pdf', '2023-06-09 10:30:00+02'::timestamptz, 'accepted', 
   ARRAY[
     jsonb_build_object(
       'question', 'What types of partnerships have you developed before?',
       'answer', 'I have secured sponsorships for student organizations and helped establish corporate partnerships for tech events'
     ),
     jsonb_build_object(
       'question', 'How do you approach sponsor relationship management?',
       'answer', 'I maintain regular communication, provide detailed ROI reports, and ensure sponsors receive agreed-upon recognition and benefits'
     )
   ]),

(7, 'f6666666-6666-6666-6666-666666666666', 'beatrice_events_ml.pdf', 'beatrice_events_cv.pdf', '2023-06-10 13:45:00+02'::timestamptz, 'received', 
   ARRAY[
     jsonb_build_object(
       'question', 'What types of events have you organized before?',
       'answer', 'I have organized technical conferences, product launches, and educational workshops for 50-200 attendees'
     ),
     jsonb_build_object(
       'question', 'How do you handle event logistics and coordination?',
       'answer', 'I use project management tools, create detailed timelines, and maintain vendor relationships for smooth execution'
     )
   ]),

(8, 'f7777777-7777-7777-7777-777777777777', 'tommaso_mission_ml.pdf', 'tommaso_mission_cv.pdf', '2023-06-11 08:20:00+02'::timestamptz, 'pending', 
   ARRAY[
     jsonb_build_object(
       'question', 'Do you have experience with technical testing operations?',
       'answer', 'Yes, I have coordinated testing for electronic systems and managed equipment calibration procedures'
     ),
     jsonb_build_object(
       'question', 'How do you prioritize safety in high-stakes environments?',
       'answer', 'I follow strict protocols, maintain clear communication, and ensure all team members are trained on safety procedures'
     )
   ]),

(9, 'f8888888-8888-8888-8888-888888888888', 'sara_safety_ml.pdf', 'sara_safety_cv.pdf', '2023-06-12 14:15:00+02'::timestamptz, 'accepted', 
   ARRAY[
     jsonb_build_object(
       'question', 'What safety certifications do you hold?',
       'answer', 'I hold OSHA 30-Hour certification and have completed specialized training in chemical and laboratory safety'
     ),
     jsonb_build_object(
       'question', 'Describe your approach to risk assessment in technical environments',
       'answer', 'I conduct systematic hazard identification, probability analysis, and implement layered control measures to minimize risks'
     )
   ]),

(10, 'f9999999-9999-9999-9999-999999999999', 'nicolo_embedded_ml.pdf', 'nicolo_embedded_cv.pdf', '2023-06-13 11:30:00+02'::timestamptz, 'received', 
   ARRAY[
     jsonb_build_object(
       'question', 'What embedded platforms have you worked with?',
       'answer', 'I have experience with Arduino, STM32 microcontrollers, and Raspberry Pi for various embedded projects'
     ),
     jsonb_build_object(
       'question', 'Describe your experience with real-time systems development',
       'answer', 'I have developed time-critical control systems using FreeRTOS and implemented interrupt-driven sensor interfaces'
     )
   ]),

(11, '1d111111-1111-1111-1111-111111111111', 'camilla_desktop_ml.pdf', 'camilla_desktop_cv.pdf', '2023-06-14 09:45:00+02'::timestamptz, 'pending', 
   ARRAY[
     jsonb_build_object(
       'question', 'Which desktop development frameworks do you prefer?',
       'answer', 'I prefer Qt for cross-platform applications and have experience with Electron for web-based desktop apps'
     ),
     jsonb_build_object(
       'question', 'How do you approach real-time data visualization?',
       'answer', 'I use efficient charting libraries, implement data buffering, and optimize rendering for smooth real-time updates'
     )
   ]),

(12, '1d222222-2222-2222-2222-222222222222', 'riccardo_rf_ml.pdf', 'riccardo_rf_cv.pdf', '2023-06-15 15:20:00+02'::timestamptz, 'accepted', 
   ARRAY[
     jsonb_build_object(
       'question', 'What RF frequency bands have you worked with?',
       'answer', 'I have experience with UHF/VHF bands for telemetry and 2.4GHz/5.8GHz for high-bandwidth data transmission'
     ),
     jsonb_build_object(
       'question', 'Do you hold an amateur radio license?',
       'answer', 'Yes, I hold a General class amateur radio license and have experience with packet radio and digital modes'
     )
   ]),

(13, '1d333333-3333-3333-3333-333333333333', 'anna_hardware_ml.pdf', 'anna_hardware_cv.pdf', '2023-06-16 12:10:00+02'::timestamptz, 'received', 
   ARRAY[
     jsonb_build_object(
       'question', 'What PCB design software do you use?',
       'answer', 'I primarily use Altium Designer and have experience with KiCad for open-source projects'
     ),
     jsonb_build_object(
       'question', 'Describe your experience with environmental testing of electronics',
       'answer', 'I have conducted thermal cycling, vibration testing, and EMI/EMC compliance testing for aerospace applications'
     )
   ]),

(14, '1d444444-4444-4444-4444-444444444444', 'manuel_control_ml.pdf', 'manuel_control_cv.pdf', '2023-06-17 10:25:00+02'::timestamptz, 'pending', 
   ARRAY[
     jsonb_build_object(
       'question', 'What control theory concepts are you most experienced with?',
       'answer', 'I have strong experience with PID control, state-space methods, and Kalman filtering for estimation and control'
     ),
     jsonb_build_object(
       'question', 'Describe your experience with flight control systems',
       'answer', 'I have simulated and implemented autopilot systems for UAVs, including attitude control and trajectory following'
     )
   ]),

(15, '1d555555-5555-5555-5555-555555555555', 'jessica_recovery_ml.pdf', 'jessica_recovery_cv.pdf', '2023-06-18 14:40:00+02'::timestamptz, 'accepted', 
   ARRAY[
     jsonb_build_object(
       'question', 'What types of recovery systems have you worked with?',
       'answer', 'I have designed and tested parachute recovery systems for model rockets and high-altitude balloon payloads'
     ),
     jsonb_build_object(
       'question', 'How do you approach recovery system reliability and safety?',
       'answer', 'I implement redundant deployment mechanisms, conduct extensive ground testing, and use simulation for failure analysis'
     )
   ]),

(16, '1d666666-6666-6666-6666-666666666666', 'antonio_mission_ml.pdf', 'antonio_mission_cv.pdf', '2023-06-19 11:15:00+02'::timestamptz, 'received', 
   ARRAY[
     jsonb_build_object(
       'question', 'What mission analysis tools are you familiar with?',
       'answer', 'I have experience with MATLAB/Simulink for trajectory analysis and STK for mission planning and visualization'
     ),
     jsonb_build_object(
       'question', 'Describe your experience with trajectory optimization',
       'answer', 'I have implemented optimal control algorithms for minimum-energy trajectories and constrained flight paths'
     )
   ]),

(17, '1d777777-7777-7777-7777-777777777777', 'chiara_software_ml.pdf', 'chiara_software_cv.pdf', '2023-06-20 09:30:00+02'::timestamptz, 'pending', 
   ARRAY[
     jsonb_build_object(
       'question', 'What programming languages do you use for scientific computing?',
       'answer', 'I primarily use Python with NumPy/SciPy, MATLAB for prototyping, and C++ for performance-critical applications'
     ),
     jsonb_build_object(
       'question', 'Describe your experience with simulation software development',
       'answer', 'I have developed Monte Carlo simulations for mission analysis and physics-based models for system dynamics'
     )
   ]),

(18, '1d888888-8888-8888-8888-888888888888', 'marco_manufacturing_ml.pdf', 'marco_manufacturing_cv.pdf', '2023-06-21 13:50:00+02'::timestamptz, 'accepted', 
   ARRAY[
     jsonb_build_object(
       'question', 'What CAD software do you use for design?',
       'answer', 'I use SolidWorks for mechanical design and Fusion 360 for integrated CAD/CAM workflows'
     ),
     jsonb_build_object(
       'question', 'Which additive manufacturing technologies have you worked with?',
       'answer', 'I have experience with FDM, SLA, and SLS printing, optimizing designs for each technology constraints'
     )
   ]),

(19, '1d999999-9999-9999-9999-999999999999', 'elena_structural_ml.pdf', 'elena_structural_cv.pdf', '2023-06-22 16:20:00+02'::timestamptz, 'received', 
   ARRAY[
     jsonb_build_object(
       'question', 'What FEA software do you use for structural analysis?',
       'answer', 'I primarily use ANSYS Mechanical and have experience with Abaqus for complex nonlinear analysis'
     ),
     jsonb_build_object(
       'question', 'Describe your experience with aerospace structures',
       'answer', 'I have analyzed composite panels, pressure vessels, and vibration-sensitive structures for aerospace applications'
     )
   ]),

(20, '1e111111-1111-1111-1111-111111111111', 'luca_feed_ml.pdf', 'luca_feed_cv.pdf', '2023-06-23 10:05:00+02'::timestamptz, 'pending', 
   ARRAY[
     jsonb_build_object(
       'question', 'What experience do you have with fluid systems design?',
       'answer', 'I have designed hydraulic systems and worked with high-pressure plumbing for industrial applications'
     ),
     jsonb_build_object(
       'question', 'Describe your knowledge of rocket propellant handling',
       'answer', 'I understand the safety requirements for handling cryogenic and hypergolic propellants, including containment systems'
     )
   ]),

(21, '1e222222-2222-2222-2222-222222222222', 'sofia_test1_ml.pdf', 'sofia_test1_cv.pdf', '2023-06-24 12:35:00+02'::timestamptz, 'accepted', 
   ARRAY[
     jsonb_build_object(
       'question', 'What types of propulsion testing have you been involved with?',
       'answer', 'I have participated in solid rocket motor testing and have experience with test stand instrumentation'
     ),
     jsonb_build_object(
       'question', 'How do you ensure safety during hazardous testing operations?',
       'answer', 'I follow established safety protocols, maintain clear communication, and ensure proper emergency procedures are in place'
     )
   ]),

(22, '1e333333-3333-3333-3333-333333333333', 'matteo_test2_ml.pdf', 'matteo_test2_cv.pdf', '2023-06-25 14:45:00+02'::timestamptz, 'received', 
   ARRAY[
     jsonb_build_object(
       'question', 'Describe your experience with combustion testing',
       'answer', 'I have conducted combustion experiments in laboratory settings and analyzed flame characteristics and heat transfer'
     ),
     jsonb_build_object(
       'question', 'What diagnostic techniques have you used for engine testing?',
       'answer', 'I have used pressure transducers, thermocouples, and high-speed cameras for combustion diagnostics'
     )
   ]);
