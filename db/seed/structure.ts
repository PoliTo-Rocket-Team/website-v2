// The structure seed (issue #304): every department and division. Ids 1–8
// and 1–17 keep the numbers the old SQL seed used. Division 18 is closed and
// kept as a name; division 19 is open with nobody in it.

import { departments, divisions } from "@/db/schema";
import { rowsOf, tableSeedModule } from "./rows";

export const DEPARTMENT = {
  propulsion: 1,
  structures: 2,
  aerodynamics: 3,
  recovery: 4,
  controls: 5,
  electronics: 6,
  operations: 7,
  research: 8,
} as const;

export const DIVISION = {
  testBench: 1,
  liquidSystems: 2,
  thrustChamber: 3,
  designManufacturing: 4,
  structuralAnalysis: 5,
  missionAnalysis: 6,
  optimization: 7,
  flightControl: 8,
  engineControl: 9,
  groundStation: 10,
  firmware: 11,
  hardware: 12,
  recovery: 13,
  safety: 14,
  logistics: 15,
  communications: 16,
  informationTechnology: 17,
  /** Closed: its people's roles ended when it closed; it stays as a name. */
  hybridMotors: 18,
  /** Open, and nobody holds a role in it. */
  payload: 19,
} as const;

export const DEPARTMENT_ROWS = rowsOf(departments, [
  { id: DEPARTMENT.propulsion, name: "Propulsion", startedAt: "2021-10-01", closedAt: null, code: "PRO" },
  { id: DEPARTMENT.structures, name: "Structures", startedAt: "2021-10-01", closedAt: null, code: "STR" },
  { id: DEPARTMENT.aerodynamics, name: "Aerodynamics", startedAt: "2022-05-01", closedAt: null, code: "AER" },
  { id: DEPARTMENT.recovery, name: "Recovery", startedAt: "2022-06-01", closedAt: null, code: "RCV" },
  { id: DEPARTMENT.controls, name: "Controls and Systems", startedAt: "2022-05-01", closedAt: null, code: "CAS" },
  { id: DEPARTMENT.electronics, name: "Electronics", startedAt: "2022-04-01", closedAt: null, code: "ELT" },
  // Operations sits on the Team page's "Operations" slide; the rest keep the default kind, technical (issue #325).
  { id: DEPARTMENT.operations, name: "Operations", startedAt: "2021-10-01", closedAt: null, code: "OPS", kind: "operations" },
  { id: DEPARTMENT.research, name: "Research and Development", startedAt: "2023-09-01", closedAt: null, code: "RND" },
]);

export const DIVISION_ROWS = rowsOf(divisions, [
  { id: DIVISION.testBench, deptId: DEPARTMENT.propulsion, name: "Test Bench", startedAt: "2022-09-01", closedAt: null, code: "TBE" },
  { id: DIVISION.liquidSystems, deptId: DEPARTMENT.propulsion, name: "Liquid Systems Architecture", startedAt: "2021-10-01", closedAt: null, code: "LSA" },
  { id: DIVISION.thrustChamber, deptId: DEPARTMENT.propulsion, name: "Thrust Chamber Assembly", startedAt: "2022-09-01", closedAt: null, code: "TCA" },
  { id: DIVISION.designManufacturing, deptId: DEPARTMENT.structures, name: "Design and Manufacturing", startedAt: "2021-10-01", closedAt: null, code: "DAM" },
  { id: DIVISION.structuralAnalysis, deptId: DEPARTMENT.structures, name: "Structural Analysis", startedAt: "2022-09-01", closedAt: null, code: "SAN" },
  { id: DIVISION.missionAnalysis, deptId: DEPARTMENT.aerodynamics, name: "Mission Analysis", startedAt: "2022-09-01", closedAt: null, code: "MSA" },
  { id: DIVISION.optimization, deptId: DEPARTMENT.aerodynamics, name: "Optimization and Analysis", startedAt: "2022-09-01", closedAt: null, code: "AOA" },
  { id: DIVISION.flightControl, deptId: DEPARTMENT.controls, name: "Flight Control Systems", startedAt: "2022-09-01", closedAt: null, code: "FCS" },
  { id: DIVISION.engineControl, deptId: DEPARTMENT.controls, name: "Engine Control & Systems", startedAt: "2022-09-01", closedAt: null, code: "ECS" },
  { id: DIVISION.groundStation, deptId: DEPARTMENT.electronics, name: "Ground Station", startedAt: "2022-09-01", closedAt: null, code: "GNS" },
  { id: DIVISION.firmware, deptId: DEPARTMENT.electronics, name: "Firmware", startedAt: "2022-09-01", closedAt: null, code: "FMW" },
  { id: DIVISION.hardware, deptId: DEPARTMENT.electronics, name: "Hardware", startedAt: "2022-09-01", closedAt: null, code: "HDW" },
  { id: DIVISION.recovery, deptId: DEPARTMENT.recovery, name: "Recovery", startedAt: "2022-09-01", closedAt: null, code: "RCV" },
  { id: DIVISION.safety, deptId: DEPARTMENT.operations, name: "Safety", startedAt: "2022-09-01", closedAt: null, code: "SFT" },
  { id: DIVISION.logistics, deptId: DEPARTMENT.operations, name: "Logistics", startedAt: "2022-09-01", closedAt: null, code: "LGS" },
  { id: DIVISION.communications, deptId: DEPARTMENT.operations, name: "Communications", startedAt: "2022-09-01", closedAt: null, code: "CMS" },
  { id: DIVISION.informationTechnology, deptId: DEPARTMENT.operations, name: "Information Technology", startedAt: "2022-09-01", closedAt: null, code: "ITC" },
  { id: DIVISION.hybridMotors, deptId: DEPARTMENT.propulsion, name: "Hybrid Motors", startedAt: "2021-10-01", closedAt: "2023-09-30", code: "HYB" },
  { id: DIVISION.payload, deptId: DEPARTMENT.research, name: "Payload Integration", startedAt: "2025-10-01", closedAt: null, code: "PLI" },
]);

export const structure = tableSeedModule({
  name: "structure",
  owns: [departments, divisions],
  rows: [DEPARTMENT_ROWS, DIVISION_ROWS],
});
