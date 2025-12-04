-- Clear existing data (if needed)
TRUNCATE members, users, departments, divisions, roles, orders, apply_positions, applications, scopes RESTART IDENTITY CASCADE;

-- Insert Members (at least 10)
INSERT INTO members (member_id, prt_email, discord, nda_signed_at, nda_name, nda_confirmed_by, picture) VALUES
(13, 'marco.rossi@prt.it', 'marco#1234', '2023-01-15 10:00:00+01'::timestamptz, 'Marco Rossi NDA', 1, 'https://avatar.iran.liara.run/public'),
(2, 'giulia.ferrari@prt.it', 'giulia#5678', '2023-01-20 11:30:00+01'::timestamptz, 'Giulia Ferrari NDA', 2, 'https://avatar.iran.liara.run/public'),
(3, 'alessandro.russo@prt.it', 'alex#9012', '2023-02-05 09:15:00+01'::timestamptz, 'Alessandro Russo NDA', 3, 'https://avatar.iran.liara.run/public'),
(4, 'valentina.esposito@prt.it', 'vale#3456', '2023-02-10 14:20:00+01'::timestamptz, 'Valentina Esposito NDA', 4, 'https://avatar.iran.liara.run/public'),
(5, 'luca.bianchi@prt.it', 'luca#7890', '2023-03-01 16:45:00+01'::timestamptz, 'Luca Bianchi NDA', 5, 'https://avatar.iran.liara.run/public'),
(6, 'sofia.ricci@prt.it', 'sofia#2345', '2023-03-15 10:30:00+01'::timestamptz, 'Sofia Ricci NDA', 1, 'https://avatar.iran.liara.run/public'),
(7,  'matteo.conti@prt.it', 'matteo#6789', '2023-04-01 13:15:00+02'::timestamptz, 'Matteo Conti NDA', 1, 'https://avatar.iran.liara.run/public'),
(8, 'elena.martini@prt.it', 'elena#0123', '2023-04-10 11:45:00+02'::timestamptz, 'Elena Martini NDA', 1, 'https://avatar.iran.liara.run/public'),
(9, 'andrea.gallo@prt.it', 'andrea#4567', '2023-04-20 14:30:00+02'::timestamptz, 'Andrea Gallo NDA', 1, 'https://avatar.iran.liara.run/public'),
(10,  'francesca.leone@prt.it', 'fran#8901', '2023-05-01 09:20:00+02'::timestamptz, 'Francesca Leone NDA', 1, 'https://avatar.iran.liara.run/public'),
(11, 'simone.lombardi@prt.it', 'simone#3456', '2023-05-10 10:15:00+02'::timestamptz, 'Simone Lombardi NDA', 1, 'https://avatar.iran.liara.run/public'),
(12, 'claudia.marino@prt.it', 'claudia#7890', '2023-05-15 13:30:00+02'::timestamptz, 'Claudia Marino NDA', 1, 'https://avatar.iran.liara.run/public'),
(1, 'developer@prt.it', 'test#7890', '2023-05-15 13:30:00+02'::timestamptz, 'developer NDA', 1, 'https://avatar.iran.liara.run/public'),

-- Additional members for division coverage
(14, 'giovanni.bruno@prt.it', 'giovanni#1111', '2023-05-20 10:00:00+02'::timestamptz, 'Giovanni Bruno NDA', 1, 'https://avatar.iran.liara.run/public'),
(15, 'martina.costa@prt.it', 'martina#2222', '2023-05-25 11:30:00+02'::timestamptz, 'Martina Costa NDA', 1, 'https://avatar.iran.liara.run/public'),
(16, 'federico.romano@prt.it', 'federico#3333', '2023-06-01 09:15:00+02'::timestamptz, 'Federico Romano NDA', 1, 'https://avatar.iran.liara.run/public'),
(17, 'alice.fontana@prt.it', 'alice#4444', '2023-06-05 14:20:00+02'::timestamptz, 'Alice Fontana NDA', 1, 'https://avatar.iran.liara.run/public'),
(18, 'lorenzo.sala@prt.it', 'lorenzo#5555', '2023-06-10 16:45:00+02'::timestamptz, 'Lorenzo Sala NDA', 1, 'https://avatar.iran.liara.run/public'),
(19, 'beatrice.moro@prt.it', 'beatrice#6666', '2023-06-15 10:30:00+02'::timestamptz, 'Beatrice Moro NDA', 1, 'https://avatar.iran.liara.run/public'),
(20, 'tommaso.ferrari@prt.it', 'tommaso#7777', '2023-06-20 13:15:00+02'::timestamptz, 'Tommaso Ferrari NDA', 1, 'https://avatar.iran.liara.run/public'),
(21, 'sara.barbieri@prt.it', 'sara#8888', '2023-06-25 11:45:00+02'::timestamptz, 'Sara Barbieri NDA', 1, 'https://avatar.iran.liara.run/public'),
(22, 'nicolo.benedetti@prt.it', 'nicolo#9999', '2023-07-01 14:30:00+02'::timestamptz, 'Nicolò Benedetti NDA', 1, 'https://avatar.iran.liara.run/public'),
(23, 'camilla.de.santis@prt.it', 'camilla#0000', '2023-07-05 09:20:00+02'::timestamptz, 'Camilla De Santis NDA', 1, 'https://avatar.iran.liara.run/public'),
(24, 'riccardo.grassi@prt.it', 'riccardo#1010', '2023-07-10 10:15:00+02'::timestamptz, 'Riccardo Grassi NDA', 1, 'https://avatar.iran.liara.run/public'),
(25, 'anna.serra@prt.it', 'anna#2020', '2023-07-15 13:30:00+02'::timestamptz, 'Anna Serra NDA', 1, 'https://avatar.iran.liara.run/public'),
(26, 'manuel.vitale@prt.it', 'manuel#3030', '2023-07-20 10:30:00+02'::timestamptz, 'Manuel Vitale NDA', 1, 'https://avatar.iran.liara.run/public'),
(27, 'jessica.monti@prt.it', 'jessica#4040', '2023-07-25 13:15:00+02'::timestamptz, 'Jessica Monti NDA', 1, 'https://avatar.iran.liara.run/public'),
(28, 'antonio.palmieri@prt.it', 'antonio#5050', '2023-08-01 11:45:00+02'::timestamptz, 'Antonio Palmieri NDA', 1, 'https://avatar.iran.liara.run/public'),
(29, 'chiara.santoro@prt.it', 'chiara#6060', '2023-08-05 14:30:00+02'::timestamptz, 'Chiara Santoro NDA', 1, 'https://avatar.iran.liara.run/public'),
(30, 'marco.caruso@prt.it', 'marco#7070', '2023-08-10 09:20:00+02'::timestamptz, 'Marco Caruso NDA', 1, 'https://avatar.iran.liara.run/public'),
(31, 'elena.moretti@prt.it', 'elena#8080', '2023-08-15 10:15:00+02'::timestamptz, 'Elena Moretti NDA', 1, 'https://avatar.iran.liara.run/public'),
(32, 'luca.pellegrini@prt.it', 'luca#9090', '2023-08-20 13:30:00+02'::timestamptz, 'Luca Pellegrini NDA', 1, 'https://avatar.iran.liara.run/public'),
(33, 'sofia.greco@prt.it', 'sofia#1212', '2023-08-25 10:30:00+02'::timestamptz, 'Sofia Greco NDA', 1, 'https://avatar.iran.liara.run/public'),
(34, 'matteo.villa@prt.it', 'matteo#2323', '2023-09-01 13:15:00+02'::timestamptz, 'Matteo Villa NDA', 1, 'https://avatar.iran.liara.run/public'),
(35, 'giulia.longo@prt.it', 'giulia#3434', '2023-09-05 11:45:00+02'::timestamptz, 'Giulia Longo NDA', 1, 'https://avatar.iran.liara.run/public'),
(36, 'davide.rosso@prt.it', 'davide#4545', '2023-09-10 14:30:00+02'::timestamptz, 'Davide Rosso NDA', 1, 'https://avatar.iran.liara.run/public'),
(37, 'laura.verde@prt.it', 'laura#5656', '2023-09-15 09:20:00+02'::timestamptz, 'Laura Verde NDA', 1, 'https://avatar.iran.liara.run/public'),
(38, 'gabriele.azzurro@prt.it', 'gabriele#6767', '2023-09-20 10:15:00+02'::timestamptz, 'Gabriele Azzurro NDA', 1, 'https://avatar.iran.liara.run/public');

