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

const CORE_LENGTH = 14;
const CORE_HEIGHT = 4.2;

const CORE_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CORE_FRAG = /* glsl */ `
  uniform float uTime;
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
    // d = distance from the nozzle, 0 at the bell, 1 at the far tail
    float d = 1.0 - vUv.x;

    // Turbulence scrolling away from the bell; finer near the nozzle
    float n = noise(vec2(vUv.x * 7.0 + uTime * 2.6, vUv.y * 3.5)) * 0.6
            + noise(vec2(vUv.x * 16.0 + uTime * 5.0, vUv.y * 8.0 + uTime * 0.9)) * 0.4;

    // Radius: pencil-thin at the bell, opening into the tail
    float spread = mix(0.16, 0.46, d);
    float wobble = (n - 0.5) * mix(0.03, 0.26, d);
    float r = abs(vUv.y - 0.5 + wobble);
    float core = smoothstep(spread * 0.55, spread * 0.05, r);
    float halo = smoothstep(spread, spread * 0.25, r);

    // Shock diamonds: bright cells along the axis, dying out after ~1/4 length
    float cells = pow(0.5 + 0.5 * cos(d * 48.0), 2.0) * exp(-d * 5.0);

    // Intensity along the axis: hottest at the bell
    float axialFade = exp(-d * 3.2);

    vec3 white  = vec3(1.0, 0.98, 0.92);
    vec3 blue   = vec3(0.72, 0.84, 1.0);
    vec3 orange = vec3(1.0, 0.46, 0.12);
    vec3 ember  = vec3(0.85, 0.30, 0.10);
    vec3 smoke  = vec3(0.50, 0.44, 0.46);

    vec3 col = mix(orange, white, core);
    col = mix(col, blue, exp(-d * 12.0) * 0.45 * core); // blue tinge at the throat
    col += white * cells * core * 0.7;
    col = mix(col, ember, smoothstep(0.15, 0.5, d) * (1.0 - core));
    col = mix(col, smoke, smoothstep(0.4, 1.0, d));

    float alpha = (halo * 0.5 + core * 0.9) * axialFade * (0.65 + 0.45 * n);
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
    <sprite position={position} scale={[size, size, 1]}>
      <spriteMaterial map={map} color={color} opacity={opacity} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </sprite>
  );
}

// ---- Smoke: point sprites spawned at the throat, drifting down the trail ----

const SMOKE_COUNT = 140;
const SMOKE_LIFE = 2.4; // seconds
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

function Smoke() {
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

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const { positions, sizes, alphas, heats } = buffers;
    const list = puffs.current;
    for (let i = 0; i < SMOKE_COUNT; i++) {
      const p = list[i];
      p.age += dt;
      if (p.age >= SMOKE_LIFE) {
        p.age -= SMOKE_LIFE;
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
      alphas[i] = 0.55 * Math.min(1, t * 5.0) * (1 - Math.pow(t, 1.4));
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

export default function Plume() {
  const coreRef = useRef<THREE.Mesh>(null!);
  const coreMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
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

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    coreMaterial.uniforms.uTime.value = t;
    if (coreRef.current) {
      // Engine breathing: slight flicker in length and width
      const flicker = 1 + Math.sin(t * 9.0) * 0.02 + Math.sin(t * 23.0) * 0.012;
      coreRef.current.scale.set(flicker, 1 + (flicker - 1) * 1.6, 1);
    }
  });

  return (
    <group>
      <Smoke />
      <mesh ref={coreRef} position={[-CORE_LENGTH / 2 + 0.4, 0, 0]} material={coreMaterial}>
        <planeGeometry args={[CORE_LENGTH, CORE_HEIGHT]} />
      </mesh>
      {/* Throat glow: the overexposed blob a camera would see at the nozzle */}
      <Glow position={[-0.4, 0, 0.2]} size={5} color="#ffd9b0" opacity={0.8} />
      <Glow position={[-1.2, 0, 0.2]} size={9} color="#ff7a2a" opacity={0.28} />
      <Glow position={[-4.5, 0, 0.1]} size={10} color="#ff5a1a" opacity={0.14} />
    </group>
  );
}
