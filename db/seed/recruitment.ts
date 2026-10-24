// The recruitment seed (issue #305): the positions on /apply and the
// dashboard's Positions page, the applications on its Applications page
// (issue #171), the interview times offered on them (issue #186), and the
// site-wide recruitment switch, on (issue #119). Positions 1–22 keep the
// texts db/seed.sql used to hold. Every stage an application can be in has
// one at least: new, in review, interview (times offered, and one booked),
// accepted (waiting for the NDA, and with the NDA arrived), joined, rejected
// (by this team, and by another team taking the person) and withdrawn.
// Applications and their answers are private, so every applicant is an
// invented person (issue #326).

import { applicationFiles, applications, applyPositions, interviewSlots, recruitmentSetting } from "@/db/schema";
import { seatOf } from "@/lib/seeded-accounts";
import { samplePdf } from "@/lib/seed/sample-pdf";
import { privatePathname } from "@/lib/storage/pathname";
import { rowsOf, tableSeedModule } from "./rows";
import { DIVISION as D } from "./structure";

/** This cycle's positions were opened on this day; a closed one in the spring before. */
const OPENED = "2026-09-01";
const SPRING = "2026-03-02";

/** Positions taken off /apply: two from the spring cycle, and the one the joined member applied to in 2022. */
export const CLOSED_POSITIONS: ReadonlySet<number> = new Set([13, 18, 23]);

function openedAt(id: number): string {
  const day = CLOSED_POSITIONS.has(id) ? SPRING : OPENED;
  return `${day} 10:${String(id).padStart(2, "0")}:00+02`;
}

function position(
  id: number,
  divisionId: number,
  title: string,
  description: string,
  requiredSkills: string[],
  desirableSkills: string[],
  customQuestions: string[],
) {
  return {
    id,
    status: !CLOSED_POSITIONS.has(id),
    divisionId,
    title,
    description,
    requiredSkills,
    desirableSkills,
    customQuestions,
    createdAt: openedAt(id),
  };
}

