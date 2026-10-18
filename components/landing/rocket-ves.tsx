"use client";

import * as THREE from "three";
import { brand } from "@/lib/brand-colors";
import type { WeatherUniforms } from "./hero-weathering";
import {
  DEG,
  finGeometry,
  hullMaterials,
  lathe,
  nozzleGeometry,
  ogive,
  paintMaterial,
  useCanvasWeather,
  weatherFor,
  type HullMaterials,
} from "./rocket-parts";

// VES Mark I built in code, the way rocket-cavour.tsx builds Cavour (issue
// #361). There is no CAD file for VES, so every number below was read off the
// team's side-on photos of Mark I at EuRoC 2024 and the public specs: 134 mm
// outer diameter, about 3.42 m long (3.65 m is Mark II). Measured in the
// photo of the rocket held level, where the body is 43 px across and the
// whole vehicle 1100 px long.
//
// Units are Cavour's, so the shared nozzle and seams fit and the stages read
// both vehicles in one frame: body radius 0.05, tail at y=0, nose pointing
// +Y, laid along +X by the holder at the bottom. MM converts a measured
// millimetre into those units.
//
// Livery, from the same photos: a white body, one orange stripe along one
// side with a thin black edge, a white ogive nose with a small black tip, four
// orange swept fins, a short black band just above the fins and a black
// tail ring. It is drawn into a canvas from the brand colours, so the wrap
// needs no file. Decals and lettering are left out.

const MM = 0.05 / 67; // units per millimetre: 67 mm radius → Cavour's 0.05
const R = 0.05; // body radius, 134 mm
const LENGTH_MM = 3420; // nose tip to the nozzle's mouth
// The bell's mouth is the lowest point: y = -0.027 (nozzleGeometry).
const BBOX_MIN = -0.027;
const TIP = LENGTH_MM * MM + BBOX_MIN;
const NOSE_LENGTH = 470 * MM; // a tangent ogive, 3.5 calibres
const NOSE_START = TIP - NOSE_LENGTH;
const NOSE_TIP_BLACK = 55 * MM; // the black cap on the nose's point

// Fin plate outline in (radial, axial): swept trapezoid, root buried 0.8 mm
// (in Cavour units) inside the skin. Root chord 340 mm, tip chord 120 mm,
// span 150 mm; the trailing edge stands square, 20 mm above the tail. Four
// at 45° + k·90°, as Cavour's. Thin and square-cut: a 5 mm plate, no fillet.
const FIN_ROOT = R - 0.0008;
const FIN_TIP = R + 150 * MM;
const FIN_OUTLINE: [number, number][] = [
  [FIN_ROOT, 20 * MM],
  [FIN_ROOT, 360 * MM],
  [FIN_TIP, 140 * MM],
  [FIN_TIP, 20 * MM],
];
const FIN_THICKNESS = 5 * MM;

// Section joints: the fin can, the two body joints and the nose shoulder.
const SEAM_Y = [400 * MM, 1330 * MM, 2050 * MM, NOSE_START];
const SEAM_R = 0.0504;
const SEAM_H = 0.0009;

// The short black band, just above the fins.
const BAND = { from: 400 * MM, to: 470 * MM };

// The orange stripe: a third of the round, centred low on the camera side
// (angle 90° faces the camera, 0° faces down once laid along +X), from above
// the band to just short of the nose shoulder. Its ends taper to a point
// along its upper edge, as the photos show, and a thin black line edges it.
const STRIPE = {
  from: 520 * MM,
  to: NOSE_START - 60 * MM,
  angLo: -10,
  angHi: 110,
  taper: 260 * MM,
  edge: 6 * MM,
};

/** u on the hull's UV rule (rocket-parts.ts): u = 0.5 − angle/2π. */
const uOf = (angDeg: number) => 0.5 - angDeg / 360;

