"use client";

import * as THREE from "three";
import { brand } from "@/lib/brand-colors";
import type { WeatherUniforms } from "./hero-weathering";
import {
  DEG,
  FIN_THICKNESS_OF_SPAN,
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

// The placeholder rocket: one generic vehicle every project draws until its
// own model is written in code (issue #296). It is no real vehicle, so no
// number is measured; it is drawn from Cavour's parts and units
// (rocket-cavour.tsx, rocket-parts.ts) so it sits in the same stages at the
// same size: body radius 0.05, tail at y=0, nose pointing +Y, laid along +X
// by the holder at the bottom. It carries no name, flag or logo, because it
// stands in for any project.
//
// Its look is the owner's call on the preview: a paper hull with a signal
// orange nose and an ink band at the tail, from the brand colours.

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

const SEAM_Y = [0.3, NOSE_START]; // the body joint and the nose shoulder
const SEAM_R = 0.0504;
const SEAM_H = 0.0009;

// The livery, as axial bands from the tail: ink up to the fins' leading edge,
// paper to the nose shoulder, a thin ink ring, then the orange nose.
const BANDS: { to: number; color: string }[] = [
  { to: 0.15, color: brand.ground },
  { to: 0.585, color: brand.text },
  { to: 0.6, color: brand.ground },
  { to: NOSE_START, color: brand.text },
  { to: TIP, color: brand.accent },
];

// The bell's mouth is the lowest point: y = -0.027 (nozzleGeometry).
const BBOX_MIN = -0.027;
const BBOX_LEN = TIP - BBOX_MIN;

// The bands drawn into a canvas on the hull's UV rule (v = 1 − y/TIP, nose at
// the top of the image), so the wrap needs no file.
function liveryTexture(): THREE.CanvasTexture {
  const W = 8;
  const H = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  let from = 0;
  for (const band of BANDS) {
    const top = Math.round((1 - band.to / TIP) * H);
    const bottom = Math.round((1 - from / TIP) * H);
    ctx.fillStyle = band.color;
    ctx.fillRect(0, top, W, bottom - top);
    from = band.to;
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
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

// Built once per page, not once per canvas, as Cavour's parts are.
let shared: { geo: ReturnType<typeof buildGeometry>; mats: HullMaterials & { livery: THREE.Material } } | null =
  null;
function placeholderParts() {
  return (shared ??= {
    geo: buildGeometry(),
    mats: { livery: paintMaterial(liveryTexture(), 0.6, false, weatherFor), ...hullMaterials(weatherFor) },
  });
}

export default function PlaceholderBuilt({ weather, length }: { weather: WeatherUniforms; length: number }) {
  const { geo, mats } = placeholderParts();
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
        <mesh geometry={geo.ring} material={mats.aluminium} {...shadow} />
        <mesh geometry={geo.throat} material={mats.seam} />
        <mesh geometry={geo.bell} material={mats.titanium} {...shadow} />
        {[0, 1, 2, 3].map((k) => (
          <mesh
            key={k}
            geometry={geo.fin}
            material={mats.aluminium}
            rotation-y={(45 + 90 * k) * DEG}
            {...shadow}
          />
        ))}
      </group>
    </group>
  );
}