export const POSITION_ROWS = rowsOf(applyPositions, [
  position(1, D.informationTechnology, "Full-Stack Developer", "We are looking for a Full-Stack Developer to join our team and help build and maintain our new website using Next.js, Supabase, and ShadCN. Our biggest goal is to develop a recruitment management system directly on our platform, making it easier for leads and chiefs to handle applications and organize team information. What You will Do: - Develop and maintain the team website using Next.js, Supabase, and ShadCN - Implement and expand the admin section, where team leads manage recruitment and team data - Enhance the website with smooth UI/UX improvements, animations, and interactions - Improve existing pages and develop new ones as needed - Work with Three.js to create engaging 3D elements and visualizations",
    ["Strong fundamentals in HTML, CSS, and JavaScript", "Problem-solving skills and ability to work independently on development tasks"],
    ["Experience with Next.js and TypeScript", "Familiarity with Supabase (authentication, database, storage)", "Knowledge of ShadCN/UI for building modern and accessible interfaces", "Knowledge and previous use of the Three.js library", "Previous experience with Git and GitHub", "Previous experience with PostgreSQL", "Basic knowledge of Accessible Rich Internet Applications (ARIA)"],
    ["Describe your experience with frontend frameworks", "What React hooks do you use most frequently?"]),
  position(2, D.communications, "Graphic Designer", "Join our Communications team as a Graphic Designer to create compelling visual content for our rocket team. You will be responsible for designing promotional materials, technical diagrams, social media graphics, and brand assets that effectively communicate our mission and achievements.",
    ["Proficiency in Adobe Creative Suite (Photoshop, Illustrator, InDesign)", "Strong understanding of design principles and typography", "Experience with brand guidelines and visual identity"],
    ["Experience with technical illustration and engineering diagrams", "Knowledge of web design and UI/UX principles", "Familiarity with 3D rendering software", "Video editing capabilities", "Understanding of aerospace/engineering context"],
    ["What design software do you use most frequently?", "Can you share examples of technical illustrations you have created?"]),
  position(3, D.communications, "Photographer & Videomaker", "Capture and create stunning visual content documenting our rocket development journey. You will be responsible for photographing test events, creating promotional videos, documenting team activities, and producing engaging multimedia content for our communications channels.",
    ["Experience with professional photography equipment", "Video production and editing skills", "Understanding of lighting and composition"],
    ["Drone photography/videography certification", "Experience with technical/industrial photography", "Live streaming and event coverage experience", "Color grading and post-production expertise", "Social media content creation"],
    ["What camera equipment are you familiar with?", "Do you have experience filming technical/engineering content?"]),
  position(4, D.communications, "Social Media Manager", "Lead our digital presence and engage with the aerospace community through strategic social media management. You will develop content strategies, manage our social media channels, create engaging posts, and help build our brand presence across multiple platforms.",
    ["Social media strategy and content planning", "Strong written communication skills", "Understanding of social media analytics"],
    ["Experience with aerospace/engineering content", "Graphic design skills for social media", "Community management experience", "Influencer outreach and partnerships", "Crisis communication management"],
    ["Which social media platforms do you have experience managing?", "How do you measure social media success?"]),
  position(5, D.logistics, "Sponsoring Specialist", "Lead our sponsorship and partnership efforts to secure funding and resources for our rocket projects. You will identify potential sponsors, develop sponsorship packages, maintain relationships with existing partners, and coordinate sponsor recognition activities.",
    ["Business development and partnership skills", "Strong communication and presentation abilities", "Project management and organizational skills"],
    ["Experience in aerospace or technical sponsorships", "Knowledge of corporate partnership structures", "Grant writing experience", "Event planning and coordination", "Understanding of aerospace industry"],
    ["What types of partnerships have you developed before?", "How do you approach sponsor relationship management?"]),
  position(6, D.logistics, "Events Specialist", "Plan and execute engaging events that showcase our rocket team and connect with the aerospace community. You will organize test launches, public demonstrations, educational outreach events, and coordinate with venues, vendors, and attendees.",
    ["Event planning and coordination experience", "Project management skills", "Strong organizational and time management abilities"],
    ["Experience with technical or aerospace events", "Vendor management and contract negotiation", "Risk assessment and safety planning", "Marketing and promotional experience", "Budget management skills"],
    ["What types of events have you organized before?", "How do you handle event logistics and coordination?"]),
  position(7, D.logistics, "Test & Mission Support Specialist", "Provide critical logistical support for our rocket testing and mission operations. You will coordinate test schedules, manage equipment logistics, ensure safety protocols are followed, and provide operational support during testing phases.",
    ["Strong organizational and coordination skills", "Understanding of safety protocols and procedures", "Ability to work under pressure in dynamic environments"],
    ["Experience with technical testing environments", "Knowledge of aerospace safety standards", "Equipment maintenance and inventory management", "Communication with regulatory bodies", "Data collection and documentation skills"],
    ["Do you have experience with technical testing operations?", "How do you prioritize safety in high-stakes environments?"]),
  position(8, D.safety, "Safety Officer", "Ensure the highest safety standards across all our rocket development and testing activities. You will develop safety protocols, conduct risk assessments, oversee safety training, and monitor compliance with safety regulations during all team operations.",
    ["Knowledge of safety regulations and standards", "Risk assessment and management skills", "Strong attention to detail and analytical thinking"],
    ["Aerospace or high-hazard industry safety experience", "Safety certification (OSHA, NEBOSH, or equivalent)", "Incident investigation and reporting", "Safety training and education experience", "Regulatory compliance knowledge"],
    ["What safety certifications do you hold?", "Describe your approach to risk assessment in technical environments"]),
  position(9, D.firmware, "Embedded Software Engineer", "Develop embedded software solutions for our rocket systems, including flight computers, sensor interfaces, and control algorithms. You will work on real-time systems, implement communication protocols, and ensure reliable software performance in challenging environments.",
    ["Embedded C/C++ programming experience", "Understanding of microcontrollers and real-time systems", "Knowledge of communication protocols (SPI, I2C, UART)"],
    ["Experience with aerospace or automotive embedded systems", "RTOS (Real-Time Operating Systems) experience", "Hardware debugging and testing", "Version control and collaborative development", "Knowledge of safety-critical software standards"],
    ["What embedded platforms have you worked with?", "Describe your experience with real-time systems development"]),
  position(10, D.groundStation, "Desktop Application Developer", "Create desktop applications for ground station operations, data analysis, and mission control. You will develop user interfaces for rocket telemetry, real-time monitoring systems, and data visualization tools for mission operations.",
    ["Desktop application development experience", "UI/UX design and implementation skills", "Understanding of real-time data processing"],
    ["Experience with Qt, Electron, or similar frameworks", "Data visualization and charting libraries", "Network programming and communication protocols", "Database integration and management", "Cross-platform development experience"],
    ["Which desktop development frameworks do you prefer?", "How do you approach real-time data visualization?"]),
  position(11, D.groundStation, "RF Specialist", "Design and implement radio frequency systems for rocket telemetry, command, and control. You will work on antenna design, RF link budgets, communication protocols, and ensure reliable wireless communication with our rockets during flight.",
    ["RF engineering and wireless communication knowledge", "Understanding of antenna theory and design", "Experience with RF testing and measurement equipment"],
    ["Amateur radio license (HAM)", "Experience with satellite communication systems", "Knowledge of aerospace communication standards", "RF simulation software experience", "Regulatory compliance (FCC, ETSI) knowledge"],
    ["What RF frequency bands have you worked with?", "Do you hold an amateur radio license?"]),
  position(12, D.hardware, "Hardware Engineer", "Design and develop electronic hardware systems for our rockets, including PCB design, component selection, and system integration. You will create robust electronics that can withstand the harsh environment of rocket flight while providing critical functionality.",
    ["PCB design and electronic circuit development", "Component selection and system integration", "Understanding of electrical engineering principles"],
    ["Experience with high-reliability electronics design", "Knowledge of aerospace-grade components", "EMI/EMC testing and compliance", "Thermal management and environmental testing", "Version control for hardware design"],
    ["What PCB design software do you use?", "Describe your experience with environmental testing of electronics"]),
  position(13, D.flightControl, "Control System Engineer", "Develop flight control systems and algorithms for rocket guidance, navigation, and control. You will design control algorithms, implement stability systems, and ensure precise rocket flight performance through advanced control theory applications.",
    ["Control systems engineering knowledge", "Mathematical modeling and simulation skills", "Understanding of guidance and navigation principles"],
    ["Experience with aerospace control systems", "MATLAB/Simulink proficiency", "Kalman filtering and state estimation", "PID and advanced control algorithms", "Real-time control system implementation"],
    ["What control theory concepts are you most experienced with?", "Describe your experience with flight control systems"]),
  position(14, D.recoverySystems, "Recovery Engineer", "Design and implement recovery systems for safe rocket retrieval after flight. You will work on parachute systems, recovery electronics, landing predictions, and ensure successful rocket recovery for reuse and data collection.",
    ["Understanding of parachute and recovery system design", "Knowledge of aerodynamics and flight mechanics", "Experience with mechanical design and analysis"],
    ["Aerospace engineering background", "Experience with recovery system testing", "Simulation and modeling software proficiency", "Understanding of materials and textiles", "Safety and reliability analysis experience"],
    ["What types of recovery systems have you worked with?", "How do you approach recovery system reliability and safety?"]),
  position(15, D.missionAnalysis, "Mission Analyst", "Analyze mission requirements, trajectory optimization, and flight performance for our rocket projects. You will conduct mission planning, performance analysis, and provide critical insights for successful rocket missions through detailed analytical work.",
    ["Mission analysis and trajectory optimization skills", "Mathematical modeling and simulation experience", "Understanding of rocket performance and flight mechanics"],
    ["Aerospace engineering background", "Experience with mission planning software", "Knowledge of orbital mechanics", "Statistical analysis and data interpretation", "Technical report writing and presentation skills"],
    ["What mission analysis tools are you familiar with?", "Describe your experience with trajectory optimization"]),
  position(16, D.missionAnalysis, "Software Engineer", "Develop software tools for mission analysis, flight simulation, and data processing. You will create computational tools for trajectory analysis, performance optimization, and mission planning to support our rocket development efforts.",
    ["Strong programming skills in Python, MATLAB, or similar", "Understanding of numerical methods and computational analysis", "Experience with scientific computing and data analysis"],
    ["Aerospace or scientific software development experience", "Knowledge of simulation and modeling frameworks", "Database design and management", "Version control and collaborative development", "Technical documentation and code quality practices"],
    ["What programming languages do you use for scientific computing?", "Describe your experience with simulation software development"]),
  position(17, D.designManufacturing, "Design & Additive Manufacturing Engineer", "Lead the design and 3D printing/additive manufacturing of rocket components. You will optimize designs for additive manufacturing, operate 3D printing equipment, and ensure high-quality production of custom rocket parts.",
    ["CAD design and 3D modeling experience", "Understanding of additive manufacturing processes", "Knowledge of materials and manufacturing constraints"],
    ["Experience with aerospace component design", "Multiple 3D printing technologies (SLA, SLS, FDM)", "Design for manufacturing (DfM) principles", "Quality control and testing procedures", "Materials science and selection knowledge"],
    ["What CAD software do you use for design?", "Which additive manufacturing technologies have you worked with?"]),
  position(18, D.structuralAnalysis, "Structural Engineer", "Perform structural analysis and design for rocket components and systems. You will conduct finite element analysis, validate structural integrity, and ensure our rockets can withstand the mechanical stresses of flight and operations.",
    ["Structural analysis and finite element method (FEM) experience", "Understanding of mechanics of materials and structural design", "Knowledge of aerospace structures and loading conditions"],
    ["Experience with aerospace structural analysis", "Proficiency in ANSYS, Abaqus, or similar FEA software", "Composite materials and advanced structures knowledge", "Fatigue and fracture mechanics understanding", "Structural testing and validation experience"],
    ["What FEA software do you use for structural analysis?", "Describe your experience with aerospace structures"]),
  position(19, D.liquidSystems, "Feed System Engineer", "Design and develop propellant feed systems for liquid rocket engines. You will work on pumps, valves, plumbing, and fluid systems that deliver propellants to the combustion chamber with precision and reliability.",
    ["Fluid mechanics and thermodynamics knowledge", "Understanding of pumps, valves, and fluid systems", "Experience with pressure systems and fluid flow analysis"],
    ["Rocket propulsion and liquid rocket engine experience", "CFD analysis and simulation skills", "High-pressure system design and safety", "Materials compatibility with propellants", "Testing and validation of fluid systems"],
    ["What experience do you have with fluid systems design?", "Describe your knowledge of rocket propellant handling"]),
  position(20, D.testBench, "Test Engineer", "Lead testing operations for liquid rocket engine systems. You will plan test procedures, operate test equipment, collect and analyze test data, and ensure safe execution of propulsion system testing.",
    ["Experience with test planning and execution", "Understanding of instrumentation and data acquisition", "Knowledge of safety procedures for hazardous testing"],
    ["Rocket propulsion testing experience", "High-pressure and cryogenic system testing", "Data analysis and statistical methods", "Test automation and control systems", "Regulatory compliance and safety standards"],
    ["What types of propulsion testing have you been involved with?", "How do you ensure safety during hazardous testing operations?"]),
  position(21, D.thrustChamber, "Test Engineer", "Develop and execute testing procedures for thrust chamber assemblies and combustion systems. You will design test setups, monitor combustion performance, and analyze test results to optimize engine performance.",
    ["Combustion testing and analysis experience", "Understanding of test instrumentation and data collection", "Knowledge of high-temperature and high-pressure testing"],
    ["Rocket engine testing experience", "Combustion diagnostics and measurement techniques", "Heat transfer and thermal analysis", "Materials testing at extreme conditions", "Statistical analysis and test data interpretation"],
    ["Describe your experience with combustion testing", "What diagnostic techniques have you used for engine testing?"]),
  position(22, D.thrustChamber, "Propulsion Engineer", "Design and develop thrust chamber assemblies for liquid rocket engines. You will work on combustion chamber design, nozzle optimization, cooling systems, and overall engine performance to achieve maximum efficiency and reliability.",
    ["Rocket propulsion and combustion theory knowledge", "Understanding of thermodynamics and fluid mechanics", "Experience with combustion chamber and nozzle design"],
    ["Liquid rocket engine development experience", "CFD analysis for combustion and nozzle flow", "Heat transfer and cooling system design", "Materials selection for high-temperature applications", "Performance optimization and analysis"],
    ["What is your experience with rocket engine design?", "Describe your knowledge of combustion chamber cooling methods"]),
  {
    id: 23,
    status: false,
    divisionId: D.liquidSystems,
    title: "Feed Systems Engineer",
    description: "Design the propellant feed lines of the first liquid engine with the Liquid System Architecture division.",
    requiredSkills: ["Fluid mechanics fundamentals"],
    desirableSkills: ["Experience with pressure systems"],
    customQuestions: [],
    createdAt: "2022-09-01 10:00:00+02",
  },
]);

