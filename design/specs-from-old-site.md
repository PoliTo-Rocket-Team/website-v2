# Vehicle specs, as published on the current site (pulled 2026-09-19)

Source: https://www.politorocketteam.it/projects/{Cavour,VES,Efesto} and the homepage.
These replace the placeholder guesses in `components/landing/projects.tsx` and board
`yDRL8` 11 (`/projects` index). The old site lists THREE projects, not four: VES Mark I
and Mark II are versions of one project. Efesto is a liquid ENGINE project, not a vehicle.

## Cavour — "the Team's first rocket", Founding Fathers series #1

Named after Camillo Benso, Count of Cavour. Single stage, solid COTS motor, 100 mm
internal diameter, composite airframe, 3D-printed carbon-reinforced internals. Two body
tubes + coupler; motor bay, avionics bay, payload bay, recovery bay, nose cone.
Modular: mounts different motor classes, lengths and diameters.

| Config | CVR 100-75-3 | CVR 100-75-4 | CVR 100-54-6 |
|---|---|---|---|
| Diameter | 104 mm | 104 mm | 104 mm |
| Length | 2167 mm | 2527 mm | (not given) |
| Empty mass | 4.8 kg | 5.1 kg | (not given) |
| Wet mass | 8.4 kg | 9.3 kg | 6.9 kg |
| Payload | 4 kg scientific | 540 g | none |
| Motor | CTI L1350 | CTI L1350 | CTI K940 |
| Liftoff T/W | 13.7 | 12.9 | 15.3 |
| Max thrust | 1672.5 N | 1672.5 N | 1120.8 N |
| Max speed | 320 m/s | 295 m/s | 201 m/s |
| Target apogee | 3000 m | 3000 m | 1500 m |

CVR 100-75-3 is the competition config. Motor class is **L**, not M.

Launches (all 2023):
- **29 Apr 2023, Bavaria, Germany** — test launch, K940 motor (site apogee limit).
  Apogee 1331.2 m, 162.7 m/s (~Mach 0.5), 9.79 G. Main chute early (TD-2 tether).
  Landed 6.9 m/s, intact, reusable.
- **22 Jun 2023, Spaceport America Cup, New Mexico** — pad B2, 09:20 local. Apogee
  3142.8 m AGL (target 3048 m), 295.4 m/s, 17.3 G. Nominal, main chute early, reusable.
  20th overall of 119 universities, 13th in 10k ft COTS category. **Dr. Gil Moore Award
  for Innovation** for "3D-printed multilayered fins for flutter suppression".
  First Italian team at SA Cup.
- **13 Oct 2023, EuRoC, Santa Margarida, Portugal** — 14:45 UTC+1. Apogee ~2800 m,
  266 m/s, 14 G. Recovery failed, hit ground at 75 m/s. **ANACOM "Best Telemetry
  Spectral Signature" Award.** 8th of 25 selected teams. First PoliTo team at EuRoC.

## VES (Vittorio Emanuele II) — Founding Fathers series #2

Named after the first King of Italy. Single stage, solid COTS motor, 130 mm internal
diameter. Goal: SRAD onboard systems — ejection recovery, flight computer, ground
station, airbrakes. A test config flew at ASK 't Harde (Netherlands) with Delft
Aerospace Rocket Engineering a month before EuRoC 2024.

| Version | VES Test Version | VES Mark I | VES Mark II |
|---|---|---|---|
| Year | 2024 | 2023-24 | 2024-25 |
| Diameter | 134 mm | 134 mm | 134 mm |
| Length | (not given) | 3420 mm | 3650 mm |
| Empty mass | (not given) | 21.11 kg | 21.61 kg |
| Wet mass | 23.56 kg | 25.81 kg | 33.39 kg |
| Payload | none | 1 kg | 2 kg |
| Motor | CTI L2375 | CTI M1790 | Aerotech O5500X |
| Liftoff T/W | 10.5 | 6.09 | 20.79 |
| Max thrust | 2798 N | 2022 N | 7552 N |
| Max speed | 180 m/s | 259 m/s | 626.5 m/s (site: Mach 1.8) |
| Max accel | 10.1 G | 8.5 G | 25.3 G |
| Target apogee | 1700 m | 3000 m | 9000 m |

