"use client";

import { useMemo } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { applyWeathering, PROFILES, type WeatherUniforms } from "./hero-weathering";

// Cavour built from code instead of the 1.7 MB GLB. Every number below was
// measured off design/cavour.glb (see the rocket-surface skill), in
// the GLB's own units: body radius 0.05, tail at y=0, nose tip at y=0.85,
// nose pointing +Y. The holder at the bottom lays it along +X like the GLB
// path does, so the weathering shader and the plume see the same frame.
//
// Livery stays a texture (the GLB's own wrap, 53 KB) because the white wave
// between orange and black is hand-drawn; the "CAVOUR" letters are drawn
// into a canvas at load. The decal strip (logo + flags) is the GLB's PNG.

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
const FIN_THICKNESS = 0.026 * 0.1675; // FIN_THICKNESS_OF_SPAN × span, as the GLB path

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

// UV convention copied from the GLB so its livery wraps identically:
//   u = 0.5 − angle/2π   (angle = atan2(z, x); camera side, +Z, is u=0.25)
//   v = 1 − y/TIP        (v=0 at the nose = top of the image, flipY off)
const DEG = Math.PI / 180;

// Revolve a (y, r) profile around +Y. UVs by the rule above, so a straight
// section costs one ring and the nose spline gets its 53. Normals come from
// the profile tangent, not vertex averaging, so the seam column is invisible.
function lathe(profile: [number, number][], segments: number): THREE.BufferGeometry {
  const rows = profile.length;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  for (let i = 0; i < rows; i++) {
    const [y, r] = profile[i];
    const [yPrev, rPrev] = profile[Math.max(i - 1, 0)];
    const [yNext, rNext] = profile[Math.min(i + 1, rows - 1)];
    // tangent (dr, dy) → outward normal (dy, -dr)
    let nr = yNext - yPrev;
    let ny = -(rNext - rPrev);
    const len = Math.hypot(nr, ny) || 1;
    nr /= len;
    ny /= len;
    for (let j = 0; j <= segments; j++) {
      const u = j / segments;
      const ang = (0.5 - u) * Math.PI * 2;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      pos.push(r * c, y, r * s);
      nor.push(nr * c, ny, nr * s);
      uv.push(u, 1 - y / TIP);
    }
  }
  const idx: number[] = [];
  const cols = segments + 1;
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * cols + j;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// A curved patch on the hull: angles in degrees, u runs from angHi to angLo
// (the GLB's decal plane orientation), v from y1 (nose side) to y0.
function hullPatch(p: { y0: number; y1: number; angLo: number; angHi: number; r: number }, segments = 24) {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  for (let i = 0; i <= 1; i++) {
    const y = i === 0 ? p.y0 : p.y1;
    for (let j = 0; j <= segments; j++) {
      const u = j / segments;
      const ang = (p.angHi - (p.angHi - p.angLo) * u) * DEG;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      pos.push(p.r * c, y, p.r * s);
      nor.push(c, 0, s);
      uv.push(u, (p.y1 - y) / (p.y1 - p.y0));
    }
  }
  const idx: number[] = [];
  const cols = segments + 1;
  for (let j = 0; j < segments; j++) idx.push(j, j + 1, j + cols, j + 1, j + cols + 1, j + cols);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function finGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape(FIN_OUTLINE.map(([r, y]) => new THREE.Vector2(r, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: FIN_THICKNESS, bevelEnabled: false });
  g.translate(0, 0, -FIN_THICKNESS / 2);
  return g;
}

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

type Mats = {
  livery: THREE.MeshPhysicalMaterial;
  decal: THREE.MeshPhysicalMaterial;
  text: THREE.MeshPhysicalMaterial;
  aluminium: THREE.MeshStandardMaterial;
  titanium: THREE.MeshStandardMaterial;
  seam: THREE.MeshStandardMaterial;
};

// Same numbers as the GLB branch in hero-rocket-3d.tsx: that file is the
// reference for the look; this only reproduces it on built geometry.
function makeMaterials(livery: THREE.Texture, decal: THREE.Texture, weather: WeatherUniforms): Mats {
  for (const t of [livery, decal]) {
    t.flipY = false;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.needsUpdate = true;
  }
  const paint = (map: THREE.Texture, specular: number, transparent: boolean) => {
    const m = new THREE.MeshPhysicalMaterial({
      map,
      roughness: 0.62,
      metalness: 0,
      clearcoat: 0.12,
      clearcoatRoughness: 0.65,
      envMapIntensity: 0.28,
      specularIntensity: specular,
      transparent,
      depthWrite: !transparent,
      polygonOffset: transparent,
      polygonOffsetFactor: -1,
    });
    applyWeathering(m, PROFILES.paint, weather);
    return m;
  };
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
  // Fins: the GLB path's numbers are 0.14/0.145/0.155, but there the fin
  // plates shadowed themselves (inverted normals from the sheet extrusion)
  // and never saw the sun. That dark, dull look is the one that was signed
  // off, so the built fins get a darker base to land on the same tone.
  const aluminium = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setRGB(0.065, 0.067, 0.072),
    metalness: 0.6,
    roughness: 0.72,
    envMapIntensity: 0.3,
  });
  applyWeathering(aluminium, PROFILES.metal, weather);
  const titanium = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setRGB(0.16, 0.165, 0.17),
    metalness: 0.6,
    roughness: 0.7,
    envMapIntensity: 0.35,
    side: THREE.DoubleSide,
  });
  applyWeathering(titanium, PROFILES.metal, weather);
  const seam = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setRGB(0.035, 0.035, 0.04),
    metalness: 0,
    roughness: 0.7,
    envMapIntensity: 0.5,
    side: THREE.DoubleSide,
  });
  applyWeathering(seam, PROFILES.trim, weather);
  return { livery: paint(livery, 0.6, false), decal: paint(decal, 0.4, true), text, aluminium, titanium, seam };
}