-- Insert Users with timestamptz for created_at and NULL for updated_at
INSERT INTO users (id, email, first_name, last_name, origin, mobile_number, linkedin, polito_id, polito_email, date_of_birth, gender, level_of_study, how_found_us, program, member, created_at, updated_at) VALUES
('00000000-0000-0000-0000-000000000001', 'developer@prt.it', 'Developer', 'Admin', 'Italy', '+39320000000', 'linkedin.com/in/developer', 'dev001', 'developer@studenti.polito.it', '1990-01-01'::date, 'Male', 'PhD', 'Internal', 'Computer Engineering', 1, '2023-01-01 10:00:00+01'::timestamptz, NULL),
('11111111-1111-1111-1111-111111111111', 'marco.rossi@example.com', 'Marco', 'Rossi', 'Italy', '+39328123456', 'linkedin.com/in/marcorossi', 's123456', 'marco.rossi@studenti.polito.it', '1998-03-15'::date, 'Male', 'Master', 'University website', 'Computer Engineering', 13, '2023-01-10 10:00:00+01'::timestamptz, NULL),
('22222222-2222-2222-2222-222222222222', 'giulia.ferrari@example.com', 'Giulia', 'Ferrari', 'Italy', '+39329234567', 'linkedin.com/in/giuliaferrari', 's234567', 'giulia.ferrari@studenti.polito.it', '1999-07-22'::date, 'Female', 'Bachelor', 'Social media', 'Electronic Engineering', 2, '2023-01-15 11:30:00+01'::timestamptz, NULL),
('33333333-3333-3333-3333-333333333333', 'alessandro.russo@example.com', 'Alessandro', 'Russo', 'Italy', '+39330345678', 'linkedin.com/in/alessandrorusso', 's345678', 'alessandro.russo@studenti.polito.it', '1995-11-08'::date, 'Male', 'PhD', 'Friend referral', 'Mechanical Engineering', 3, '2023-02-01 09:15:00+01'::timestamptz, NULL),
('44444444-4444-4444-4444-444444444444', 'valentina.esposito@example.com', 'Valentina', 'Esposito', 'Italy', '+39331456789', 'linkedin.com/in/valentinaesposito', 's456789', 'valentina.esposito@studenti.polito.it', '1997-05-14'::date, 'Female', 'Master', 'Career fair', 'Management Engineering', 4, '2023-02-05 14:20:00+01'::timestamptz, NULL),
('55555555-5555-5555-5555-555555555555', 'luca.bianchi@example.com', 'Luca', 'Bianchi', 'Italy', '+39332567890', 'linkedin.com/in/lucabianchi', 's567890', 'luca.bianchi@studenti.polito.it', '2000-01-30'::date, 'Male', 'Bachelor', 'Professor recommendation', 'Computer Science', 5, '2023-02-20 16:45:00+01'::timestamptz, NULL),
('66666666-6666-6666-6666-666666666666', 'sofia.ricci@example.com', 'Sofia', 'Ricci', 'Italy', '+39333678901', 'linkedin.com/in/sofiaricci', 's678901', 'sofia.ricci@studenti.polito.it', '1998-09-12'::date, 'Female', 'Master', 'LinkedIn', 'Data Science', 6, '2023-03-10 10:30:00+01'::timestamptz, NULL),
('77777777-7777-7777-7777-777777777777', 'matteo.conti@example.com', 'Matteo', 'Conti', 'Italy', '+39334789012', 'linkedin.com/in/matteoconti', 's789012', 'matteo.conti@studenti.polito.it', '1999-12-03'::date, 'Male', 'Bachelor', 'Student organization', 'Electronic Engineering', 7, '2023-03-15 13:15:00+01'::timestamptz, NULL),
('88888888-8888-8888-8888-888888888888', 'elena.martini@example.com', 'Elena', 'Martini', 'Italy', '+39335890123', 'linkedin.com/in/elenamartini', 's890123', 'elena.martini@studenti.polito.it', '1997-04-18'::date, 'Female', 'Master', 'University website', 'Architecture', 8, '2023-04-05 11:45:00+02'::timestamptz, NULL),
('99999999-9999-9999-9999-999999999999', 'andrea.gallo@example.com', 'Andrea', 'Gallo', 'Italy', '+39336901234', 'linkedin.com/in/andreagallo', 's901234', 'andrea.gallo@studenti.polito.it', '1994-08-25'::date, 'Male', 'PhD', 'Research group', 'Mechanical Engineering', 9, '2023-04-15 14:30:00+02'::timestamptz, NULL),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'francesca.leone@example.com', 'Francesca', 'Leone', 'Italy', '+39337012345', 'linkedin.com/in/francescaleone', 's012345', 'francesca.leone@studenti.polito.it', '2000-06-07'::date, 'Female', 'Bachelor', 'Social media', 'Energy Engineering', 10, '2023-04-25 09:20:00+02'::timestamptz, NULL),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'simone.lombardi@example.com', 'Simone', 'Lombardi', 'Italy', '+39338123457', 'linkedin.com/in/simonelombardi', 's123457', 'simone.lombardi@studenti.polito.it', '1998-02-19'::date, 'Male', 'Master', 'Friend referral', 'Computer Engineering', 11, '2023-05-10 10:15:00+02'::timestamptz, NULL),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'claudia.marino@example.com', 'Claudia', 'Marino', 'Italy', '+39339234568', 'linkedin.com/in/claudiamarino', 's234568', 'claudia.marino@studenti.polito.it', '1999-10-11'::date, 'Female', 'Bachelor', 'Career fair', 'Biomedical Engineering', 12, '2023-05-15 13:30:00+02'::timestamptz, NULL),

