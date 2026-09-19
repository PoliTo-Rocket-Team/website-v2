import * as THREE from "three";

// Procedural wear for the rocket's PBR materials, injected into three's
// standard shader. Nothing here needs UVs (the fins ship without them):
// everything is a function of position in "rocket space" — x along the
// axis (nose +), y/z radial — so scuffs, brushed streaks and soot sit
// still on the surface while the rocket bobs.
//
// What it adds, per material:
//  - micro roughness variation (kills the uniform plastic sheen)
//  - long brushed streaks along the axis (metal grain / paint scratches)
//  - scuff patches: slightly darker and rougher
//  - soot staining that builds toward the nozzle

export type WeatherUniforms = {
  // World -> rocket space. The inverse world matrix of the group that holds
  // the vehicle, so the wear stays pinned to the hull however that group is
  // placed: the hero only slides it, but the card stands it up, leans it and
  // pivots it on hover. A bare position (the old uRocketPos) could not
  // express the rotation, so the wear crawled across the card rocket.
  uRocketInv: { value: THREE.Matrix4 };
  uSootStart: { value: number }; // x where soot begins (toward the tail)
  uTail: { value: number }; // x of the nozzle
  // Belly light gate: how much of the environment's light reaches
  // down-facing surfaces (0 = none, 1 = all of it). The HDRI's floor would
  // otherwise leave a fixed sheen under the hull; the hero drives this from
  // the rocket's height on screen so the underside only lights up near the
  // earth. uDown is screen-down in scene space (the stage is CSS-tilted).
  uBelly: { value: number };
  uDown: { value: THREE.Vector3 };
  // Close-up dials. The wear frequencies were tuned for the hero's framing,
  // where the whole vehicle spans the screen; a card shows the same hull at
  // several times the pixel scale, and there the same noise reads as dashes
  // and static. uWearScale multiplies the noise frequency (finer grain) and
  // uWearAmount its contrast. Both 1 on the hero, which keeps it byte-identical.
  uWearScale: { value: number };
  uWearAmount: { value: number };
};
const BELLY_FLOOR = 0.15; // env light kept under the hull when uBelly = 0

export type WeatherProfile = {
  micro: number; // roughness noise amplitude
  streak: number; // brushed streak strength
  scuff: number; // scuff darkening (0-1)
  soot: number; // max soot darkening (0-1)
  tone: number; // diffuse tone variation from streaks/grain (0-1)
};

export const PROFILES: Record<string, WeatherProfile> = {
  paint: { micro: 0.14, streak: 0.14, scuff: 0.12, soot: 0.45, tone: 0.22 },
  metal: { micro: 0.05, streak: 0.06, scuff: 0.08, soot: 0.55, tone: 0.04 },
  trim: { micro: 0.08, streak: 0.08, scuff: 0.05, soot: 0.5, tone: 0.06 },
};

const NOISE_GLSL = /* glsl */ `
  float wHash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float wNoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(wHash(i + vec3(0, 0, 0)), wHash(i + vec3(1, 0, 0)), f.x),
          mix(wHash(i + vec3(0, 1, 0)), wHash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(wHash(i + vec3(0, 0, 1)), wHash(i + vec3(1, 0, 1)), f.x),
          mix(wHash(i + vec3(0, 1, 1)), wHash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  float wFbm(vec3 p) {
    return wNoise(p) * 0.5 + wNoise(p * 2.03) * 0.25 + wNoise(p * 4.11) * 0.125 + wNoise(p * 8.3) * 0.0625;
  }
`;