/** What each position's applicants answered, in the order of its questions. */
const ANSWERS: Readonly<Record<number, readonly string[]>> = {
  1: ["I have 2 years of experience with React and Vue, building responsive web applications", "I primarily use useState, useEffect, useContext, and custom hooks for API calls"],
  2: ["I primarily use Adobe Creative Suite - Photoshop, Illustrator, and InDesign for most of my design work", "I have created technical diagrams for engineering documentation and infographic-style explanations of complex systems"],
  3: ["I work with Canon DSLR cameras, various lenses, drones for aerial photography, and professional lighting equipment", "Yes, I have documented manufacturing processes and created educational videos for engineering projects"],
  4: ["I have managed Instagram, LinkedIn, Twitter, and YouTube channels for tech companies and personal brands", "I track engagement rates, reach, conversions, and community growth, using analytics tools to optimize content strategy"],
  5: ["I have secured sponsorships for student organizations and helped establish corporate partnerships for tech events", "I maintain regular communication, provide detailed ROI reports, and ensure sponsors receive agreed-upon recognition and benefits"],
  6: ["I have organized technical conferences, product launches, and educational workshops for 50-200 attendees", "I use project management tools, create detailed timelines, and maintain vendor relationships for smooth execution"],
  7: ["Yes, I have coordinated testing for electronic systems and managed equipment calibration procedures", "I follow strict protocols, maintain clear communication, and ensure all team members are trained on safety procedures"],
  8: ["I hold OSHA 30-Hour certification and have completed specialized training in chemical and laboratory safety", "I conduct systematic hazard identification, probability analysis, and implement layered control measures to minimize risks"],
  9: ["I have experience with Arduino, STM32 microcontrollers, and Raspberry Pi for various embedded projects", "I have developed time-critical control systems using FreeRTOS and implemented interrupt-driven sensor interfaces"],
  10: ["I prefer Qt for cross-platform applications and have experience with Electron for web-based desktop apps", "I use efficient charting libraries, implement data buffering, and optimize rendering for smooth real-time updates"],
  11: ["I have experience with UHF/VHF bands for telemetry and 2.4GHz/5.8GHz for high-bandwidth data transmission", "Yes, I hold a General class amateur radio license and have experience with packet radio and digital modes"],
  12: ["I primarily use Altium Designer and have experience with KiCad for open-source projects", "I have conducted thermal cycling, vibration testing, and EMI/EMC compliance testing for aerospace applications"],
  13: ["I have strong experience with PID control, state-space methods, and Kalman filtering for estimation and control", "I have simulated and implemented autopilot systems for UAVs, including attitude control and trajectory following"],
  14: ["I have designed and tested parachute recovery systems for model rockets and high-altitude balloon payloads", "I implement redundant deployment mechanisms, conduct extensive ground testing, and use simulation for failure analysis"],
  15: ["I have experience with MATLAB/Simulink for trajectory analysis and STK for mission planning and visualization", "I have implemented optimal control algorithms for minimum-energy trajectories and constrained flight paths"],
  16: ["I primarily use Python with NumPy/SciPy, MATLAB for prototyping, and C++ for performance-critical applications", "I have developed Monte Carlo simulations for mission analysis and physics-based models for system dynamics"],
  17: ["I use SolidWorks for mechanical design and Fusion 360 for integrated CAD/CAM workflows", "I have experience with FDM, SLA, and SLS printing, optimizing designs for each technology constraints"],
  18: ["I primarily use ANSYS Mechanical and have experience with Abaqus for complex nonlinear analysis", "I have analyzed composite panels, pressure vessels, and vibration-sensitive structures for aerospace applications"],
  19: ["I have designed hydraulic systems and worked with high-pressure plumbing for industrial applications", "I understand the safety requirements for handling cryogenic and hypergolic propellants, including containment systems"],
  20: ["I have participated in solid rocket motor testing and have experience with test stand instrumentation", "I follow established safety protocols, maintain clear communication, and ensure proper emergency procedures are in place"],
  21: ["I have conducted combustion experiments in laboratory settings and analyzed flame characteristics and heat transfer", "I have used pressure transducers, thermocouples, and high-speed cameras for combustion diagnostics"],
};