-- Users for team members 14-38
('1a111111-1111-1111-1111-111111111111', 'giovanni.bruno@example.com', 'Giovanni', 'Bruno', 'Italy', '+39340345902', 'linkedin.com/in/giovannibruno', 's345902', 'giovanni.bruno@studenti.polito.it', '1998-01-14'::date, 'Male', 'Master', 'University website', 'Propulsion Engineering', 14, '2023-05-20 10:00:00+02'::timestamptz, NULL),
('1a222222-2222-2222-2222-222222222222', 'martina.costa@example.com', 'Martina', 'Costa', 'Italy', '+39341456013', 'linkedin.com/in/martinacosta', 's456013', 'martina.costa@studenti.polito.it', '2000-03-28'::date, 'Female', 'Bachelor', 'Friend referral', 'Chemical Engineering', 15, '2023-05-25 11:30:00+02'::timestamptz, NULL),
('1a333333-3333-3333-3333-333333333333', 'federico.romano@example.com', 'Federico', 'Romano', 'Italy', '+39342567124', 'linkedin.com/in/federicoromano', 's567124', 'federico.romano@studenti.polito.it', '1997-11-05'::date, 'Male', 'Master', 'Social media', 'Propulsion Engineering', 16, '2023-06-01 09:15:00+02'::timestamptz, NULL),
('1a444444-4444-4444-4444-444444444444', 'alice.fontana@example.com', 'Alice', 'Fontana', 'Italy', '+39343678235', 'linkedin.com/in/alicefontana', 's678235', 'alice.fontana@studenti.polito.it', '1995-07-12'::date, 'Female', 'PhD', 'Professor recommendation', 'Mechanical Engineering', 17, '2023-06-05 14:20:00+02'::timestamptz, NULL),
('1a555555-5555-5555-5555-555555555555', 'lorenzo.sala@example.com', 'Lorenzo', 'Sala', 'Italy', '+39344789346', 'linkedin.com/in/lorenzosala', 's789346', 'lorenzo.sala@studenti.polito.it', '1998-09-20'::date, 'Male', 'Master', 'Career fair', 'Structural Engineering', 18, '2023-06-10 16:45:00+02'::timestamptz, NULL),
('1a666666-6666-6666-6666-666666666666', 'beatrice.moro@example.com', 'Beatrice', 'Moro', 'Italy', '+39345890457', 'linkedin.com/in/beatricemoro', 's890457', 'beatrice.moro@studenti.polito.it', '2000-05-17'::date, 'Female', 'Bachelor', 'LinkedIn', 'Aerospace Engineering', 19, '2023-06-15 10:30:00+02'::timestamptz, NULL),
('1a777777-7777-7777-7777-777777777777', 'tommaso.ferrari@example.com', 'Tommaso', 'Ferrari', 'Italy', '+39346901568', 'linkedin.com/in/tommasoferrari', 's901568', 'tommaso.ferrari@studenti.polito.it', '1998-12-08'::date, 'Male', 'Master', 'Student organization', 'Aerospace Engineering', 20, '2023-06-20 13:15:00+02'::timestamptz, NULL),
('1a888888-8888-8888-8888-888888888888', 'sara.barbieri@example.com', 'Sara', 'Barbieri', 'Italy', '+39347012679', 'linkedin.com/in/sarabarbieri', 's012679', 'sara.barbieri@studenti.polito.it', '1996-04-25'::date, 'Female', 'PhD', 'Research group', 'Operations Management', 21, '2023-06-25 11:45:00+02'::timestamptz, NULL),
('1a999999-9999-9999-9999-999999999999', 'nicolo.benedetti@example.com', 'Nicolò', 'Benedetti', 'Italy', '+39348123790', 'linkedin.com/in/nicolobenedetti', 's123790', 'nicolo.benedetti@studenti.polito.it', '1997-08-13'::date, 'Male', 'Master', 'University website', 'Computer Engineering', 22, '2023-07-01 14:30:00+02'::timestamptz, NULL),
('1b111111-1111-1111-1111-111111111111', 'camilla.de.santis@example.com', 'Camilla', 'De Santis', 'Italy', '+39349234891', 'linkedin.com/in/camilladesantis', 's234891', 'camilla.desantis@studenti.polito.it', '1999-06-02'::date, 'Female', 'Bachelor', 'Social media', 'Computer Science', 23, '2023-07-05 09:20:00+02'::timestamptz, NULL),
('1b222222-2222-2222-2222-222222222222', 'riccardo.grassi@example.com', 'Riccardo', 'Grassi', 'Italy', '+39350345902', 'linkedin.com/in/riccardograssi', 's345902', 'riccardo.grassi@studenti.polito.it', '1998-10-16'::date, 'Male', 'Master', 'Friend referral', 'Electronic Engineering', 24, '2023-07-10 10:15:00+02'::timestamptz, NULL),
('1b333333-3333-3333-3333-333333333333', 'anna.serra@example.com', 'Anna', 'Serra', 'Italy', '+39351456013', 'linkedin.com/in/annaserra', 's456013', 'anna.serra@studenti.polito.it', '1995-02-21'::date, 'Female', 'PhD', 'Professor recommendation', 'Electronic Engineering', 25, '2023-07-15 13:30:00+02'::timestamptz, NULL),
('1b444444-4444-4444-4444-444444444444', 'manuel.vitale@example.com', 'Manuel', 'Vitale', 'Italy', '+39352567124', 'linkedin.com/in/manuelvitale', 's567124', 'manuel.vitale@studenti.polito.it', '1997-12-29'::date, 'Male', 'Master', 'Career fair', 'Control Systems Engineering', 26, '2023-07-20 10:30:00+02'::timestamptz, NULL),
('1b555555-5555-5555-5555-555555555555', 'jessica.monti@example.com', 'Jessica', 'Monti', 'Italy', '+39353678235', 'linkedin.com/in/jessicamonti', 's678235', 'jessica.monti@studenti.polito.it', '2000-04-07'::date, 'Female', 'Bachelor', 'LinkedIn', 'Aerospace Engineering', 27, '2023-07-25 13:15:00+02'::timestamptz, NULL),
('1b666666-6666-6666-6666-666666666666', 'antonio.palmieri@example.com', 'Antonio', 'Palmieri', 'Italy', '+39354789346', 'linkedin.com/in/antoniopalmieri', 's789346', 'antonio.palmieri@studenti.polito.it', '1998-01-18'::date, 'Male', 'Master', 'Student organization', 'Aerospace Engineering', 28, '2023-08-01 11:45:00+02'::timestamptz, NULL),
('1b777777-7777-7777-7777-777777777777', 'chiara.santoro@example.com', 'Chiara', 'Santoro', 'Italy', '+39355890457', 'linkedin.com/in/chiarasantoro', 's890457', 'chiara.santoro@studenti.polito.it', '1996-09-23'::date, 'Female', 'PhD', 'Research group', 'Computer Science', 29, '2023-08-05 14:30:00+02'::timestamptz, NULL),
('1b888888-8888-8888-8888-888888888888', 'marco.caruso@example.com', 'Marco', 'Caruso', 'Italy', '+39356901568', 'linkedin.com/in/marcocaruso', 's901568', 'marco.caruso@studenti.polito.it', '1997-05-11'::date, 'Male', 'Master', 'University website', 'Mechanical Engineering', 30, '2023-08-10 09:20:00+02'::timestamptz, NULL),
('1b999999-9999-9999-9999-999999999999', 'elena.moretti@example.com', 'Elena', 'Moretti', 'Italy', '+39357012679', 'linkedin.com/in/elenamoretti', 's012679', 'elena.moretti@studenti.polito.it', '1999-11-04'::date, 'Female', 'Bachelor', 'Social media', 'Mechanical Engineering', 31, '2023-08-15 10:15:00+02'::timestamptz, NULL),
('1c111111-1111-1111-1111-111111111111', 'luca.pellegrini@example.com', 'Luca', 'Pellegrini', 'Italy', '+39358123790', 'linkedin.com/in/lucapellegrini', 's123790', 'luca.pellegrini@studenti.polito.it', '1998-03-26'::date, 'Male', 'Master', 'Friend referral', 'Propulsion Engineering', 32, '2023-08-20 13:30:00+02'::timestamptz, NULL),
('1c222222-2222-2222-2222-222222222222', 'sofia.greco@example.com', 'Sofia', 'Greco', 'Italy', '+39359234891', 'linkedin.com/in/sofiagreco', 's234891', 'sofia.greco@studenti.polito.it', '1995-08-09'::date, 'Female', 'PhD', 'Professor recommendation', 'Chemical Engineering', 33, '2023-08-25 10:30:00+02'::timestamptz, NULL),
('1c333333-3333-3333-3333-333333333333', 'matteo.villa@example.com', 'Matteo', 'Villa', 'Italy', '+39360345902', 'linkedin.com/in/matteovilla', 's345902', 'matteo.villa@studenti.polito.it', '1997-10-15'::date, 'Male', 'Master', 'Career fair', 'Propulsion Engineering', 34, '2023-09-01 13:15:00+02'::timestamptz, NULL),
('1c444444-4444-4444-4444-444444444444', 'giulia.longo@example.com', 'Giulia', 'Longo', 'Italy', '+39361456013', 'linkedin.com/in/giulialongo', 's456013', 'giulia.longo@studenti.polito.it', '2000-02-03'::date, 'Female', 'Bachelor', 'LinkedIn', 'Chemical Engineering', 35, '2023-09-05 11:45:00+02'::timestamptz, NULL),
('1c555555-5555-5555-5555-555555555555', 'davide.rosso@example.com', 'Davide', 'Rosso', 'Italy', '+39362567124', 'linkedin.com/in/daviderosso', 's567124', 'davide.rosso@studenti.polito.it', '1998-07-19'::date, 'Male', 'Master', 'Student organization', 'Communications Engineering', 36, '2023-09-10 14:30:00+02'::timestamptz, NULL),
('1c666666-6666-6666-6666-666666666666', 'laura.verde@example.com', 'Laura', 'Verde', 'Italy', '+39363678235', 'linkedin.com/in/lauraverde', 's678235', 'laura.verde@studenti.polito.it', '1999-12-12'::date, 'Female', 'Bachelor', 'University website', 'Management Engineering', 37, '2023-09-15 09:20:00+02'::timestamptz, NULL),
('1c777777-7777-7777-7777-777777777777', 'gabriele.azzurro@example.com', 'Gabriele', 'Azzurro', 'Italy', '+39364789346', 'linkedin.com/in/gabrieleazzurro', 's789346', 'gabriele.azzurro@studenti.polito.it', '1998-04-06'::date, 'Male', 'Master', 'Social media', 'Computer Engineering', 38, '2023-09-20 10:15:00+02'::timestamptz, NULL),