Launches:
- **12 Oct 2024, EuRoC, Portugal — VES Mark I.** 14:19 UTC+1. Apogee ~3160 m,
  259 m/s, 8.5 G. Nominal flight. Drogue shock cord failed, main did not fully inflate,
  rocket split into its two sections (each had its own chute), both recovered. "Minor
  airframe damage but ready for future launches." 6th of 25 European teams, 2nd in
  flight category, 4th of 20 for vehicle quality.
- **13 Jul 2025, IREC, Midland, Texas — VES Mark II.** **Did NOT fly.** CATO on
  ignition: the Aerotech O5500X-PS motor's forward closure epoxy failed (manufacturer
  defect), ejecting the closure and a propellant grain into the rocket. Upper motor
  retention flange and lower body tube damaged; avionics, recovery, chutes, nose cone,
  upper tube all recovered in excellent condition. **1st place "Design and Build
  Quality"**, 16th Technical Report, of 140+ universities. Note: IREC 2025 was in
  Midland, Texas, NOT Spaceport America, New Mexico.

## Efesto — liquid rocket engine (NOT a vehicle)

Started January 2023 after the first general recruitment. "The first Italian
pressure-fed Liquid Rocket Engine." Regeneratively cooled, whole assembly additively
manufactured, copper-based metal matrix composite chamber via Politecnico R&D.

| Spec | Value |
|---|---|
| Oxidizer | Nitrous oxide (N2O) |
| Fuel | Ethanol |
| Cycle | Pressure-fed, regenerative cooling |
| Target thrust | 5 kN |

Five work lines: TCA (Thrust Chamber Assembly), EC (Engine Cycle, in-house tool
"RocketForge"), LSA (Liquid System Architecture), TB (Test Bench), ECS (Engine
Control Strategy). Injector head presented at the 26th ESA PAC Symposium, Luzern,
May 2024. Site says the engine "is being designed to be tested with a new test bench
facility" — no static fire is reported on the old site.

## Timeline (homepage)

- Oct 2021: a group of friends starts designing a sounding rocket.
- 7 Jun 2022: Politecnico officially approves the Team; Project Cavour starts.
- Jan 2023: Project Efesto starts.
- 29 Apr 2023: first Cavour launch (Germany).
- Jun 2023: SA Cup, second Cavour launch.
- Oct 2023: EuRoC, third Cavour launch.
- Oct 2024: EuRoC, VES Mark I.
- Jul 2025: IREC, VES Mark II CATO.

## What this changes in `components/landing/projects.tsx` (placeholders vs real)

| Card | Placeholder | Real |
|---|---|---|
| Cavour motor | Solid · M | Solid · **L** (CTI L1350) |
| Cavour max speed | Mach 0.8 | 320 m/s design, 295 m/s flown (~Mach 0.9) |
| Cavour apogee | 3 050 m | 3143 m flown (3000 m target) |
| VES motor | Solid · M | Solid · M (CTI M1790) — correct |
| VES max speed | Mach 0.9 | 259 m/s (~Mach 0.76) |
| VES desc | "full recovery, reused" | split in two on descent, minor damage |
| VES Mark II status | FLOWN | **never flew** (CATO on pad) |
| VES Mark II motor | Solid · O | Solid · O (Aerotech O5500X) — correct |
| Efesto | "first liquid-fuelled vehicle", Liquid · LOX, target 3000 m, "static fire" | an **engine**, N2O / ethanol, 5 kN, no static fire reported |

Also wrong elsewhere: `latest.tsx` says IREC 2025 was at "Spaceport America, New Mexico".
It was Midland, Texas. The Latest card "VES Mark II static fire complete" is invented.

## Dimensions for building the rockets in code

| | Cavour | VES Mark I | VES Mark II |
|---|---|---|---|
| Diameter | 104 mm | 134 mm | 134 mm |
| Length | 2167 mm | 3420 mm | 3650 mm |
| Length / diameter | 20.8 | 25.5 | 27.2 |

Fin shapes, nose profiles and livery still need a side-on photo per vehicle.