function answersTo(positionId: number, answers: readonly string[] = ANSWERS[positionId] ?? []) {
  const questions = POSITION_ROWS.rows.find((p) => p.id === positionId)?.customQuestions ?? [];
  return questions.map((question, i) => ({ question, answer: answers[i] ?? "" }));
}

type Application = typeof applications.$inferInsert;

/** One application; its answers are the position's questions with ANSWERS. */
function application(
  id: number,
  applyPositionId: number,
  userId: string,
  appliedAt: string,
  status: NonNullable<Application["status"]>,
  more: Partial<Application> = {},
): Application {
  const first = userId.slice(0, 4);
  return {
    id,
    applyPositionId,
    userId,
    mlName: `ml-${first}-${applyPositionId}.pdf`,
    cvName: `cv-${first}-${applyPositionId}.pdf`,
    appliedAt,
    status,
    customAnswers: answersTo(applyPositionId),
    ...more,
  };
}

/** The applicant who joined the team through position 23: member 32, an invented Feed Systems Engineer who left in 2023–24. */
export const JOINED_APPLICANT = "1c111111-1111-1111-1111-111111111111";

/** Where each application stands, named for the case it holds. */
export const APPLICATION = {
  ndaArrived: 1,
  inReview: 2,
  waitingForNda: 3,
  new: 4,
  timesOffered: 5,
  booked: 6,
  rejected: 9,
  withdrawn: 11,
  takenByAnotherTeam: 12,
  joined: 23,
  applicantSeatTimesOffered: 24,
  applicantSeatNew: 25,
} as const;