('dddddddd-dddd-dddd-dddd-dddddddddddd', 'chiara.verdi@example.com', 'Chiara', 'Verdi', 'Italy', '+39365678902', 'linkedin.com/in/chiaraverdi', 's678902', 'chiara.verdi@studenti.polito.it', '1997-06-14'::date, 'Female', 'Master', 'Social media', 'Biomedical Engineering', NULL, '2023-03-05 10:30:00+01'::timestamptz, NULL),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'davide.marino@example.com', 'Davide', 'Marino', 'Italy', '+39366789013', 'linkedin.com/in/davidemarino', 's789013', 'davide.marino@studenti.polito.it', '2000-01-25'::date, 'Male', 'Bachelor', 'Friend referral', 'Aerospace Engineering', NULL, '2023-03-10 13:15:00+01'::timestamptz, NULL),

-- New applicants for the new positions (unique individuals, not team members)
('f1111111-1111-1111-1111-111111111111', 'lorenzo.bruno@example.com', 'Lorenzo', 'Bruno', 'Italy', '+39367345901', 'linkedin.com/in/lorenzobruno', 's345901', 'lorenzo.bruno@studenti.polito.it', '1998-11-22'::date, 'Male', 'Master', 'University website', 'Communication Design', NULL, '2023-06-01 10:00:00+02'::timestamptz, NULL),
('f2222222-2222-2222-2222-222222222222', 'martina.bianchi@example.com', 'Martina', 'Bianchi', 'Italy', '+39368456012', 'linkedin.com/in/martinabianchi', 's456012', 'martina.bianchi@studenti.polito.it', '2000-08-17'::date, 'Female', 'Bachelor', 'Social media', 'Cinema and Media Engineering', NULL, '2023-06-02 11:30:00+02'::timestamptz, NULL),
('f3333333-3333-3333-3333-333333333333', 'federico.neri@example.com', 'Federico', 'Neri', 'Italy', '+39369567123', 'linkedin.com/in/federiconeri', 's567123', 'federico.neri@studenti.polito.it', '1997-05-29'::date, 'Male', 'Master', 'Friend referral', 'Communications Engineering', NULL, '2023-06-03 09:15:00+02'::timestamptz, NULL),
('f4444444-4444-4444-4444-444444444444', 'alice.rossi@example.com', 'Alice', 'Rossi', 'Italy', '+39370678234', 'linkedin.com/in/alicerossi', 's678234', 'alice.rossi@studenti.polito.it', '1995-12-05'::date, 'Female', 'PhD', 'Professor recommendation', 'Computer Engineering', NULL, '2023-06-04 14:20:00+02'::timestamptz, NULL),
('f5555555-5555-5555-5555-555555555555', 'giovanni.villa@example.com', 'Giovanni', 'Villa', 'Italy', '+39371789345', 'linkedin.com/in/giovannivilla', 's789345', 'giovanni.villa@studenti.polito.it', '1998-03-12'::date, 'Male', 'Master', 'Career fair', 'Management Engineering', NULL, '2023-06-05 16:45:00+02'::timestamptz, NULL),
('f6666666-6666-6666-6666-666666666666', 'beatrice.conti@example.com', 'Beatrice', 'Conti', 'Italy', '+39372890456', 'linkedin.com/in/beatriceconti', 's890456', 'beatrice.conti@studenti.polito.it', '1999-09-18'::date, 'Female', 'Bachelor', 'LinkedIn', 'Event Management', NULL, '2023-06-06 10:30:00+02'::timestamptz, NULL),
('f7777777-7777-7777-7777-777777777777', 'tommaso.ricci@example.com', 'Tommaso', 'Ricci', 'Italy', '+39373901567', 'linkedin.com/in/tommasoricci', 's901567', 'tommaso.ricci@studenti.polito.it', '1997-07-24'::date, 'Male', 'Master', 'Student organization', 'Industrial Engineering', NULL, '2023-06-07 13:15:00+02'::timestamptz, NULL),
('f8888888-8888-8888-8888-888888888888', 'sara.galli@example.com', 'Sara', 'Galli', 'Italy', '+39374012678', 'linkedin.com/in/saragalli', 's012678', 'sara.galli@studenti.polito.it', '1996-02-13'::date, 'Female', 'PhD', 'Research group', 'Safety Engineering', NULL, '2023-06-08 11:45:00+02'::timestamptz, NULL),
('f9999999-9999-9999-9999-999999999999', 'nicolo.mancini@example.com', 'Nicolò', 'Mancini', 'Italy', '+39375123789', 'linkedin.com/in/nicolomancini', 's123789', 'nicolo.mancini@studenti.polito.it', '1998-10-31'::date, 'Male', 'Master', 'University website', 'Computer Engineering', NULL, '2023-06-09 14:30:00+02'::timestamptz, NULL),
('1d111111-1111-1111-1111-111111111111', 'camilla.fabbri@example.com', 'Camilla', 'Fabbri', 'Italy', '+39376234890', 'linkedin.com/in/camillafabbri', 's234890', 'camilla.fabbri@studenti.polito.it', '1999-04-06'::date, 'Female', 'Bachelor', 'Social media', 'Computer Science', NULL, '2023-06-10 09:20:00+02'::timestamptz, NULL),
('1d222222-2222-2222-2222-222222222222', 'riccardo.monti@example.com', 'Riccardo', 'Monti', 'Italy', '+39377345901', 'linkedin.com/in/riccardomonti', 's345901', 'riccardo.monti@studenti.polito.it', '1998-01-15'::date, 'Male', 'Master', 'Friend referral', 'Electronic Engineering', NULL, '2023-06-11 10:15:00+02'::timestamptz, NULL),
('1d333333-3333-3333-3333-333333333333', 'anna.lucchesi@example.com', 'Anna', 'Lucchesi', 'Italy', '+39378456012', 'linkedin.com/in/annalucchesi', 's456012', 'anna.lucchesi@studenti.polito.it', '1995-08-28'::date, 'Female', 'PhD', 'Professor recommendation', 'Electronic Engineering', NULL, '2023-06-12 13:30:00+02'::timestamptz, NULL),
('1d444444-4444-4444-4444-444444444444', 'manuel.testa@example.com', 'Manuel', 'Testa', 'Italy', '+39379567123', 'linkedin.com/in/manueltesta', 's567123', 'manuel.testa@studenti.polito.it', '1997-12-10'::date, 'Male', 'Master', 'Career fair', 'Control Systems Engineering', NULL, '2023-06-13 10:30:00+02'::timestamptz, NULL),
('1d555555-5555-5555-5555-555555555555', 'jessica.orlando@example.com', 'Jessica', 'Orlando', 'Italy', '+39380678234', 'linkedin.com/in/jessicaorlando', 's678234', 'jessica.orlando@studenti.polito.it', '2000-05-21'::date, 'Female', 'Bachelor', 'LinkedIn', 'Aerospace Engineering', NULL, '2023-06-14 13:15:00+02'::timestamptz, NULL),
('1d666666-6666-6666-6666-666666666666', 'antonio.marchetti@example.com', 'Antonio', 'Marchetti', 'Italy', '+39381789345', 'linkedin.com/in/antoniomarchetti', 's789345', 'antonio.marchetti@studenti.polito.it', '1998-09-03'::date, 'Male', 'Master', 'Student organization', 'Aerospace Engineering', NULL, '2023-06-15 11:45:00+02'::timestamptz, NULL),
('1d777777-7777-7777-7777-777777777777', 'chiara.milani@example.com', 'Chiara', 'Milani', 'Italy', '+39382890456', 'linkedin.com/in/chiaramilani', 's890456', 'chiara.milani@studenti.polito.it', '1996-03-16'::date, 'Female', 'PhD', 'Research group', 'Computer Science', NULL, '2023-06-16 14:30:00+02'::timestamptz, NULL),
('1d888888-8888-8888-8888-888888888888', 'marco.bernardi@example.com', 'Marco', 'Bernardi', 'Italy', '+39383901567', 'linkedin.com/in/marcobernardi', 's901567', 'marco.bernardi@studenti.polito.it', '1997-07-07'::date, 'Male', 'Master', 'University website', 'Mechanical Engineering', NULL, '2023-06-17 09:20:00+02'::timestamptz, NULL),
('1d999999-9999-9999-9999-999999999999', 'elena.barone@example.com', 'Elena', 'Barone', 'Italy', '+39384012678', 'linkedin.com/in/elenabarone', 's012678', 'elena.barone@studenti.polito.it', '1999-11-29'::date, 'Female', 'Bachelor', 'Social media', 'Mechanical Engineering', NULL, '2023-06-18 10:15:00+02'::timestamptz, NULL),
('1e111111-1111-1111-1111-111111111111', 'luca.fiore@example.com', 'Luca', 'Fiore', 'Italy', '+39385123789', 'linkedin.com/in/lucafiore', 's123789', 'luca.fiore@studenti.polito.it', '1998-06-14'::date, 'Male', 'Master', 'Friend referral', 'Propulsion Engineering', NULL, '2023-06-19 13:30:00+02'::timestamptz, NULL),
('1e222222-2222-2222-2222-222222222222', 'sofia.colombo@example.com', 'Sofia', 'Colombo', 'Italy', '+39386234890', 'linkedin.com/in/sofiacolombo', 's234890', 'sofia.colombo@studenti.polito.it', '1995-04-01'::date, 'Female', 'PhD', 'Professor recommendation', 'Chemical Engineering', NULL, '2023-06-20 10:30:00+02'::timestamptz, NULL),
('1e333333-3333-3333-3333-333333333333', 'matteo.leone@example.com', 'Matteo', 'Leone', 'Italy', '+39387345901', 'linkedin.com/in/matteoleone', 's345901', 'matteo.leone@studenti.polito.it', '1997-10-18'::date, 'Male', 'Master', 'Career fair', 'Propulsion Engineering', NULL, '2023-06-21 13:15:00+02'::timestamptz, NULL),
('1e444444-4444-4444-4444-444444444444', 'giulia.ferri@example.com', 'Giulia', 'Ferri', 'Italy', '+39388456012', 'linkedin.com/in/giuliaferri', 's456012', 'giulia.ferri@studenti.polito.it', '2000-01-23'::date, 'Female', 'Bachelor', 'LinkedIn', 'Chemical Engineering', NULL, '2023-06-22 11:45:00+02'::timestamptz, NULL),

