// The roles the team usually recruits for (board 34b). The /apply page shows
// them, marked "Closed", when few or no positions are open, so it never looks
// empty. They are written here and never read from the database. Titles,
// divisions and codes are board 34b's; the text follows the matching
// position on board 34 and on the old site, rewritten in plain words.

export type PlaceholderRole = {
  department: string;
  title: string;
  division: string;
  code: string;
  description: string;
  required: readonly [string, ...string[]];
  desirable: readonly string[];
};

export const placeholderRoles = [
  {
    department: "Aerodynamics",
    title: "Mission Analyst",
    division: "Mission Analysis",
    code: "AER-MSA-001",
    description:
      "You work with the other divisions to design the geometry of the new rocket, and run the first simulations to check the mission goals are met. You focus on impulse estimates, Monte Carlo simulations and environmental analysis, which give us the data we rely on at launch. After launch, you compare the flight computer data with the simulations. You use MATLAB and Simulink, together with custom Python scripts.",
    required: ["Basic MATLAB and Python", "Basic body and flight dynamics", "Basic LaTeX"],
    desirable: ["The RocketPy library", "Basic aerodynamics"],
  },
  {
    department: "Aerodynamics",
    title: "Flight Simulator Developer",
    division: "Mission Analysis",
    code: "AER-MSA-002",
    description:
      "You improve the team's flight simulators. You model rocket systems such as engines, sensors and controls, and look for efficient algorithms to run them. You also help the mission analysts when they hit software problems.",
    required: ["MATLAB", "Simulink", "Python"],
    desirable: ["LaTeX", "Flight mechanics", "Basic optimization algorithms", "A lower-level programming language"],
  },
  {
    department: "Aerodynamics",
    title: "Aerodynamicist",
    division: "Optimization and Analysis",
    code: "AER-AOA-001",
    description:
      "You design, improve and optimize the rocket's aerodynamic surfaces, mostly with MATLAB and CFD. You work out the forces on the rocket and study how the air flows around it, and now and then you research related topics.",
    required: ["The wish to learn", "Basic fluid dynamics", "Basic programming and MATLAB"],
    desirable: ["CAD and CFD software", "Meshing software"],
  },
  {
    department: "Structures",
    title: "Design & Manufacturing Engineer",
    division: "Design & Manufacturing",
    code: "STR-DAM-001",
    description:
      "You model, design and place each part of the rocket, with both traditional and additive manufacturing in mind. Then you turn the designs into real parts, from high-performance polymers to metals. Last, you lead the final assembly of the rocket, at home and on site at launches and competitions.",
    required: [
      "CAD, such as SolidWorks",
      "Manufacturing methods",
      "The basics of mechanics",
      "Basic machine elements",
    ],
    desirable: [
      "Materials",
      "Topology optimization and generative design",
      "Tolerances and technical drawings",
      "Rendering",
    ],
  },
  {
    department: "Structures",
    title: "Structural Engineer",
    division: "Structures Analysis",
    code: "STR-SAN-001",
    description:
      "You check how strong each part of the rocket is and how it behaves under flight loads. You run FEM simulations, and tests when the results need proof. You also characterize materials, so the models use the real mechanical properties.",
    required: ["Basic structural mechanics", "Basic materials science"],
    desirable: ["Basic FEM software", "Basic MATLAB and SolidWorks", "LaTeX"],
  },
  {
    department: "Recovery",
    title: "Parachutes Engineer",
    division: "Parachutes",
    code: "RCV-PRC-001",
    description:
      "Everything that goes up must come down, ideally without a crater. You develop, make and validate the rocket's parachutes. Every design goes through simulation and ground tests before it flies: FSI simulations, material tests, tower drops and wind tunnel tests. Your goal is to bring the rocket back whole, ready to fly again.",
    required: ["Basic CAD (SolidWorks)", "Intermediate English", "Basic LaTeX", "Google Workspace", "Good manual skills"],
    desirable: [
      "Sewing synthetic fabrics",
      "Parachute aerodynamics and dynamics",
      "FEA, CFD or FSI software",
      "Microcontrollers such as Arduino and Raspberry Pi",
    ],
  },
  {
    department: "Recovery",
    title: "Recovery Systems Engineer",
    division: "Recovery Systems",
    code: "RCV-RES-001",
    description:
      "Everything that goes up must come down, ideally without a crater. You develop and validate the systems that bring the rocket back. Each one goes through ground tests before it flies, from small component tests to full-scale tests of the whole recovery chain.",
    required: ["Basic CAD (SolidWorks)", "Intermediate English", "Basic LaTeX", "Google Workspace", "Good manual skills"],
    desirable: [
      "A firearm license",
      "Experience with gases or explosives",
      "MATLAB and Simulink",
      "Microcontrollers such as Arduino and Raspberry Pi",
    ],
  },
  {
    department: "Controls and Systems",
    title: "Control System Engineer",
    division: "Flight Control Systems",
    code: "CAS-FCS-001",
    description:
      "You develop the algorithms and software that steer the rocket. You design and model its guidance, navigation and control, with a strong focus on reliability and real-time performance. You use simulations to study the flight dynamics, tune the controllers and prove the system is stable before it flies.",
    required: [
      "MATLAB and Simulink",
      "Control theory and flight dynamics",
      "Problem solving",
      "A strong maths background",
      "Intermediate English",
    ],
    desirable: ["Python", "GitHub", "LaTeX"],
  },
  {
    department: "Controls and Systems",
    title: "Systems Engineer",
    division: "Systems Engineering",
    code: "CAS-SYE-001",
    description:
      "You keep the rocket's subsystems working as one: you track the requirements, the interfaces between divisions and the mass and power budgets. You plan the tests that prove the whole vehicle is ready to fly.",
    required: ["An eye for the whole system", "Clear written English"],
    desirable: ["Requirements management", "Risk analysis"],
  },
  {
    department: "Electronics",
    title: "Hardware Engineer",
    division: "Hardware",
    code: "ELT-HDW-001",
    description:
      "You design, prototype and build the core electronics of the rocket, the ground station and the engine. You draw schematics and PCBs, improve our flight computer and telemetry board, and design the engine control board. The work is hands-on: reading datasheets, soldering, testing and debugging, together with the rest of the department.",
    required: [
      "Circuit theory and electronics",
      "Soldering",
      "Basic programming",
      "Basic to intermediate English",
      "Basic LaTeX",
    ],
    desirable: [
      "Microcontrollers",
      "Hardware testing and debugging tools",
      "PCB CAD such as Altium Designer or KiCad",
      "Clear communication across teams",
    ],
  },
  {
    department: "Electronics",
    title: "Firmware Developer",
    division: "Avionics Software",
    code: "ELT-SWD-001",
    description:
      "You write the software that runs on the rocket's flight computer and boards: sensor reading, data logging and the flight logic. You test it on the bench and help bring it up with the hardware engineers.",
    required: ["C or C++", "Basic electronics"],
    desirable: ["Microcontrollers such as STM32", "Git"],
  },
  {
    department: "Operations",
    title: "Graphic Designer",
    division: "Communications",
    code: "OPS-CMS-002",
    description:
      "You design the team's mission patches, logos and uniforms, and help design the look of our rockets. You also design social media posts and the website, together with the photographers, video makers and web developers.",
    required: ["Prototyping and graphics software"],
    desirable: ["An eye for detail and for current design trends"],
  },
  {
    department: "Operations",
    title: "Sponsoring Specialist",
    division: "Logistics",
    code: "OPS-LGS-002",
    description:
      "You find sponsors and look after them, so the team has what its projects need. You set up meetings, negotiate sponsorship agreements and build long partnerships, and you make sure the team keeps its promises to every sponsor.",
    required: ["Clear communication", "Negotiation", "An eye for detail"],
    desirable: ["Microsoft 365", "Google Workspace"],
  },
  {
    department: "Operations",
    title: "Test & Mission Support Specialist",
    division: "Logistics",
    code: "OPS-LGS-004",
    description:
      "You run the logistics of our tests and of our missions abroad at competitions, with safety first at all times. You work closely with the engineers and project managers, so every test and mission runs smoothly.",
    required: ["Clear communication", "Problem solving"],
    desirable: ["Project management", "Risk analysis"],
  },
  {
    department: "Operations",
    title: "Safety Officer",
    division: "Safety",
    code: "OPS-SFT-001",
    description:
      "You own the technical safety of the rocket, from engineering fixes on paper to the final word on the pad. You run the FMECA, fault tree and hazard analyses that find failure points before they reach the launch site, and you turn the rules into real engineering with every subsystem lead.",
    required: ["The drive to master aerospace safety", "Seeing safety as a systems problem, not paperwork"],
    desirable: ["Systems engineering, risk or hazard analysis"],
  },
] as const satisfies readonly PlaceholderRole[];