/** The applicant plain seat (lib/seeded-accounts.ts): an invented applicant who holds applications 24 and 25. */
export const APPLICANT_SEAT = seatOf("non-member").id;

const APPLICATIONS: readonly Application[] = [
  application(APPLICATION.ndaArrived, 1, "dddddddd-dddd-dddd-dddd-dddddddddddd", "2026-09-05 16:45:00+02", "accepted", {
    acceptedAt: "2026-10-05 11:00:00+02",
    ndaArrivedAt: "2026-10-08 09:30:00+02",
  }),
  application(APPLICATION.inReview, 2, "f1111111-1111-1111-1111-111111111111", "2026-09-10 14:30:00+02", "pending"),
  application(APPLICATION.waitingForNda, 3, "f2222222-2222-2222-2222-222222222222", "2026-09-11 09:15:00+02", "accepted", {
    acceptedAt: "2026-10-06 17:00:00+02",
  }),
  application(APPLICATION.new, 4, "f3333333-3333-3333-3333-333333333333", "2026-10-12 11:20:00+02", "received"),
  {
    ...application(APPLICATION.timesOffered, 1, "f4444444-4444-4444-4444-444444444444", "2026-09-12 16:45:00+02", "interview"),
    customAnswers: answersTo(1, [
      "I have 3 years of experience with React and Next.js, building scalable web applications with TypeScript",
      "Mostly useState and useEffect, with useMemo for derived data and a few custom hooks for data fetching",
    ]),
  },
  application(APPLICATION.booked, 5, "f5555555-5555-5555-5555-555555555555", "2026-09-13 10:30:00+02", "interview"),
  application(7, 6, "f6666666-6666-6666-6666-666666666666", "2026-10-13 13:45:00+02", "received"),
  application(8, 7, "f7777777-7777-7777-7777-777777777777", "2026-09-15 08:20:00+02", "pending"),
  application(APPLICATION.rejected, 8, "f8888888-8888-8888-8888-888888888888", "2026-09-16 14:15:00+02", "rejected", {
    rejectedAt: "2026-10-02 12:00:00+02",
  }),
  application(10, 9, "f9999999-9999-9999-9999-999999999999", "2026-10-14 11:30:00+02", "received"),
  application(APPLICATION.withdrawn, 10, "1d111111-1111-1111-1111-111111111111", "2026-09-18 09:45:00+02", "pending", {
    withdrawnAt: "2026-09-30 20:10:00+02",
  }),
  application(APPLICATION.takenByAnotherTeam, 11, "1d222222-2222-2222-2222-222222222222", "2026-09-19 15:20:00+02", "accepted_by_another_team", {
    rejectedAt: "2026-10-03 10:00:00+02",
  }),
  application(13, 12, "1d333333-3333-3333-3333-333333333333", "2026-10-14 12:10:00+02", "received"),
  application(14, 13, "1d444444-4444-4444-4444-444444444444", "2026-03-17 10:25:00+01", "rejected", {
    rejectedAt: "2026-04-10 09:00:00+02",
  }),
  application(15, 14, "1d555555-5555-5555-5555-555555555555", "2026-09-22 14:40:00+02", "interview"),
  application(16, 15, "1d666666-6666-6666-6666-666666666666", "2026-10-15 11:15:00+02", "received"),
  application(17, 16, "1d777777-7777-7777-7777-777777777777", "2026-09-24 09:30:00+02", "pending"),
  application(18, 17, "1d888888-8888-8888-8888-888888888888", "2026-09-25 13:50:00+02", "pending"),
  application(19, 18, "1d999999-9999-9999-9999-999999999999", "2026-03-22 16:20:00+01", "rejected", {
    rejectedAt: "2026-04-12 09:00:00+02",
  }),
  application(20, 19, "1e111111-1111-1111-1111-111111111111", "2026-10-15 10:05:00+02", "received"),
  application(21, 20, "1e222222-2222-2222-2222-222222222222", "2026-09-28 12:35:00+02", "interview"),
  application(22, 21, "1e333333-3333-3333-3333-333333333333", "2026-10-16 08:45:00+02", "received"),
  application(APPLICATION.joined, 23, JOINED_APPLICANT, "2022-09-10 18:00:00+02", "joined", {
    acceptedAt: "2022-09-25 10:00:00+02",
    ndaArrivedAt: "2022-10-01 10:00:00+02",
    joinedAt: "2022-10-05 10:00:00+02",
  }),
  // The applicant plain seat (issues #129, #653): times to pick from, and one not opened yet.
  {
    ...application(APPLICATION.applicantSeatTimesOffered, 15, APPLICANT_SEAT, "2026-09-20 18:00:00+02", "interview"),
    customAnswers: answersTo(15, [
      "MATLAB and a little GMAT, from a university course on orbital mechanics",
      "I tuned an ascent trajectory with a genetic algorithm for a course project",
    ]),
  },
  {
    ...application(APPLICATION.applicantSeatNew, 2, APPLICANT_SEAT, "2026-10-14 21:00:00+02", "received"),
    customAnswers: answersTo(2, [
      "Figma and Illustrator for most work, Blender for the occasional render",
      "Only exploded views for a robotics club so far",
    ]),
  },
];

