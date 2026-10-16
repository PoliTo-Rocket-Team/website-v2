import { useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { applyWeathering, PROFILES, type WeatherFor, type WeatherUniforms } from "./hero-weathering";

// The parts every code-built vehicle is made of: the lathe for bodies, noses,
// seams and nozzles, the curved hull patch for decals and lettering, the
// square-cut fin plate, and the signed-off materials. Cavour
// (rocket-cavour.tsx) is the reference vehicle; the placeholder
// (rocket-placeholder.tsx) is built from the same parts, so the two read as
// one family. See the rocket-surface skill before changing a number here.

export const DEG = Math.PI / 180;

/** Fin plate thickness as a share of its span, as on Cavour. */
export const FIN_THICKNESS_OF_SPAN = 0.026;

// UV convention copied from Cavour's GLB so a wrap texture maps identically:
//   u = 0.5 − angle/2π   (angle = atan2(z, x); camera side, +Z, is u=0.25)
//   v = 1 − y/tip        (v=0 at the nose = top of the image, flipY off)
//
// Revolve a (y, r) profile around +Y. A straight section costs one ring and a
// curved nose gets one ring per profile row. Normals come from the profile
// tangent, not vertex averaging, so the seam column is invisible.
export function lathe(profile: [number, number][], segments: number, tip: number): THREE.BufferGeometry {
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
      uv.push(u, 1 - y / tip);
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

/** A curved patch on the hull, in the axial range y0..y1 and the angle range angLo..angHi (degrees). */
export type HullPatch = { y0: number; y1: number; angLo: number; angHi: number; r: number };

// u runs from angHi to angLo (the GLB's decal plane orientation), v from y1
// (nose side) to y0.
export function hullPatch(p: HullPatch, segments = 24): THREE.BufferGeometry {
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

/** A square-cut fin plate from its outline in (radial, axial), centred on its own thickness. */
export function finGeometry(outline: [number, number][], thickness: number): THREE.BufferGeometry {
  const shape = new THREE.Shape(outline.map(([r, y]) => new THREE.Vector2(r, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  g.translate(0, 0, -thickness / 2);
  return g;
}

/** Points along a tangent ogive nose, base to tip, as (y, r) rows for `lathe`. */
export function ogive(start: number, length: number, radius: number, rows: number): [number, number][] {
  const rho = (radius * radius + length * length) / (2 * radius);
  const out: [number, number][] = [];
  for (let i = 0; i <= rows; i++) {
    const fromBase = (i / rows) * length;
    const r = i === rows ? 0 : Math.sqrt(rho * rho - fromBase * fromBase) + radius - rho;
    out.push([start + fromBase, Math.max(r, 0)]);
  }
  return out;
}

/** The hull materials the founder signed off on Cavour (2026-09-16). Every built vehicle draws with these. */
export type HullMaterials = {
  aluminium: THREE.MeshStandardMaterial;
  titanium: THREE.MeshStandardMaterial;
  seam: THREE.MeshStandardMaterial;
};

/** Matte, worn paint over a wrap texture: roughness, faint clearcoat, low env, `PROFILES.paint`. */
export function paintMaterial(
  map: THREE.Texture,
  specular: number,
  transparent: boolean,
  weather: WeatherFor,
): THREE.MeshPhysicalMaterial {
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
}

export function hullMaterials(weather: WeatherFor): HullMaterials {
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
  return { aluminium, titanium, seam };
}

/** The nozzle every built vehicle carries, under its tail at y=0: thrust ring, throat and bell. */
export function nozzleGeometry(tip: number) {
  return {
    ring: lathe([[-0.0036, 0.036], [0, 0.036]], 64, tip),
    throat: lathe([[-0.016, 0.015], [0.004, 0.015]], 48, tip),
    bell: lathe([[-0.027, 0.027], [-0.021, 0.024], [-0.014, 0.02], [-0.008, 0.017]], 64, tip),
  };
}

// Each canvas draws the vehicle from its own view, so each has its own weather
// uniforms (where the hull sits, the belly light, the wear dials). The
// materials are shared, so they look the uniforms up by renderer: three
// compiles a material once per WebGL context and hands the renderer to that
// compile (hero-weathering.ts). One canvas holds one vehicle.
const weatherByRenderer = new WeakMap<THREE.WebGLRenderer, WeatherUniforms>();
export const weatherFor: WeatherFor = (renderer) => {
  const weather = weatherByRenderer.get(renderer);
  if (!weather) throw new Error("A vehicle material compiled on a canvas with no built vehicle in it.");
  return weather;
};

/**
 * Registers this canvas's weather before the scene's first compile: layout
 * effects run before WarmUp's compile and before the canvas draws its first
 * frame.
 */
export function useCanvasWeather(weather: WeatherUniforms) {
  const gl = useThree((s) => s.gl);
  useLayoutEffect(() => {
    weatherByRenderer.set(gl, weather);
    return () => {
      weatherByRenderer.delete(gl);
    };
  }, [gl, weather]);
}