// Built once per page, not once per canvas: the hero and the four project
// cards all show the same vehicle, and geometry is safe to share across WebGL
// contexts (three uploads it to each on first draw). Materials are NOT shared,
// because each canvas drives its own weather uniforms.
let sharedGeo: ReturnType<typeof buildGeometry> | null = null;
function buildGeometry() {
  const body: [number, number][] = [[0, R], [NOSE_START, R]];
  NOSE_R.forEach((r, i) => body.push([NOSE_START + i * NOSE_STEP, r]));
  body[body.length - 1][0] = TIP;
  return {
    body: lathe(body, 128),
    seam: lathe([[-SEAM_H / 2, SEAM_R], [SEAM_H / 2, SEAM_R]], 96),
    ring: lathe([[-0.0036, 0.036], [0, 0.036]], 64),
    throat: lathe([[-0.016, 0.015], [0.004, 0.015]], 48),
    bell: lathe([[-0.027, 0.027], [-0.021, 0.024], [-0.014, 0.02], [-0.008, 0.017]], 64),
    fin: finGeometry(),
    decal: hullPatch(DECAL),
    text: hullPatch(TEXT),
  };
}

export default function CavourBuilt({ weather, length }: { weather: WeatherUniforms; length: number }) {
  const [livery, decal] = useTexture(["/design/cavour/livery.png", "/design/cavour/decal-strip.png"]);
  const mats = useMemo(() => makeMaterials(livery, decal, weather), [livery, decal, weather]);
  const geo = (sharedGeo ??= buildGeometry());

  const scale = length / BBOX_LEN;
  const shadow = { castShadow: true, receiveShadow: true };
  return (
    <group rotation-z={-Math.PI / 2} scale={scale}>
      <group position-y={-(BBOX_MIN + BBOX_LEN / 2)}>
        <mesh geometry={geo.body} material={mats.livery} {...shadow} />
        {/* tail bulkhead so the tube never reads hollow */}
        <mesh rotation-x={Math.PI / 2} material={mats.seam} position-y={0.0005}>
          <circleGeometry args={[R, 96]} />
        </mesh>
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

useTexture.preload(["/design/cavour/livery.png", "/design/cavour/decal-strip.png"]);
