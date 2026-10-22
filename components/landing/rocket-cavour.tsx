"use client";

import { useEnvironment, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { applyWeathering, PROFILES, type WeatherFor, type WeatherUniforms } from "./hero-weathering";
import { CAVOUR_DECAL, CAVOUR_HDRI, CAVOUR_LIVERY } from "./cavour-assets";
import {
  DEG,
  FIN_THICKNESS_OF_SPAN,
  finGeometry,
  hullMaterials,
  hullPatch,
  lathe,
  nozzleGeometry,
  paintMaterial,
  useCanvasWeather,
  weatherFor,
  type HullMaterials,
} from "./rocket-parts";

// Cavour built from code instead of the 1.7 MB GLB. Every number below was
// measured off design/cavour.glb (see the rocket-surface skill), in
// the GLB's own units: body radius 0.05, tail at y=0, nose tip at y=0.85,
// nose pointing +Y. The holder at the bottom lays it along +X like the GLB
// path does, so the weathering shader and the plume see the same frame.
//
// Livery stays a texture (the GLB's own wrap, 53 KB) because the white wave
// between orange and black is hand-drawn; the "CAVOUR" letters are drawn
// into a canvas at load. The decal strip (logo + flags) is the GLB's PNG.
// The lathe, patches, fin plate and materials are shared (rocket-parts.ts).

const R = 0.05; // body radius
const TIP = 0.85; // nose tip
// Nose radius every 4 mm from where the cylinder ends (y=0.619) to the tip,
// straight off the GLB's vertices. Not an ogive; it's the CAD spline.
const NOSE_START = 0.619;
const NOSE_STEP = 0.004;
const NOSE_R = [
  0.0496, 0.0494, 0.0492, 0.049, 0.0488, 0.0486, 0.0483, 0.048, 0.0477, 0.0473, 0.047, 0.0466,
  0.0462, 0.0457, 0.0453, 0.0448, 0.0443, 0.0438, 0.0432, 0.0426, 0.042, 0.0414, 0.0407, 0.04,
  0.0393, 0.0386, 0.0379, 0.0371, 0.0363, 0.0354, 0.0346, 0.0337, 0.0328, 0.0319, 0.0309, 0.0299,
  0.0289, 0.0279, 0.0268, 0.0258, 0.0247, 0.0235, 0.0224, 0.0212, 0.0199, 0.0187, 0.0174, 0.0161,
  0.0148, 0.0135, 0.0121, 0.0107, 0.0092, 0.0078, 0.0063, 0.0047, 0.0032, 0,
];

// Fin plate outline in (radial, axial): swept trapezoid, root buried 0.8 mm
// inside the skin, tip trailing 36 mm past the tail. Four at 45° + k·90°.
const FIN_OUTLINE: [number, number][] = [
  [0.0492, 0],
  [0.0492, 0.1318],
  [0.1117, 0.0187],
  [0.1117, -0.0357],
];
const FIN_THICKNESS = FIN_THICKNESS_OF_SPAN * 0.1675; // × span, as the GLB path

const SEAM_Y = [0.14025, 0.53975]; // body joint rings
const SEAM_R = 0.0504;
const SEAM_H = 0.0009;

// Decal strip and lettering both face the camera (+Z side, angle 90°).
const DECAL = { y0: 0.2545, y1: 0.4465, angLo: 40.4, angHi: 145.8, r: 0.0503 };
const TEXT = { y0: 0.012, y1: 0.207, angLo: 75, angHi: 105, r: 0.0504 };
const TEXT_LETTERS = "CAVOUR";
const TEXT_TOP = 0.2014; // first letter's nose edge
const TEXT_PITCH = 0.0307; // letter spacing along the axis
const TEXT_CAP = 0.021; // letter height across the hull

// Where the GLB's bounding box put things: fins to -0.0357, tip at 0.85.
const BBOX_MIN = -0.0357;
const BBOX_LEN = TIP - BBOX_MIN;
export const CAVOUR_BUILT_LENGTH_UNITS = BBOX_LEN;

// "CAVOUR" stacked along the hull, each letter upright with its top toward
// the nose — the GLB's extruded text, flattened to paint.
function letteringTexture(): THREE.CanvasTexture {
  const W = 256;
  const arc = (TEXT.angHi - TEXT.angLo) * DEG * TEXT.r;
  const H = Math.round((W * (TEXT.y1 - TEXT.y0)) / arc);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const capPx = (TEXT_CAP / arc) * W;
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `400 ${Math.round(capPx / 0.72)}px "Helvetica Neue", "Segoe UI", Arial, sans-serif`;
  for (let k = 0; k < TEXT_LETTERS.length; k++) {
    const yAxial = TEXT_TOP - TEXT_PITCH / 2 - k * TEXT_PITCH;
    const py = ((TEXT.y1 - yAxial) / (TEXT.y1 - TEXT.y0)) * H;
    ctx.fillText(TEXT_LETTERS[k], W / 2, py + capPx * 0.04);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

type Mats = HullMaterials & {
  livery: THREE.MeshPhysicalMaterial;
  decal: THREE.MeshPhysicalMaterial;
  text: THREE.MeshPhysicalMaterial;
};

// Same numbers as the GLB branch in hero-rocket-3d.tsx: that file is the
// reference for the look; this only reproduces it on built geometry.
function makeMaterials(livery: THREE.Texture, decal: THREE.Texture, weather: WeatherFor): Mats {
  for (const t of [livery, decal]) {
    t.flipY = false;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.needsUpdate = true;
  }
  const text = new THREE.MeshPhysicalMaterial({
    map: letteringTexture(),
    color: new THREE.Color().setRGB(0.87, 0.87, 0.86),
    roughness: 0.6,
    metalness: 0,
    envMapIntensity: 0.55,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  applyWeathering(text, PROFILES.paint, weather);
  return {
    livery: paintMaterial(livery, 0.6, false, weather),
    decal: paintMaterial(decal, 0.4, true, weather),
    text,
    ...hullMaterials(weather),
  };
}

function buildGeometry() {
  const body: [number, number][] = [[0, R], [NOSE_START, R]];
  NOSE_R.forEach((r, i) => body.push([NOSE_START + i * NOSE_STEP, r]));
  body[body.length - 1][0] = TIP;
  return {
    body: lathe(body, 128, TIP),
    seam: lathe([[-SEAM_H / 2, SEAM_R], [SEAM_H / 2, SEAM_R]], 96, TIP),
    ...nozzleGeometry(TIP),
    tail: new THREE.CircleGeometry(R, 96),
    fin: finGeometry(FIN_OUTLINE, FIN_THICKNESS),
    decal: hullPatch(DECAL),
    text: hullPatch(TEXT),
  };
}

// Built once per page, not once per canvas: the hero and every project card
// show the same vehicle. Geometry, materials and textures are plain objects
// that any number of WebGL contexts can draw; each context still uploads the
// buffers and compiles the shaders for itself, which no sharing can avoid
// short of drawing everything in one canvas. Never disposed: the page keeps
// them for as long as it shows a Cavour.
let shared: { geo: ReturnType<typeof buildGeometry>; mats: Mats } | null = null;
function cavourParts(livery: THREE.Texture, decal: THREE.Texture) {
  return (shared ??= { geo: buildGeometry(), mats: makeMaterials(livery, decal, weatherFor) });
}

export default function CavourBuilt({ weather, length }: { weather: WeatherUniforms; length: number }) {
  const [livery, decal] = useTexture([CAVOUR_LIVERY, CAVOUR_DECAL]);
  const { geo, mats } = cavourParts(livery, decal);
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
        <mesh geometry={geo.decal} material={mats.decal} />
        <mesh geometry={geo.text} material={mats.text} />
      </group>
    </group>
  );
}

// Load and decode once, when this chunk first runs, for every canvas on the
// page: the hero and the cards all read these from the same loader cache, so
// the HDRI and both textures are fetched and parsed once, not once per canvas.
useTexture.preload([CAVOUR_LIVERY, CAVOUR_DECAL]);
useEnvironment.preload({ files: CAVOUR_HDRI });
