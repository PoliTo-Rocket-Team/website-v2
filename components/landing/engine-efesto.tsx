"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import type { WeatherUniforms } from "./hero-weathering";
import { INK, PAPER, unitRing, useLines } from "./rocket-placeholder";
import { lathe } from "./rocket-parts";

// Efesto's model (issue #382): a liquid rocket engine, not a rocket, because
// Efesto is an engine that has not flown. It is drawn in the outline
// placeholder's pen look (rocket-placeholder.tsx, issue #360): a flat, unlit
// paper fill and ink lines on the silhouette and the hard edges, with the
// placeholder's own pen. Top to bottom: the oxidizer inlet, the injector
// head on its bolted flange, the combustion chamber, the nozzle's throat and
// bell, and the fuel feed line that runs from the cooling manifold on the
// bell up to the injector.
//
// It is no measured drawing: the shapes are a generic pressure-fed engine in
// engine units, nozzle exit at y=0 and inlet top at y=TOP, axis along +Y.
// Like every model it takes `{ weather, length }` and lies along +X, inlet at
// +X, so any stage draws it in the rockets' pose. An engine is far stouter
// than a rocket, so it does not fill the rocket's length: it takes
// LENGTH_SHARE of it, centred CENTRE_SHIFT of it toward the nose end, where
// the card stage frames the rockets from the nose to mid-body
// (rocket-card-3d.tsx). It never turns itself: a card turns it about its
// axis while hovered, as it turns every model (issue #385).

const TOP = 1.02;

// Nozzle: a bell from the exit up to the throat, then the converging cone to
// the chamber.
const EXIT_R = 0.2;
const THROAT_Y = 0.34;
const THROAT_R = 0.075;
const CHAMBER_Y = 0.47; // where the cone meets the chamber
const CHAMBER_R = 0.13;

// The injector flange the head bolts onto, and the head with its dome.
const FLANGE_Y0 = 0.775;
const FLANGE_Y1 = 0.81;
const FLANGE_R = 0.165;
const HEAD_R = 0.125;
const HEAD_TOP = 0.89; // where the dome starts
const DOME_TOP = 0.95;
const DOME_R = 0.06; // the flat top's radius

// The oxidizer inlet on the dome, a stub with a flange.
const INLET_R = 0.03;
const INLET_FLANGE_Y = 1.0;
const INLET_FLANGE_R = 0.045;

// The fuel line: from the cooling manifold on the bell out, up past the
// chamber and back in to the head, on one side (-X), so the turn shows.
const MANIFOLD_Y = 0.22;
const MANIFOLD_R = 0.153; // the bell is 0.141 there
const MANIFOLD_TUBE = 0.022;
const LINE_R = 0.018;
const LINE_OUT = 0.26; // how far off the axis the line runs
const LINE_TOP = 0.86;

const BOLTS = 12;
const BOLT_RING = 0.146;

/** The engine's share of the rocket length a stage hands it, and where its middle sits. */
const LENGTH_SHARE = 0.6;
const CENTRE_SHIFT = 0.19;

/** The bell, the cone, the chamber, the flange and the head, as one closed lathe profile. */
function bodyProfile(): [number, number][] {
  const rows: [number, number][] = [];
  // Bell: steep at the throat, near axial at the exit.
  for (let i = 0; i <= 24; i++) {
    const y = (i / 24) * THROAT_Y;
    const t = 1 - y / THROAT_Y;
    rows.push([y, THROAT_R + (EXIT_R - THROAT_R) * Math.sin((t * Math.PI) / 2)]);
  }
  // Cone, eased in and out so the throat and the chamber read as curves.
  for (let i = 1; i <= 12; i++) {
    const s = i / 12;
    rows.push([THROAT_Y + s * (CHAMBER_Y - THROAT_Y), THROAT_R + ((CHAMBER_R - THROAT_R) * (1 - Math.cos(s * Math.PI))) / 2]);
  }
  rows.push(
    [FLANGE_Y0, CHAMBER_R],
    [FLANGE_Y0, FLANGE_R],
    [FLANGE_Y1, FLANGE_R],
    [FLANGE_Y1, HEAD_R],
    [HEAD_TOP, HEAD_R],
  );
  // Dome: a quarter ellipse from the head's side to its flat top.
  for (let i = 1; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2);
    rows.push([HEAD_TOP + (DOME_TOP - HEAD_TOP) * Math.sin(a), DOME_R + (HEAD_R - DOME_R) * Math.cos(a)]);
  }
  rows.push([DOME_TOP, 0]);
  return rows;
}

function inletProfile(): [number, number][] {
  return [
    [DOME_TOP - 0.01, INLET_R],
    [INLET_FLANGE_Y, INLET_R],
    [INLET_FLANGE_Y, INLET_FLANGE_R],
    [TOP, INLET_FLANGE_R],
    [TOP, 0],
  ];
}