-- New applicant users (not team members)
('a1111111-1111-1111-1111-111111111111', 'marco.rossi@studenti.polito.it', 'Marco', 'Rossi', 'Italy', '+39389123456', 'https://linkedin.com/in/marcorossi', 's123456', 'marco.rossi@studenti.polito.it', '2000-02-14'::date, 'Male', 'Bachelor', 'Student organization', 'Aerospace Engineering', NULL, '2024-01-10 10:00:00+01'::timestamptz, NULL),
('a2222222-2222-2222-2222-222222222222', 'sofia.bianchi@studenti.polito.it', 'Sofia', 'Bianchi', 'Italy', '+39390234567', 'https://linkedin.com/in/sofiabianchi', 's234567', 'sofia.bianchi@studenti.polito.it', '1998-05-27'::date, 'Female', 'Master', 'University website', 'Mechanical Engineering', NULL, '2024-01-15 11:30:00+01'::timestamptz, NULL),
('a3333333-3333-3333-3333-333333333333', 'ahmed.hassan@studenti.polito.it', 'Ahmed', 'Hassan', 'Egypt', '+39391345678', 'https://linkedin.com/in/ahmedhassan', 's345678', 'ahmed.hassan@studenti.polito.it', '1997-09-11'::date, 'Male', 'Master', 'International program', 'Computer Engineering', NULL, '2024-01-20 09:15:00+01'::timestamptz, NULL),
('a4444444-4444-4444-4444-444444444444', 'elena.popov@studenti.polito.it', 'Elena', 'Popov', 'Bulgaria', '+39392456789', 'https://linkedin.com/in/elenapovv', 's456789', 'elena.popov@studenti.polito.it', '1999-12-03'::date, 'Female', 'Bachelor', 'Exchange program', 'Materials Engineering', NULL, '2024-01-25 14:20:00+01'::timestamptz, NULL),
('a5555555-5555-5555-5555-555555555555', 'carlos.garcia@studenti.polito.it', 'Carlos', 'Garcia', 'Spain', '+39393567890', 'https://linkedin.com/in/carlosgarcia', 's567890', 'carlos.garcia@studenti.polito.it', '2000-08-19'::date, 'Male', 'Bachelor', 'Erasmus program', 'Aerospace Engineering', NULL, '2024-01-30 16:45:00+01'::timestamptz, NULL);

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