// Every application's CV and motivation letter (issue #406, owner decision of
// 2026-10-19): one shared sample PDF in the private store, at one fixed
// pathname, and the one `application_files` row that names it. The preview
// build uploads the PDF once (db/preview-build.ts); every seeded application
// points both its documents at that row, so the document route streams it from
// the store like a real file. A file row's pathname is unique, so the
// applications share the row rather than each holding a copy of it. The row
// has no owner, so deleting one applicant's account never deletes it; the
// withdrawn-files cleanup keeps a row another live application still holds.

/** The shared sample document: where the preview build stores it, and its bytes. */
export const SEED_SAMPLE_DOCUMENT = {
  pathname: privatePathname("application", "seed-sample.pdf"),
  bytes: samplePdf("Sample document", [
    "Every seeded application opens this file as its CV and its motivation letter.",
    "It is preview data only: no applicant sent it.",
  ]),
} as const;

const SAMPLE_FILE_ID = 1;

export const APPLICATION_FILE_ROWS = rowsOf(applicationFiles, [
  {
    id: SAMPLE_FILE_ID,
    pathname: SEED_SAMPLE_DOCUMENT.pathname,
    originalFilename: "sample-document.pdf",
    mimeType: "application/pdf",
    fileSize: SEED_SAMPLE_DOCUMENT.bytes.length,
    uploadedAt: "2026-09-01 09:00:00+02",
    userId: null,
  },
]);