// The wrap drawn into a canvas on the hull's UV rule (v = 1 − y/TIP, nose at
// the top of the image). The hull is 25 calibres long, so the image is tall.
function liveryTexture(): THREE.CanvasTexture {
  const W = 512;
  const H = 4096;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const px = (u: number) => u * W;
  const py = (y: number) => (1 - y / TIP) * H;

  ctx.fillStyle = brand.text;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = brand.ground;
  ctx.fillRect(0, py(BAND.to), W, py(BAND.from) - py(BAND.to));
  ctx.fillRect(0, 0, W, py(TIP - NOSE_TIP_BLACK));

  // The stripe: its lower edge (angLo) runs straight; its upper edge (angHi)
  // curves down to meet it at either end.
  const lo = px(uOf(STRIPE.angLo));
  const hi = px(uOf(STRIPE.angHi));
  const aft = py(STRIPE.from);
  const fore = py(STRIPE.to);
  const taper = py(0) - py(STRIPE.taper);
  ctx.beginPath();
  ctx.moveTo(lo, aft);
  ctx.quadraticCurveTo(hi, aft, hi, aft - taper);
  ctx.lineTo(hi, fore + taper);
  ctx.quadraticCurveTo(hi, fore, lo, fore);
  ctx.closePath();
  ctx.fillStyle = brand.accent;
  ctx.fill();
  ctx.lineWidth = (STRIPE.edge / (2 * Math.PI * R)) * W;
  ctx.strokeStyle = brand.ground;
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** One flat colour, for the fin plates' paint. */
function flatTexture(color: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 4;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 4, 4);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildGeometry() {
  const body: [number, number][] = [[0, R], ...ogive(NOSE_START, NOSE_LENGTH, R, 48)];
  return {
    body: lathe(body, 128, TIP),
    seam: lathe([[-SEAM_H / 2, SEAM_R], [SEAM_H / 2, SEAM_R]], 96, TIP),
    ...nozzleGeometry(TIP),
    tail: new THREE.CircleGeometry(R, 96),
    fin: finGeometry(FIN_OUTLINE, FIN_THICKNESS),
  };
}

type Mats = HullMaterials & { livery: THREE.MeshPhysicalMaterial; fin: THREE.MeshPhysicalMaterial };

// The signed-off paint and hull materials (rocket-parts.ts), nothing new. The
// fins wear the body's paint in orange; a fin facing the camera is a mirror
// (rocket-surface skill), so their paint has the lower specular the decals
// use, and no more shine than the body.
function makeMaterials(): Mats {
  return {
    livery: paintMaterial(liveryTexture(), 0.6, false, weatherFor),
    fin: paintMaterial(flatTexture(brand.accent), 0.4, false, weatherFor),
    ...hullMaterials(weatherFor),
  };
}

// Built once per page, not once per canvas, as Cavour's parts are.
let shared: { geo: ReturnType<typeof buildGeometry>; mats: Mats } | null = null;
function vesParts() {
  return (shared ??= { geo: buildGeometry(), mats: makeMaterials() });
}

const BBOX_LEN = TIP - BBOX_MIN;

export default function VesBuilt({ weather, length }: { weather: WeatherUniforms; length: number }) {
  const { geo, mats } = vesParts();
  useCanvasWeather(weather);

  const scale = length / BBOX_LEN;
  const shadow = { castShadow: true, receiveShadow: true };
  return (
    <group rotation-z={-Math.PI / 2} scale={scale}>
      <group position-y={-(BBOX_MIN + BBOX_LEN / 2)}>
        <mesh geometry={geo.body} material={mats.livery} {...shadow} />
        {/* tail bulkhead so the tube never reads hollow */}
        <mesh geometry={geo.tail} rotation-x={Math.PI / 2} material={mats.seam} position-y={0.0005} />
        {SEAM_Y.map((y) => (
          <mesh key={y} geometry={geo.seam} material={mats.seam} position-y={y} />
        ))}
        {/* the black tail ring */}
        <mesh geometry={geo.ring} material={mats.seam} {...shadow} />
        <mesh geometry={geo.throat} material={mats.seam} />
        <mesh geometry={geo.bell} material={mats.titanium} {...shadow} />
        {[0, 1, 2, 3].map((k) => (
          <mesh key={k} geometry={geo.fin} material={mats.fin} rotation-y={(45 + 90 * k) * DEG} {...shadow} />
        ))}
      </group>
    </group>
  );
}
