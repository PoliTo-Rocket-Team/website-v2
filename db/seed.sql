-- The baseline seed module (db/seed/baseline.ts) runs this file: orders and
-- recruitment. Its reset empties these tables first, so this file only
-- inserts. The people and units it names come from the typed modules that run
-- before it (db/seed/structure.ts, db/seed/people.ts), by the same ids. Run
-- it through `pnpm db:seed`, never by hand: the runner's guard checks the
-- target.

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
