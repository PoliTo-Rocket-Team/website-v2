"use client";

import { useLayoutEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { brand } from "@/lib/brand-colors";
import type { WeatherUniforms } from "./hero-weathering";
import { DEG, FIN_THICKNESS_OF_SPAN, finGeometry, lathe, nozzleGeometry, ogive } from "./rocket-parts";

// The placeholder rocket: one generic vehicle every project draws until its
// own model is written in code (issue #296). It is no real vehicle, so no
// number is measured; it is drawn from Cavour's parts and units
// (rocket-cavour.tsx, rocket-parts.ts) so it sits in the same stages at the
// same size: body radius 0.05, tail at y=0, nose pointing +Y, laid along +X
// by the holder at the bottom. It carries no name, flag or logo, because it
// stands in for any project.
//
// Its look is a pen drawing, so it reads as "model coming" and not as a
// vehicle the team built (issue #360): a flat, unlit paper fill and ink
// lines on the silhouette and the hard edges, with no paint, shading or
// weathering. Only Cavour's shapes are shared; its materials are not used.

const R = 0.05; // body radius, as Cavour
const NOSE_START = 0.62; // where the body tube ends
const NOSE_LENGTH = 0.28; // a tangent ogive, 5.6 calibres
const TIP = NOSE_START + NOSE_LENGTH;

// Fin plate outline in (radial, axial): a clipped delta, root buried 0.8 mm
// inside the skin, tip trailing 15 mm past the tail. Four at 45° + k·90°,
// the same plate thickness as Cavour's.
const FIN_OUTLINE: [number, number][] = [
  [0.0492, 0],
  [0.0492, 0.13],
  [0.104, 0.045],
  [0.104, -0.015],
];
const FIN_THICKNESS = FIN_THICKNESS_OF_SPAN * 0.1675;

// The round hard edges, inked as rings a hair outside the skin: the tail
// rim, the body joint, the nose shoulder and the bell's mouth.
const RIMS: { y: number; r: number }[] = [
  { y: 0, r: 0.0504 },
  { y: 0.3, r: 0.0504 },
  { y: NOSE_START, r: 0.0504 },
  { y: -0.027, r: 0.0272 },
];

// The bell's mouth is the lowest point: y = -0.027 (nozzleGeometry).
const BBOX_MIN = -0.027;
const BBOX_LEN = TIP - BBOX_MIN;

// Line weights in CSS pixels, the same at any canvas size. The silhouette
// swells and thins along the hull (pen() in OUTLINE_VERTEX), like a pen
// stroke; the rims are a finer pen.
const OUTLINE_PX = 2.6;
const RIM_PX = 1.4;

// The paper the drawing is filled with and the ink it is drawn in.
const PAPER = brand.text;
const INK = brand.ground;

// The outline is an inverted hull: each part's back faces, pushed out along
// their normals by a width in screen pixels, so it shows only where it
// clears the part, at its silhouette. The width follows a fixed wobble of
// the part's own position, so the stroke is uneven but holds still: nothing
// changes per frame, and a card at rest still draws no frames.
const OUTLINE_VERTEX = /* glsl */ `
  uniform vec2 uResolution;
  uniform float uWidth;
  float pen(vec3 p) {
    return 0.86
      + 0.20 * sin(dot(p, vec3(29.0, 43.0, 31.0)))
      + 0.12 * sin(dot(p, vec3(-67.0, 109.0, 53.0)) + 1.7);
  }
  void main() {
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vec2 dir = (projectionMatrix * vec4(normalMatrix * normal, 0.0)).xy * uResolution;
    float len = length(dir);
    if (len > 1e-6) {
      clip.xy += (dir / len) * uWidth * pen(position) * 2.0 / uResolution * clip.w;
    }
    gl_Position = clip;
  }
`;
const OUTLINE_FRAGMENT = /* glsl */ `
  uniform vec3 uInk;
  void main() {
    gl_FragColor = vec4(uInk, 1.0);
    #include <colorspace_fragment>
  }
`;

// The fin's hull. A plate's own normals point square off each face, so a
// hull pushed along them splits at the edges, and averaged normals lean
// almost all the way to the broad faces. Instead every corner is pushed
// straight out from the plate's middle, in its plane (the outline lies in xy,
// extruded along z), so the hull rims the plate's outline evenly.
function plateHull(g: THREE.BufferGeometry, outline: [number, number][]): THREE.BufferGeometry {
  const plain = g.clone();
  plain.deleteAttribute("normal");
  plain.deleteAttribute("uv");
  const out = mergeVertices(plain, 1e-6);
  const cx = outline.reduce((s, [x]) => s + x, 0) / outline.length;
  const cy = outline.reduce((s, [, y]) => s + y, 0) / outline.length;
  const pos = out.getAttribute("position");
  const nor: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const dx = pos.getX(i) - cx;
    const dy = pos.getY(i) - cy;
    const len = Math.hypot(dx, dy) || 1;
    nor.push(dx / len, dy / len, 0);
  }
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  return out;
}