export function applyWeathering(
  material: THREE.MeshStandardMaterial,
  profile: WeatherProfile,
  uniforms: WeatherUniforms,
) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, {
      uWMicro: { value: profile.micro },
      uWStreak: { value: profile.streak },
      uWScuff: { value: profile.scuff },
      uWSoot: { value: profile.soot },
      uWTone: { value: profile.tone },
    });

    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWRocketPos;\nuniform mat4 uRocketInv;")
      .replace(
        "#include <project_vertex>",
        "#include <project_vertex>\nvWRocketPos = (uRocketInv * modelMatrix * vec4(transformed, 1.0)).xyz;",
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vWRocketPos;
        uniform float uSootStart;
        uniform float uTail;
        uniform float uWMicro;
        uniform float uWStreak;
        uniform float uWScuff;
        uniform float uWSoot;
        uniform float uWTone;
        uniform float uBelly;
        uniform vec3 uDown;
        uniform float uWearScale;
        uniform float uWearAmount;
        ${NOISE_GLSL}`,
      )
      // Environment light on the underside follows the belly gate
      .replace(
        "#include <lights_fragment_maps>",
        `#include <lights_fragment_maps>
        {
          // geometryNormal is in view space; uDown is given in scene space.
          // The hero's level camera hid the mismatch, but the card camera is
          // pitched down, so without this any surface facing the camera
          // counted as underside and went dark.
          vec3 downView = normalize((viewMatrix * vec4(uDown, 0.0)).xyz);
          float down = smoothstep(-0.15, 0.45, dot(geometryNormal, downView));
          float k = mix(1.0, mix(${BELLY_FLOOR}, 1.0, uBelly), down);
          iblIrradiance *= k;
          radiance *= k;
          #ifdef USE_CLEARCOAT
            clearcoatRadiance *= k;
          #endif
        }`,
      )
      // Diffuse: scuffs and soot darken the base color
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        {
          // Soot is placed in true rocket units (it has to start at the
          // nozzle); everything else is noise and may be rescaled.
          float axial = vWRocketPos.x;
          vec3 rp = vWRocketPos * uWearScale;
          float scuff = smoothstep(0.55, 0.8, wFbm(rp * 1.7 + 3.0)) * uWearAmount;
          float sootMask = smoothstep(uSootStart, uTail, axial);
          float sootN = 0.55 + 0.45 * wFbm(rp * vec3(0.9, 3.5, 3.5) + 11.0);
          float soot = sootMask * sootN * uWSoot;
          // Unfinished-surface tone: brushed streaks and grain show in the
          // color itself, not only in the sheen (needed on light paint).
          float streak = smoothstep(0.55, 0.95, wNoise(vec3(rp.x * 1.2, rp.y * 42.0, rp.z * 42.0))) * uWearAmount;
          float grain = (wFbm(rp * 9.0) - 0.5) * uWearAmount;
          diffuseColor.rgb *= 1.0 - streak * uWTone * 0.6 + grain * uWTone * 0.8;
          diffuseColor.rgb *= 1.0 - scuff * uWScuff;
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.16, 0.14, 0.13), soot);
        }`,
      )
      // Roughness: micro variation + brushed streaks + rougher scuffs and soot
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        {
          float axial = vWRocketPos.x;
          vec3 rp = vWRocketPos * uWearScale;
          float micro = (wFbm(rp * 6.0) - 0.5) * uWearAmount;
          float streak = wNoise(vec3(rp.x * 1.2, rp.y * 42.0, rp.z * 42.0));
          streak = smoothstep(0.62, 0.95, streak) * uWearAmount;
          float scuff = smoothstep(0.55, 0.8, wFbm(rp * 1.7 + 3.0)) * uWearAmount;
          float sootMask = smoothstep(uSootStart, uTail, axial);
          roughnessFactor += micro * uWMicro * 2.0;
          roughnessFactor += streak * uWStreak;
          roughnessFactor += scuff * 0.25 * uWScuff * 4.0;
          roughnessFactor += sootMask * 0.3 * uWSoot;
          roughnessFactor = clamp(roughnessFactor, 0.08, 1.0);
        }`,
      );
  };
  material.customProgramCacheKey = () => `weather-${profile.micro}-${profile.streak}-${profile.scuff}-${profile.soot}-${profile.tone}`;
  material.needsUpdate = true;
}