export const APPLICATION_ROWS = rowsOf(
  applications,
  APPLICATIONS.map((app) => ({ ...app, cvFileId: SAMPLE_FILE_ID, coverLetterFileId: SAMPLE_FILE_ID })),
);

/** One interview time: an hour from `start`, offered when the lead moved the application to interview. */
function slot(id: number, applicationId: number, start: string, offeredAt: string, chosenAt: string | null = null) {
  const end = new Date(Date.parse(start) + 60 * 60_000).toISOString();
  return {
    id,
    applicationId,
    startsAt: new Date(start).toISOString(),
    endsAt: end,
    chosen: chosenAt !== null,
    chosenAt,
    createdAt: offeredAt,
  };
}

export const SLOT_ROWS = rowsOf(interviewSlots, [
  // Times offered, none picked yet.
  slot(1, APPLICATION.timesOffered, "2026-10-21T16:00:00+02:00", "2026-10-14 10:00:00+02"),
  slot(2, APPLICATION.timesOffered, "2026-10-22T17:00:00+02:00", "2026-10-14 10:00:00+02"),
  // The applicant booked the second time.
  slot(3, APPLICATION.booked, "2026-10-20T15:00:00+02:00", "2026-10-09 12:00:00+02"),
  slot(4, APPLICATION.booked, "2026-10-23T15:00:00+02:00", "2026-10-09 12:00:00+02", "2026-10-10 08:30:00+02"),
  slot(5, 15, "2026-10-27T18:00:00+01:00", "2026-10-15 09:00:00+02"),
  slot(6, 21, "2026-10-28T18:00:00+01:00", "2026-10-15 09:30:00+02", "2026-10-15 20:00:00+02"),
  slot(7, APPLICATION.applicantSeatTimesOffered, "2026-10-29T17:00:00+01:00", "2026-10-15 11:00:00+02"),
  slot(8, APPLICATION.applicantSeatTimesOffered, "2026-10-30T17:00:00+01:00", "2026-10-15 11:00:00+02"),
]);

/** Recruitment is on: the open positions show on /apply. */
export const RECRUITMENT_SETTING_ROWS = rowsOf(recruitmentSetting, [
  { id: true, isOpen: true, updatedAt: "2026-09-01 09:00:00+02" },
]);

export const recruitmentSeed = tableSeedModule({
  name: "recruitment",
  owns: [applyPositions, applicationFiles, applications, interviewSlots, recruitmentSetting],
  rows: [POSITION_ROWS, APPLICATION_FILE_ROWS, APPLICATION_ROWS, SLOT_ROWS, RECRUITMENT_SETTING_ROWS],
});