/** The fuel line's centre line, in the y-up engine frame, on the -X side. */
function linePath(): THREE.CurvePath<THREE.Vector3> {
  const at = (r: number, y: number) => new THREE.Vector3(-r, y, 0);
  const bend = 0.06;
  const path = new THREE.CurvePath<THREE.Vector3>();
  path.add(new THREE.LineCurve3(at(MANIFOLD_R - 0.01, MANIFOLD_Y), at(LINE_OUT - bend, MANIFOLD_Y)));
  path.add(new THREE.QuadraticBezierCurve3(at(LINE_OUT - bend, MANIFOLD_Y), at(LINE_OUT, MANIFOLD_Y), at(LINE_OUT, MANIFOLD_Y + bend)));
  path.add(new THREE.LineCurve3(at(LINE_OUT, MANIFOLD_Y + bend), at(LINE_OUT, LINE_TOP - bend)));
  path.add(new THREE.QuadraticBezierCurve3(at(LINE_OUT, LINE_TOP - bend), at(LINE_OUT, LINE_TOP), at(LINE_OUT - bend, LINE_TOP)));
  path.add(new THREE.LineCurve3(at(LINE_OUT - bend, LINE_TOP), at(HEAD_R - 0.01, LINE_TOP)));
  return path;
}

// The hard edges inside the silhouette, inked as rings a hair outside the
// skin: the nozzle's mouth, the cone's shoulder, the flange's two edges and
// the head's shoulder.
const RIMS: { y: number; r: number }[] = [
  { y: 0, r: EXIT_R },
  { y: CHAMBER_Y, r: CHAMBER_R },
  { y: FLANGE_Y0, r: FLANGE_R },
  { y: FLANGE_Y1, r: FLANGE_R },
  { y: HEAD_TOP, r: HEAD_R },
].map(({ y, r }) => ({ y, r: r * 1.008 }));

function buildGeometry() {
  const bolt = new THREE.CylinderGeometry(0.009, 0.009, 0.014, 12);
  bolt.translate(0, FLANGE_Y1 + 0.007, 0);
  const manifold = new THREE.TorusGeometry(MANIFOLD_R, MANIFOLD_TUBE, 16, 96);
  manifold.rotateX(Math.PI / 2);
  manifold.translate(0, MANIFOLD_Y, 0);
  const mouth = new THREE.CircleGeometry(EXIT_R, 96);
  mouth.rotateX(Math.PI / 2);
  return {
    body: lathe(bodyProfile(), 128, TOP),
    inlet: lathe(inletProfile(), 48, TOP),
    manifold,
    line: new THREE.TubeGeometry(linePath(), 96, LINE_R, 16, false),
    bolt,
    mouth,
    rim: unitRing(96),
  };
}

// Built once per page, as the placeholder's parts are. The fill and the ink
// are unlit and skip tone mapping, so they land exactly on the brand colours.
let shared: {
  geo: ReturnType<typeof buildGeometry>;
  paper: THREE.MeshBasicMaterial;
  ink: THREE.MeshBasicMaterial;
} | null = null;
function engineParts() {
  return (shared ??= {
    geo: buildGeometry(),
    paper: new THREE.MeshBasicMaterial({ color: PAPER, toneMapped: false }),
    ink: new THREE.MeshBasicMaterial({ color: INK, toneMapped: false, side: THREE.DoubleSide }),
  });
}

export default function EfestoBuilt({ length }: { weather: WeatherUniforms; length: number }) {
  const { geo, paper, ink } = engineParts();
  const lines = useLines();
  // Line widths are in pixels, so scaling a ring changes its radius only.
  const rims = useMemo(
    () =>
      RIMS.map(({ y, r }) => {
        const line = new LineSegments2(geo.rim, lines.rim);
        line.position.y = y;
        line.scale.setScalar(r);
        return line;
      }),
    [geo, lines],
  );

  const scale = (length * LENGTH_SHARE) / TOP;
  // Each part twice: its paper fill, then its ink hull.
  const part = (key: string, g: THREE.BufferGeometry) => [
    <mesh key={`${key}-fill`} geometry={g} material={paper} />,
    <mesh key={`${key}-ink`} geometry={g} material={lines.outline} />,
  ];
  return (
    <group rotation-z={-Math.PI / 2} scale={scale}>
      <group position-y={(length * CENTRE_SHIFT) / scale - TOP / 2}>
        {part("body", geo.body)}
        {part("inlet", geo.inlet)}
        {part("manifold", geo.manifold)}
        {part("line", geo.line)}
        {rims.map((line) => (
          <primitive key={line.position.y} object={line} />
        ))}
        {/* the nozzle's mouth is a hole, so it is inked solid, as a pen drawing fills one */}
        <mesh geometry={geo.mouth} material={ink} position-y={0.001} />
        {Array.from({ length: BOLTS }, (_, k) => {
          const a = ((k + 0.5) / BOLTS) * Math.PI * 2;
          return (
            <mesh
              key={k}
              geometry={geo.bolt}
              material={ink}
              position={[Math.cos(a) * BOLT_RING, 0, Math.sin(a) * BOLT_RING]}
            />
          );
        })}
      </group>
    </group>
  );
}
