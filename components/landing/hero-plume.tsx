"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// Exhaust plume, built to read like a photo of a motor firing: a tight
// white-hot core with shock diamonds right at the nozzle, cooling to orange
// and fading into a lit smoke trail. Glow sprites give the bloom halo
// without post-processing (the transparent canvas can't take a composer).
//
// Coordinates: parent group is the rocket, +x = nose. The plume sits at the
// nozzle and trails toward -x. Everything renders premultiplied so it
// composites cleanly over the page.

// ---- Core: one long plane, shader-driven -----------------------------------

const CORE_LENGTH = 30; // reaches the stage's left edge; the shader fades it out before the end
const CORE_HEIGHT = 6.8;

const CORE_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CORE_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uThrottle; // 1 = full burn (drive-in), 0.3 = idle before the drive-in
  uniform float uFade; // 1 = burning, 0 = gone (the fade-out once parked)
  varying vec2 vUv;

  float random(vec2 st) {
    return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453);
  }
  float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    // d = distance from the nozzle along the plane, 0 at the bell, 1 at the far end
    float d = 1.0 - vUv.x;
    // Throttle shortens the flame: everything is measured in "flame lengths"
    float de = d / mix(0.22, 1.0, uThrottle);

    // Turbulence: slow big tongues + fast fine ripples, both scrolling tailward
    float n = noise(vec2(vUv.x * 5.0 + uTime * 3.2, vUv.y * 3.0)) * 0.6
            + noise(vec2(vUv.x * 13.0 + uTime * 6.5, vUv.y * 7.0 + uTime * 1.3)) * 0.4;

    // Cone: tight at the bell, opening as the exhaust expands; tongues grow with distance
    float spread = mix(0.17, 0.62, smoothstep(0.0, 1.0, de)) * mix(0.75, 1.0, uThrottle);
    float wobble = (n - 0.5) * mix(0.02, 0.36, smoothstep(0.0, 1.0, de));
    float r = abs(vUv.y - 0.5 + wobble);
    float core = smoothstep(spread * 0.6, 0.0, r);
    float body = smoothstep(spread, spread * 0.35, r);

    // Axial: the flame proper dies out within the first ~third of the plane
    // (at full throttle), the smoke tail carries on and fades to nothing
    float flame = exp(-de * 2.2) * (1.0 - smoothstep(0.7, 1.05, de));
    float cells = pow(0.5 + 0.5 * cos(de * 55.0), 2.0) * exp(-de * 6.0) * uThrottle;

    vec3 white  = vec3(1.0, 0.98, 0.9);
    vec3 yellow = vec3(1.0, 0.85, 0.45);
    vec3 orange = vec3(1.0, 0.5, 0.14);
    vec3 ember  = vec3(0.8, 0.28, 0.08);
    vec3 smoke  = vec3(0.5, 0.44, 0.44);

    vec3 col = mix(orange, yellow, core);
    col = mix(col, white, core * exp(-de * 4.0));
    col += white * cells * core * 0.6;
    col = mix(col, ember, smoothstep(0.2, 0.6, de) * (1.0 - core * 0.5));
    col = mix(col, smoke, smoothstep(0.5, 1.0, de));

    // Idle look (before the drive-in): the soft pale plume of the original
    // Blender render — a short pink-white glow at the bell, no jet. Blends in
    // as throttle drops.
    vec3 idleCol = mix(vec3(0.95, 0.8, 0.85), vec3(1.0, 0.97, 0.95), core);
    float idle = 1.0 - smoothstep(0.35, 0.9, uThrottle);
    col = mix(col, idleCol, idle);

    float alpha = (body * 0.6 + core * 0.9) * flame * (0.7 + 0.4 * n) * mix(0.35, 1.0, uThrottle);
    alpha *= mix(1.0, 0.8 + 0.2 * (1.0 - n), idle); // calmer at idle
    alpha *= 1.0 - smoothstep(0.82, 1.0, d); // never a hard edge at the plane's end
    alpha *= uFade;
    gl_FragColor = vec4(col * alpha, alpha);
  }
`;

// ---- Textures generated on the client ----------------------------------------

function radialTexture(stops: [number, string][], size = 128) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [at, color] of stops) g.addColorStop(at, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---- Glow sprites: additive halos at the throat and along the first meters ---

// `opacity` is the glow at full presence; Plume scales it by the fade through
// the sprite's userData.
function Glow({ position, size, color, opacity }: { position: [number, number, number]; size: number; color: string; opacity: number }) {
  const map = useMemo(
    () =>
      radialTexture([
        [0, "rgba(255,255,255,1)"],
        [0.25, "rgba(255,255,255,0.55)"],
        [0.6, "rgba(255,255,255,0.12)"],
        [1, "rgba(255,255,255,0)"],
      ]),
    [],
  );
  useEffect(() => () => map.dispose(), [map]);
  return (
    <sprite position={position} scale={[size, size, 1]} userData={{ opacity }}>
      <spriteMaterial map={map} color={color} opacity={opacity} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </sprite>
  );
}

// ---- Smoke: point sprites spawned at the throat, drifting down the trail ----

const SMOKE_COUNT = 220;
const SMOKE_LIFE = 4.2; // seconds
const SMOKE_SPEED = 4.6; // world units / s, drifting to -x

const SMOKE_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute float aHeat;
  uniform float uPixelRatio;
  varying float vAlpha;
  varying float vHeat;
  void main() {
    vAlpha = aAlpha;
    vHeat = aHeat;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixelRatio;
    gl_Position = projectionMatrix * mv;
  }
`;