-- Insert Application Files first
INSERT INTO application_files (r2_key, original_filename, mime_type, file_size, file_hash, user_id) VALUES
-- Files for the accepted full-stack application
('applications/chiara_cv_hash123.pdf', 'chiara_cv.pdf', 'application/pdf', 524288, 'hash123cv', 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
('applications/chiara_ml_hash456.pdf', 'chiara_ml.pdf', 'application/pdf', 262144, 'hash456ml', 'dddddddd-dddd-dddd-dddd-dddddddddddd'),

-- Files for Position 2: Graphic Designer applications
('applications/lorenzo_graphic_cv_hash789.pdf', 'lorenzo_graphic_cv.pdf', 'application/pdf', 400000, 'hash789', 'f1111111-1111-1111-1111-111111111111'),
('applications/lorenzo_graphic_ml_hash101.pdf', 'lorenzo_graphic_ml.pdf', 'application/pdf', 300000, 'hash101', 'f1111111-1111-1111-1111-111111111111'),
('applications/martina_photo_cv_hash102.pdf', 'martina_photo_cv.pdf', 'application/pdf', 450000, 'hash102', 'f2222222-2222-2222-2222-222222222222'),
('applications/martina_photo_ml_hash103.pdf', 'martina_photo_ml.pdf', 'application/pdf', 350000, 'hash103', 'f2222222-2222-2222-2222-222222222222'),

-- Files for Position 3: Photographer & Videomaker
('applications/federico_photo_cv_hash104.pdf', 'federico_photo_cv.pdf', 'application/pdf', 420000, 'hash104', 'f3333333-3333-3333-3333-333333333333'),
('applications/federico_photo_ml_hash105.pdf', 'federico_photo_ml.pdf', 'application/pdf', 280000, 'hash105', 'f3333333-3333-3333-3333-333333333333'),

-- Files for Position 4: Social Media Manager
('applications/alice_social_cv_hash106.pdf', 'alice_social_cv.pdf', 'application/pdf', 380000, 'hash106', 'f4444444-4444-4444-4444-444444444444'),
('applications/alice_social_ml_hash107.pdf', 'alice_social_ml.pdf', 'application/pdf', 250000, 'hash107', 'f4444444-4444-4444-4444-444444444444'),

-- Files for Position 5: Sponsoring Specialist
('applications/giovanni_sponsor_cv_hash108.pdf', 'giovanni_sponsor_cv.pdf', 'application/pdf', 410000, 'hash108', 'f5555555-5555-5555-5555-555555555555'),

-- Files for Position 9: Embedded Software Engineer
('applications/nicolo_embedded_cv_hash109.pdf', 'nicolo_embedded_cv.pdf', 'application/pdf', 390000, 'hash109', 'f9999999-9999-9999-9999-999999999999'),
('applications/ahmed_embedded_cv_hash110.pdf', 'ahmed_embedded_cv.pdf', 'application/pdf', 420000, 'hash110', 'a3333333-3333-3333-3333-333333333333'),

-- Files for Position 10: Desktop Application Developer
('applications/camilla_desktop_cv_hash111.pdf', 'camilla_desktop_cv.pdf', 'application/pdf', 385000, 'hash111', '1d111111-1111-1111-1111-111111111111'),

-- Files for Position 11: RF Specialist
('applications/riccardo_rf_cv_hash112.pdf', 'riccardo_rf_cv.pdf', 'application/pdf', 405000, 'hash112', '1d222222-2222-2222-2222-222222222222'),

-- Files for Position 12: Hardware Engineer
('applications/anna_hardware_cv_hash113.pdf', 'anna_hardware_cv.pdf', 'application/pdf', 395000, 'hash113', '1d333333-3333-3333-3333-333333333333'),

-- Files for Position 13: Control System Engineer
('applications/manuel_control_cv_hash114.pdf', 'manuel_control_cv.pdf', 'application/pdf', 415000, 'hash114', '1d444444-4444-4444-4444-444444444444'),

-- Files for Position 14: Recovery Engineer
('applications/jessica_recovery_cv_hash115.pdf', 'jessica_recovery_cv.pdf', 'application/pdf', 375000, 'hash115', '1d555555-5555-5555-5555-555555555555'),

-- Files for Position 15: Mission Analyst
('applications/antonio_mission_cv_hash116.pdf', 'antonio_mission_cv.pdf', 'application/pdf', 430000, 'hash116', '1d666666-6666-6666-6666-666666666666'),

-- Files for Position 16: Software Engineer
('applications/chiara_software_cv_hash117.pdf', 'chiara_software_cv.pdf', 'application/pdf', 385000, 'hash117', '1d777777-7777-7777-7777-777777777777'),

-- Files for Position 17: Design & Manufacturing Engineer
('applications/marco_design_cv_hash118.pdf', 'marco_design_cv.pdf', 'application/pdf', 400000, 'hash118', '1d888888-8888-8888-8888-888888888888'),

-- Files for Position 18: Structural Engineer
('applications/elena_structural_cv_hash119.pdf', 'elena_structural_cv.pdf', 'application/pdf', 420000, 'hash119', '1d999999-9999-9999-9999-999999999999'),

-- Files for Position 19: Feed System Engineer
('applications/luca_feed_cv_hash120.pdf', 'luca_feed_cv.pdf', 'application/pdf', 410000, 'hash120', '1e111111-1111-1111-1111-111111111111'),
('applications/sofia_bianchi_cv_hash121.pdf', 'sofia_bianchi_cv.pdf', 'application/pdf', 390000, 'hash121', 'a2222222-2222-2222-2222-222222222222'),

-- Files for Position 20: Test Engineer (Propulsion)
('applications/sofia_test_cv_hash122.pdf', 'sofia_test_cv.pdf', 'application/pdf', 405000, 'hash122', '1e222222-2222-2222-2222-222222222222'),

-- Files for Position 21: Test Engineer (Thrust Chamber)
('applications/matteo_thrust_cv_hash123.pdf', 'matteo_thrust_cv.pdf', 'application/pdf', 395000, 'hash123', '1e333333-3333-3333-3333-333333333333'),

-- Files for Position 22: Propulsion Engineer
('applications/giulia_propulsion_cv_hash124.pdf', 'giulia_propulsion_cv.pdf', 'application/pdf', 425000, 'hash124', '1e444444-4444-4444-4444-444444444444'),
('applications/marco_rossi_cv_hash125.pdf', 'marco_rossi_cv.pdf', 'application/pdf', 380000, 'hash125', 'a1111111-1111-1111-1111-111111111111');

-- Insert Applications with file references
INSERT INTO applications (apply_position_id, user_id, cv_file_id, cover_letter_file_id, applied_at, status, custom_answers) VALUES
-- Application for Position 1: Full-Stack Developer
(1, 'dddddddd-dddd-dddd-dddd-dddddddddddd', 1, 2, '2023-02-05 16:45:00+01'::timestamptz, 'accepted', 
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

-- Applications for Position 2: Graphic Designer
(2, 'f1111111-1111-1111-1111-111111111111', 3, 4, '2023-06-05 14:30:00+02'::timestamptz, 'received', 
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

(2, 'f2222222-2222-2222-2222-222222222222', 5, 6, '2023-06-06 09:15:00+02'::timestamptz, 'interview', 
   ARRAY[
     jsonb_build_object(
       'question', 'What design software do you use most frequently?',
       'answer', 'Adobe Creative Suite and Figma for UI/UX design. I also use Canva for quick social media graphics'
     ),
     jsonb_build_object(
       'question', 'Can you share examples of technical illustrations you have created?',
       'answer', 'I have designed infographics explaining engineering processes and created visual guides for technical documentation'
     )
   ]),

-- Applications for Position 3: Photographer & Videomaker
(3, 'f3333333-3333-3333-3333-333333333333', 7, 8, '2023-06-07 11:20:00+02'::timestamptz, 'accepted', 
   ARRAY[
     jsonb_build_object(
       'question', 'What camera equipment are you familiar with?',
       'answer', 'Canon DSLR cameras, various lenses including macro and telephoto, DJI drones, and professional lighting setups'
     ),
     jsonb_build_object(
       'question', 'Do you have experience filming technical/engineering content?',
       'answer', 'Yes, I have documented manufacturing processes and created educational videos for engineering projects at university'
     )
   ]),

-- Applications for Position 4: Social Media Manager
(4, 'f4444444-4444-4444-4444-444444444444', 9, 10, '2023-06-08 16:45:00+02'::timestamptz, 'received', 
   ARRAY[
     jsonb_build_object(
       'question', 'Which social media platforms do you have experience managing?',
       'answer', 'Instagram, LinkedIn, Twitter, YouTube, and TikTok. I have managed accounts with 10k+ followers'
     ),
     jsonb_build_object(
       'question', 'How do you measure social media success?',
       'answer', 'I track engagement rates, reach, follower growth, and conversion metrics. I use analytics tools to optimize content strategy'
     )
   ]),

-- Applications for Position 5: Sponsoring Specialist
(5, 'f5555555-5555-5555-5555-555555555555', 11, NULL, '2023-06-09 10:30:00+02'::timestamptz, 'interview', 
   ARRAY[
     jsonb_build_object(
       'question', 'What types of partnerships have you developed before?',
       'answer', 'I have secured sponsorships for university events, ranging from local businesses to tech companies'
     ),
     jsonb_build_object(
       'question', 'How do you approach sponsor relationship management?',
       'answer', 'I focus on building long-term relationships by delivering value, regular communication, and transparent reporting'
     )
   ]),

-- Applications for Position 6: Events Specialist  
(6, 'f6666666-6666-6666-6666-666666666666', NULL, NULL, '2023-06-10 14:15:00+02'::timestamptz, 'received', 
   ARRAY[
     jsonb_build_object(
       'question', 'What types of events have you organized before?',
       'answer', 'University conferences, technical workshops, and promotional events for student organizations'
     ),
     jsonb_build_object(
       'question', 'How do you handle event logistics and coordination?',
       'answer', 'I use project management tools to track timelines, coordinate with vendors, and ensure all requirements are met'
     )
   ]),

-- Applications for Position 7: Test & Mission Support Specialist
(7, 'f7777777-7777-7777-7777-777777777777', NULL, NULL, '2023-06-11 09:45:00+02'::timestamptz, 'received', 
   ARRAY[
     jsonb_build_object(
       'question', 'Do you have experience with technical testing operations?',
       'answer', 'I have supported testing operations during my internship at an automotive company, helping with data collection and equipment setup'
     ),
     jsonb_build_object(
       'question', 'How do you prioritize safety in high-stakes environments?',
       'answer', 'Safety protocols come first - I ensure all procedures are followed, equipment is checked, and communication is clear'
     )
   ]),

-- Applications for Position 8: Safety Officer
(8, 'f8888888-8888-8888-8888-888888888888', NULL, NULL, '2023-06-12 13:30:00+02'::timestamptz, 'accepted', 
   ARRAY[
     jsonb_build_object(
       'question', 'What safety certifications do you hold?',
       'answer', 'I have OSHA 30-hour certification and first aid/CPR training. Currently pursuing additional safety management certification'
     ),
     jsonb_build_object(
       'question', 'Describe your approach to risk assessment in technical environments',
       'answer', 'I conduct systematic hazard identification, assess probability and severity, and implement controls following hierarchy of risk management'
     )
   ]),

-- Applications for Position 9: Embedded Software Engineer
(9, 'f9999999-9999-9999-9999-999999999999', 12, NULL, '2023-06-13 11:15:00+02'::timestamptz, 'interview', 
   ARRAY[
     jsonb_build_object(
       'question', 'What embedded platforms have you worked with?',
       'answer', 'Arduino, Raspberry Pi, STM32 microcontrollers, and ESP32 for IoT projects'
     ),
     jsonb_build_object(
       'question', 'Describe your experience with real-time systems development',
       'answer', 'I have developed real-time control systems for robotics projects, implementing interrupt-driven programming and timing-critical functions'
     )
   ]),

(9, 'a3333333-3333-3333-3333-333333333333', 13, NULL, '2024-01-18 09:45:00+01'::timestamptz, 'accepted', 
   ARRAY[
     jsonb_build_object(
       'question', 'What embedded platforms have you worked with?',
       'answer', 'STM32, Arduino, and Raspberry Pi. I built a quadcopter flight controller from scratch'
     ),
     jsonb_build_object(
       'question', 'Describe your experience with real-time systems development',
       'answer', 'I implemented real-time control loops for drone stabilization with microsecond precision timing requirements'
     )
   ]),

-- Applications for Position 10: Desktop Application Developer
(10, '1d111111-1111-1111-1111-111111111111', 14, NULL, '2023-06-14 15:45:00+02'::timestamptz, 'received', 
   ARRAY[
     jsonb_build_object(
       'question', 'Which desktop development frameworks do you prefer?',
       'answer', 'I prefer Electron for cross-platform apps and Qt for performance-critical applications'
     ),
     jsonb_build_object(
       'question', 'How do you approach real-time data visualization?',
       'answer', 'I use efficient charting libraries, implement data buffering, and optimize rendering for smooth real-time updates'
     )
   ]),

-- Applications for Position 11: RF Specialist
(11, '1d222222-2222-2222-2222-222222222222', 15, NULL, '2023-06-15 10:30:00+02'::timestamptz, 'interview', 
   ARRAY[
     jsonb_build_object(
       'question', 'What RF frequency bands have you worked with?',
       'answer', 'VHF/UHF for amateur radio, 2.4GHz for wireless systems, and some experience with S-band for telemetry'
     ),
     jsonb_build_object(
       'question', 'Do you hold an amateur radio license?',
       'answer', 'Yes, I hold a General class license and actively participate in amateur radio emergency communications'
     )
   ]),

-- Applications for Position 12: Hardware Engineer
(12, '1d333333-3333-3333-3333-333333333333', 16, NULL, '2023-06-16 14:20:00+02'::timestamptz, 'received', 
   ARRAY[
     jsonb_build_object(
       'question', 'What PCB design software do you use?',
       'answer', 'KiCad for open-source projects and Altium Designer for professional work. Also familiar with Eagle'
     ),
     jsonb_build_object(
       'question', 'Describe your experience with environmental testing of electronics',
       'answer', 'I have conducted temperature cycling, vibration testing, and humidity testing for ruggedized electronics'
     )
   ]),

-- Applications for Position 13: Control System Engineer
(13, '1d444444-4444-4444-4444-444444444444', 17, NULL, '2023-06-17 09:15:00+02'::timestamptz, 'accepted', 
   ARRAY[
     jsonb_build_object(
       'question', 'What control theory concepts are you most experienced with?',
       'answer', 'PID control, state-space methods, Kalman filtering, and adaptive control for dynamic systems'
     ),
     jsonb_build_object(
       'question', 'Describe your experience with flight control systems',
       'answer', 'I designed and simulated autopilot systems for UAVs, implementing stabilization and waypoint navigation'
     )
   ]),

-- Applications for Position 14: Recovery Engineer
(14, '1d555555-5555-5555-5555-555555555555', 18, NULL, '2023-06-18 16:30:00+02'::timestamptz, 'interview', 
   ARRAY[
     jsonb_build_object(
       'question', 'What types of recovery systems have you worked with?',
       'answer', 'Parachute systems for model rockets, drogue and main chute deployment mechanisms'
     ),
     jsonb_build_object(
       'question', 'How do you approach recovery system reliability and safety?',
       'answer', 'Multiple redundancy, extensive testing, and conservative safety factors in all design calculations'
     )
   ]),

-- Applications for Position 15: Mission Analyst
(15, '1d666666-6666-6666-6666-666666666666', 19, NULL, '2023-06-19 11:45:00+02'::timestamptz, 'received', 
   ARRAY[
     jsonb_build_object(
       'question', 'What mission analysis tools are you familiar with?',
       'answer', 'MATLAB for trajectory analysis, STK for mission planning, and Python for custom simulation scripts'
     ),
     jsonb_build_object(
       'question', 'Describe your experience with trajectory optimization',
       'answer', 'I optimized launch trajectories for maximum altitude using genetic algorithms and gradient-based methods'
     )
   ]),

-- Applications for Position 16: Software Engineer (Mission Analysis)
(16, '1d777777-7777-7777-7777-777777777777', 20, NULL, '2023-06-20 13:15:00+02'::timestamptz, 'accepted', 
   ARRAY[
     jsonb_build_object(
       'question', 'What programming languages do you use for scientific computing?',
       'answer', 'Python with NumPy/SciPy, MATLAB for prototyping, and C++ for performance-critical simulations'
     ),
     jsonb_build_object(
       'question', 'Describe your experience with simulation software development',
       'answer', 'I developed a 6DOF rocket simulation with atmospheric modeling and Monte Carlo analysis capabilities'
     )
   ]),

-- Applications for Position 17: Design & Additive Manufacturing Engineer
(17, '1d888888-8888-8888-8888-888888888888', 21, NULL, '2023-06-21 10:45:00+02'::timestamptz, 'interview', 
   ARRAY[
     jsonb_build_object(
       'question', 'What CAD software do you use for design?',
       'answer', 'SolidWorks for mechanical design, Fusion 360 for integrated CAM, and Blender for artistic modeling'
     ),
     jsonb_build_object(
       'question', 'Which additive manufacturing technologies have you worked with?',
       'answer', 'FDM printers, SLA for high-detail parts, and some experience with SLS for functional prototypes'
     )
   ]),

-- Applications for Position 18: Structural Engineer
(18, '1d999999-9999-9999-9999-999999999999', 22, NULL, '2023-06-22 15:30:00+02'::timestamptz, 'received', 
   ARRAY[
     jsonb_build_object(
       'question', 'What FEA software do you use for structural analysis?',
       'answer', 'ANSYS for complex simulations, SolidWorks Simulation for quick analysis, and some experience with Abaqus'
     ),
     jsonb_build_object(
       'question', 'Describe your experience with aerospace structures',
       'answer', 'I analyzed composite wing structures during my thesis, focusing on buckling and fatigue analysis'
     )
   ]),

-- Applications for Position 19: Feed System Engineer
(19, '1e111111-1111-1111-1111-111111111111', 23, NULL, '2023-06-23 09:20:00+02'::timestamptz, 'accepted', 
   ARRAY[
     jsonb_build_object(
       'question', 'What experience do you have with fluid systems design?',
       'answer', 'I designed hydraulic systems for industrial machinery and studied turbomachinery in my coursework'
     ),
     jsonb_build_object(
       'question', 'Describe your knowledge of rocket propellant handling',
       'answer', 'I understand the safety requirements for handling hypergolic and cryogenic propellants from aerospace courses'
     )
   ]),

(19, 'a2222222-2222-2222-2222-222222222222', 24, NULL, '2024-01-20 14:15:00+01'::timestamptz, 'received', 
   ARRAY[
     jsonb_build_object(
       'question', 'What experience do you have with fluid systems design?',
       'answer', 'During my mechanical engineering studies, I designed a pump system for water distribution'
     ),
     jsonb_build_object(
       'question', 'Describe your knowledge of rocket propellant handling',
       'answer', 'I have studied the theoretical aspects and safety protocols for handling rocket propellants'
     )
   ]),

-- Applications for Position 20: Test Engineer (Propulsion)
(20, '1e222222-2222-2222-2222-222222222222', 25, NULL, '2023-06-24 14:10:00+02'::timestamptz, 'interview', 
   ARRAY[
     jsonb_build_object(
       'question', 'What types of propulsion testing have you been involved with?',
       'answer', 'I assisted with small-scale solid motor testing and data acquisition during university projects'
     ),
     jsonb_build_object(
       'question', 'How do you ensure safety during hazardous testing operations?',
       'answer', 'Comprehensive safety briefings, proper PPE, remote operation when possible, and emergency response plans'
     )
   ]),

-- Applications for Position 21: Test Engineer (Thrust Chamber)
(21, '1e333333-3333-3333-3333-333333333333', 26, NULL, '2023-06-25 11:35:00+02'::timestamptz, 'received', 
   ARRAY[
     jsonb_build_object(
       'question', 'Describe your experience with combustion testing',
       'answer', 'I conducted burner testing for my thesis research and have experience with flame temperature measurement'
     ),
     jsonb_build_object(
       'question', 'What diagnostic techniques have you used for engine testing?',
       'answer', 'Pressure transducers, thermocouples, high-speed photography, and exhaust gas analysis'
     )
   ]),

-- Applications for Position 22: Propulsion Engineer
(22, '1e444444-4444-4444-4444-444444444444', 27, NULL, '2023-06-26 16:45:00+02'::timestamptz, 'accepted', 
   ARRAY[
     jsonb_build_object(
       'question', 'What is your experience with rocket engine design?',
       'answer', 'I designed and simulated a small liquid rocket engine for my senior capstone project'
     ),
     jsonb_build_object(
       'question', 'Describe your knowledge of combustion chamber cooling methods',
       'answer', 'I studied regenerative cooling, film cooling, and ablative cooling methods in my propulsion coursework'
     )
   ]),

(22, 'a1111111-1111-1111-1111-111111111111', 28, NULL, '2024-01-15 10:30:00+01'::timestamptz, 'received', 
   ARRAY[
     jsonb_build_object(
       'question', 'What is your experience with rocket engine design?',
       'answer', 'I am passionate about space exploration and have studied rocket propulsion theory extensively'
     ),
     jsonb_build_object(
       'question', 'Describe your knowledge of combustion chamber cooling methods',
       'answer', 'I understand regenerative cooling principles and have analyzed heat transfer in combustion chambers'
     )
   ]);

-- Insert Scopes with new structure
-- (user_id, scope, target, access_level, dept_id, division_id, given_by)
INSERT INTO scopes (user_id, scope, target, access_level, dept_id, division_id, given_by) VALUES
-- Admin scopes (technical/system access)
('00000000-0000-0000-0000-000000000001', 'admin', 'all', 'edit', NULL, NULL, NULL),  -- Developer with full admin access
('11111111-1111-1111-1111-111111111111', 'admin', 'logs', 'view', NULL, NULL, NULL),   -- Marco with log viewing access

-- Org-wide scopes (presidents, management)
('22222222-2222-2222-2222-222222222222', 'org', 'all', 'edit', NULL, NULL, NULL),    -- Giulia - President with full org access
('33333333-3333-3333-3333-333333333333', 'org', 'members', 'view', NULL, NULL, NULL),   -- Alessandro - can view all members
('44444444-4444-4444-4444-444444444444', 'org', 'orders', 'edit', NULL, NULL, NULL),    -- Valentina - can manage all orders

-- Department-level scopes
('55555555-5555-5555-5555-555555555555', 'department', 'members', 'edit', 1, NULL, NULL),     -- Luca - can edit members in Technical dept
('66666666-6666-6666-6666-666666666666', 'department', 'applications', 'view', 1, NULL, NULL), -- Sofia - can view applications in Technical dept
('77777777-7777-7777-7777-777777777777', 'department', 'orders', 'edit', 2, NULL, NULL),      -- Matteo - can edit orders in Operations dept
('88888888-8888-8888-8888-888888888888', 'department', 'all', 'edit', 3, NULL, NULL),         -- Elena - department lead for Marketing with full access

-- Division-level scopes
('99999999-9999-9999-9999-999999999999', 'division', 'members', 'edit', NULL, 1, NULL),      -- Andrea - can edit members in Software div
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'division', 'applications', 'view', NULL, 2, NULL), -- Francesca - can view applications in Propulsion div
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'division', 'orders', 'edit', NULL, 3, NULL),      -- Simone - can edit orders in Operations Management div
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'division', 'all', 'edit', NULL, 4, NULL),         -- Claudia - division lead for Event Management

-- Website content management scopes
('1a111111-1111-1111-1111-111111111111', 'core_member', 'blog', 'edit', NULL, NULL, NULL),      -- Giovanni - can edit blog content
('1a222222-2222-2222-2222-222222222222', 'core_member', 'faq', 'view', NULL, NULL, NULL),       -- Martina - can edit FAQ content
('1a333333-3333-3333-3333-333333333333', 'core_member', 'blog', 'view', NULL, NULL, NULL),     -- Federico - can view blog content

-- Additional examples for coverage
('1a444444-4444-4444-4444-444444444444', 'division', 'members', 'view', NULL, 5, NULL),    -- Alice - can view members in Communications div
('1a555555-5555-5555-5555-555555555555', 'department', 'applications', 'edit', 2, NULL, NULL), -- Lorenzo - can edit applications in Operations dept
('1a666666-6666-6666-6666-666666666666', 'org', 'applications', 'view', NULL, NULL, NULL),   -- Beatrice - can view all applications org-wide
('1a777777-7777-7777-7777-777777777777', 'division', 'orders', 'view', NULL, 6, NULL);      -- Tommaso - can view orders in Management div