/** A unit ring around the hull axis at y = 0, as line segments. */
function unitRing(segments: number): LineSegmentsGeometry {
  const pts: number[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const b = ((i + 1) / segments) * Math.PI * 2;
    pts.push(Math.cos(a), 0, Math.sin(a), Math.cos(b), 0, Math.sin(b));
  }
  return new LineSegmentsGeometry().setPositions(pts);
}

function buildGeometry() {
  const body: [number, number][] = [[0, R], ...ogive(NOSE_START, NOSE_LENGTH, R, 48)];
  const fin = finGeometry(FIN_OUTLINE, FIN_THICKNESS);
  return {
    body: lathe(body, 128, TIP),
    ...nozzleGeometry(TIP),
    tail: new THREE.CircleGeometry(R, 96),
    fin,
    finHull: plateHull(fin, FIN_OUTLINE),
    rim: unitRing(96),
  };
}

// Built once per page, not once per canvas, as Cavour's parts are. The fill
// and the ink are unlit and skip tone mapping, so they land exactly on the
// brand colours.
let shared: {
  geo: ReturnType<typeof buildGeometry>;
  paper: THREE.MeshBasicMaterial;
  ink: THREE.MeshBasicMaterial;
} | null = null;
function placeholderParts() {
  return (shared ??= {
    geo: buildGeometry(),
    paper: new THREE.MeshBasicMaterial({ color: PAPER, toneMapped: false }),
    ink: new THREE.MeshBasicMaterial({ color: INK, toneMapped: false, side: THREE.DoubleSide }),
  });
}

// The line materials carry their canvas's size, so each canvas has its own.
function useLines() {
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const invalidate = useThree((s) => s.invalidate);
  const lines = useMemo(
    () => ({
      outline: new THREE.ShaderMaterial({
        uniforms: {
          uResolution: { value: new THREE.Vector2(1, 1) },
          uWidth: { value: OUTLINE_PX },
          uInk: { value: new THREE.Color(INK) },
        },
        vertexShader: OUTLINE_VERTEX,
        fragmentShader: OUTLINE_FRAGMENT,
        side: THREE.BackSide,
        toneMapped: false,
      }),
      rim: new LineMaterial({ color: INK, linewidth: RIM_PX, toneMapped: false }),
    }),
    [],
  );
  useLayoutEffect(() => {
    lines.outline.uniforms.uResolution.value.set(width, height);
    lines.rim.resolution.set(width, height);
    invalidate();
  }, [lines, width, height, invalidate]);
  useLayoutEffect(
    () => () => {
      lines.outline.dispose();
      lines.rim.dispose();
    },
    [lines],
  );
  return lines;
}

export default function PlaceholderBuilt({ length }: { weather: WeatherUniforms; length: number }) {
  const { geo, paper, ink } = placeholderParts();
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

  const scale = length / BBOX_LEN;
  // Each part twice: its paper fill, then its ink hull.
  const part = (key: string, fill: THREE.BufferGeometry, hull: THREE.BufferGeometry = fill) => [
    <mesh key={`${key}-fill`} geometry={fill} material={paper} />,
    <mesh key={`${key}-ink`} geometry={hull} material={lines.outline} />,
  ];
  return (
    <group rotation-z={-Math.PI / 2} scale={scale}>
      <group position-y={-(BBOX_MIN + BBOX_LEN / 2)}>
        {part("body", geo.body)}
        {/* tail bulkhead so the tube never reads hollow */}
        <mesh geometry={geo.tail} rotation-x={Math.PI / 2} material={paper} position-y={0.0005} />
        {rims.map((line) => (
          <primitive key={line.position.y} object={line} />
        ))}
        {part("ring", geo.ring)}
        {/* the throat is a hole, so it is inked solid, as a pen drawing fills one */}
        <mesh geometry={geo.throat} material={ink} />
        {part("bell", geo.bell)}
        {[0, 1, 2, 3].map((k) => (
          <group key={k} rotation-y={(45 + 90 * k) * DEG}>
            {part("fin", geo.fin, geo.finHull)}
          </group>
        ))}
      </group>
    </group>
  );
}