const SMOKE_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  varying float vAlpha;
  varying float vHeat;
  void main() {
    float a = texture2D(uMap, gl_PointCoord).a * vAlpha;
    // Fresh smoke is lit by the plume (warm); old smoke is cool gray.
    vec3 warm = vec3(0.95, 0.55, 0.32);
    vec3 cool = vec3(0.58, 0.55, 0.60);
    vec3 col = mix(cool, warm, vHeat);
    gl_FragColor = vec4(col * a, a);
  }
`;

type Puff = { age: number; y: number; vy: number; seed: number };

function Smoke({ throttle, fade }: { throttle: { current: number }; fade: { current: number } }) {
  const pixelRatio = useThree((s) => s.gl.getPixelRatio());
  const geom = useRef<THREE.BufferGeometry>(null!);
  const puffs = useRef<Puff[]>([]);

  const map = useMemo(
    () =>
      radialTexture(
        [
          [0, "rgba(255,255,255,0.9)"],
          [0.35, "rgba(255,255,255,0.45)"],
          [0.7, "rgba(255,255,255,0.1)"],
          [1, "rgba(255,255,255,0)"],
        ],
        96,
      ),
    [],
  );
  useEffect(() => () => map.dispose(), [map]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uMap: { value: map }, uPixelRatio: { value: pixelRatio } },
        vertexShader: SMOKE_VERT,
        fragmentShader: SMOKE_FRAG,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
      }),
    [map, pixelRatio],
  );
  useEffect(() => () => material.dispose(), [material]);

  const buffers = useMemo(() => {
    const positions = new Float32Array(SMOKE_COUNT * 3);
    const sizes = new Float32Array(SMOKE_COUNT);
    const alphas = new Float32Array(SMOKE_COUNT);
    const heats = new Float32Array(SMOKE_COUNT);
    // Stagger initial ages so the trail is already populated on first frame
    puffs.current = Array.from({ length: SMOKE_COUNT }, (_, i) => ({
      age: (i / SMOKE_COUNT) * SMOKE_LIFE,
      y: 0,
      vy: 0,
      seed: Math.random(),
    }));
    return { positions, sizes, alphas, heats };
  }, []);

  // `delta` is real elapsed time (SceneClock in hero-rocket-3d.tsx), so the
  // smoke drifts at full speed however few frames the canvas draws.
  useFrame((_, delta) => {
    // Gone: the plume group is hidden, so there is nothing to move.
    if (fade.current === 0) return;
    const { positions, sizes, alphas, heats } = buffers;
    const list = puffs.current;
    for (let i = 0; i < SMOKE_COUNT; i++) {
      const p = list[i];
      p.age += delta;
      if (p.age >= SMOKE_LIFE) {
        p.age %= SMOKE_LIFE;
        p.seed = Math.random();
        p.y = (Math.random() - 0.5) * 0.25;
        p.vy = (Math.random() - 0.5) * 0.5;
      }
      const t = p.age / SMOKE_LIFE; // 0 fresh → 1 gone
      const x = -p.age * SMOKE_SPEED * (0.85 + p.seed * 0.3) - 0.6;
      const y = p.y + p.vy * p.age + Math.sin(p.age * 3.0 + p.seed * 6.28) * 0.12 * t;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = -0.5; // behind the core plane
      // Grows as it cools; fades out over the second half of its life
      sizes[i] = 40 + t * 210;
      alphas[i] = 0.55 * Math.min(1, t * 5.0) * (1 - Math.pow(t, 1.4)) * (0.12 + 0.88 * throttle.current) * fade.current;
      heats[i] = Math.exp(-t * 6.0);
    }
    const g = geom.current;
    if (!g) return;
    (g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.aHeat as THREE.BufferAttribute).needsUpdate = true;
  });

  return (
    <points material={material} frustumCulled={false}>
      <bufferGeometry ref={geom}>
        <bufferAttribute attach="attributes-position" args={[buffers.positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[buffers.sizes, 1]} />
        <bufferAttribute attach="attributes-aAlpha" args={[buffers.alphas, 1]} />
        <bufferAttribute attach="attributes-aHeat" args={[buffers.heats, 1]} />
      </bufferGeometry>
    </points>
  );
}

// ---- Assembly ---------------------------------------------------------------

const IDLE_THROTTLE = 0.3;
const THROTTLE_RATE = 1.4; // 1/s, exponential approach

// Once the rocket has parked the plume fades out to nothing over FADE_S,
// eased in and out, and stays off: the parked rocket only bobs (ADR 0004).
const FADE_S = 1.25;

/**
 * What the engine is doing. One value, so the plume can never be asked to
 * burn full and fade out at once.
 *  - "idle": before the drive-in, the soft idle plume
 *  - "full": the drive-in, full burn
 *  - "out":  parked; the plume fades out, then draws nothing
 */
export type Burn = "idle" | "full" | "out";

/** Ease in and out (smoothstep) of a linear 0..1 fade. */
const eased = (p: number) => p * p * (3 - 2 * p);

type Props = {
  burn: Burn;
  /** Called whenever the plume becomes gone (faded out) or comes back. */
  onGoneChange?: (gone: boolean) => void;
};

export default function Plume({ burn, onGoneChange }: Props) {
  const rootRef = useRef<THREE.Group>(null!);
  const coreRef = useRef<THREE.Mesh>(null!);
  const glowRef = useRef<THREE.Group>(null!);
  const throttle = useRef(burn === "full" ? 1 : IDLE_THROTTLE);
  // Linear fade progress (1 = burning, 0 = gone) and its eased value. A plume
  // that mounts already "out" starts gone: there was no burn to fade.
  const progress = useRef(burn === "out" ? 0 : 1);
  const fade = useRef(progress.current);
  const gone = useRef<boolean | null>(null);
  const coreMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uThrottle: { value: 1 }, uFade: { value: 1 } },
        vertexShader: CORE_VERT,
        fragmentShader: CORE_FRAG,
        transparent: true,
        depthWrite: false,
        // Premultiplied output added 1:1; alpha accumulates for the page composite
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
      }),
    [],
  );
  useEffect(() => () => coreMaterial.dispose(), [coreMaterial]);

  useFrame((state, delta) => {
    // Fade: out once parked, back in if the engine ever lights again.
    const step = delta / FADE_S;
    progress.current =
      burn === "out" ? Math.max(progress.current - step, 0) : Math.min(progress.current + step, 1);
    fade.current = eased(progress.current);
    const nowGone = progress.current === 0;
    if (nowGone !== gone.current) {
      gone.current = nowGone;
      onGoneChange?.(nowGone);
    }
    // Gone: hide the whole plume so it costs no draw calls.
    if (rootRef.current) rootRef.current.visible = !nowGone;
    if (nowGone) return;

    const t = state.clock.elapsedTime;
    // Throttle eases toward its target: full burn on the way in, idle otherwise
    const target = burn === "full" ? 1 : IDLE_THROTTLE;
    throttle.current += (target - throttle.current) * (1 - Math.exp(-delta * THROTTLE_RATE));
    const th = throttle.current;
    coreMaterial.uniforms.uTime.value = t;
    coreMaterial.uniforms.uThrottle.value = th;
    coreMaterial.uniforms.uFade.value = fade.current;
    if (coreRef.current) {
      // Engine breathing: slight flicker in length and width, rougher at idle
      const rough = 1.6 - th * 0.6;
      const flicker = 1 + (Math.sin(t * 9.0) * 0.02 + Math.sin(t * 23.0) * 0.012) * rough;
      coreRef.current.scale.set(flicker, 1 + (flicker - 1) * 1.6, 1);
    }
    if (glowRef.current) {
      const g = 0.5 + 0.5 * th;
      glowRef.current.scale.set(g, g, 1);
      for (const glow of glowRef.current.children) {
        const sprite = glow as THREE.Sprite;
        sprite.material.opacity = (sprite.userData.opacity as number) * fade.current;
      }
    }
  });

  return (
    <group ref={rootRef} visible={progress.current > 0}>
      <Smoke throttle={throttle} fade={fade} />
      <mesh ref={coreRef} position={[-CORE_LENGTH / 2 + 0.4, 0, 0]} material={coreMaterial}>
        <planeGeometry args={[CORE_LENGTH, CORE_HEIGHT]} />
      </mesh>
      {/* Throat glow: the overexposed blob a camera would see at the nozzle */}
      <group ref={glowRef}>
        <Glow position={[-0.4, 0, 0.2]} size={5} color="#ffd9b0" opacity={0.8} />
        <Glow position={[-1.2, 0, 0.2]} size={9} color="#ff7a2a" opacity={0.28} />
        <Glow position={[-4.5, 0, 0.1]} size={10} color="#ff5a1a" opacity={0.14} />
      </group>
    </group>
  );
}
