"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

// Three.js hero stage: cavour.glb horizontal, nose right, matching the static
// render's framing (nose ~95% across, plume trailing to the left edge).
// Idle: hover bob + subtle shake; plume = noise-driven shader (smoke + wave).
// Scroll fly-out stays on the CSS wrapper in hero.tsx.

// Camera: z=11, fov=40, canvas 1480x280 → world width ~42.3, height 8.
const LENGTH = 32; // rocket length in world units (matches the static render)
const HALF = LENGTH / 2;
const X_OFF = 3.2; // shifts nose to ~95% of the canvas width

const REDUCED =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// IBL matching the Blender render's mood: a DARK studio with a few bright
// strips. Metals stay near-black with long specular streaks instead of
// reflecting a white room. Generated on the GPU, no HDR download.
function DarkStudioEnvironment() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const env = new THREE.Scene();
    env.background = new THREE.Color(0x000000);
    // Gradient dome (dark floor → mid-gray sky) so curved metal picks up a
    // smooth sheen everywhere instead of hard panel edges.
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(50, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        vertexShader: `varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `varying vec3 vPos; void main(){ float h = normalize(vPos).y * 0.5 + 0.5; vec3 c = mix(vec3(0.14, 0.145, 0.155), vec3(0.48, 0.51, 0.56), smoothstep(0.0, 1.0, h)); gl_FragColor = vec4(c, 1.0); }`,
      }),
    );
    env.add(sky);
    const strip = (color: number, intensity: number, w: number, h: number, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) }),
      );
      m.position.set(x, y, z);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    strip(0xffffff, 5, 44, 4, 0, 13, 6); // long key strip → streak along the glossy body
    strip(0xbfd0e6, 0.6, 28, 7, -8, -13, 6); // cool fill from below-left
    strip(0xffffff, 0.8, 24, 5, 2, 0, 16); // soft frontal bounce so dark faces stay readable
    strip(0xff8a50, 1.6, 10, 4, 8, 2, -14); // warm kicker behind
    const pmrem = new THREE.PMREMGenerator(gl);
    const tex = pmrem.fromScene(env, 0.03).texture;
    scene.environment = tex;
    return () => {
      scene.environment = null;
      tex.dispose();
      pmrem.dispose();
      env.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry.dispose();
          (mesh.material as THREE.Material).dispose();
        }
      });
    };
  }, [gl, scene]);
  return null;
}

// Plume: one plane behind the bell. uv.x runs 0 (tail) → 1 (bell). Two octaves
// of value noise scroll toward the tail for the smoke wave; color ramps from a
// hot core at the nozzle to the purple-pink smoke of the render.
const PLUME_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const PLUME_FRAG = /* glsl */ `
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
    float axial = vUv.x; // 1 = nozzle end

    // Smoke wave: noise scrolling away from the bell (toward -x)
    float n = noise(vec2(vUv.x * 6.0 + uTime * 2.2, vUv.y * 3.0)) * 0.6
            + noise(vec2(vUv.x * 14.0 + uTime * 4.5, vUv.y * 7.0 + uTime * 0.8)) * 0.4;

    // Radial falloff: tight at the bell, wide and wobbly at the tail
    float spread = mix(0.5, 0.16, axial);
    float wobble = (n - 0.5) * mix(0.35, 0.05, axial);
    float r = abs(vUv.y - 0.5 + wobble);
    float body = smoothstep(spread, spread * 0.25, r);

    // Bright at the bell, fading down the tail
    float axialFade = pow(axial, 1.6);

    vec3 hot = vec3(1.0, 0.88, 0.72);
    vec3 smoke = vec3(0.63, 0.42, 0.93);
    vec3 col = mix(smoke, hot, pow(axial, 3.0));

    float alpha = body * axialFade * (0.62 + 0.45 * n);
    gl_FragColor = vec4(col * alpha, alpha);
  }
`;

const RUMBLE_DECAY_S = 7; // matches the drive-in duration

function Rocket({ rumbling }: { rumbling: boolean }) {
  const group = useRef<THREE.Group>(null!);
  const plumeRef = useRef<THREE.Mesh>(null!);
  const rumbleStart = useRef<number | null>(null);
  const { scene } = useGLTF("/design/cavour.glb");

  const plumeMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: PLUME_VERT,
        fragmentShader: PLUME_FRAG,
        transparent: true,
        // Shader outputs premultiplied color; add it 1:1 and accumulate alpha
        // so the transparent canvas composites over the page correctly.
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
        depthWrite: false,
      }),
    [],
  );
  useEffect(() => () => plumeMaterial.dispose(), [plumeMaterial]);

  // Normalize whatever axes/scale the GLB ships with: longest axis becomes
  // the rocket's length, laid horizontally along +X (nose right), centered.
  const normalized = useMemo(() => {
    const clone = scene.clone(true);
    // The GLB carries PlumeMid/PlumeOuter meshes meant for Blender renders;
    // they come out flat white here and stretch the bounding box. Drop them —
    // the live plume is the shader plane below.
    const plumes: THREE.Object3D[] = [];
    clone.traverse((o) => {
      if (/plume/i.test(o.name)) plumes.push(o);
    });
    plumes.forEach((o) => o.parent?.remove(o));
    // Material polish toward the Blender render: glossier metal so the env
    // strips streak across the fins instead of averaging to flat gray.
    clone.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (!mat?.isMeshStandardMaterial) return;
      if (mat.name === "Aluminium") {
        mat.roughness = 0.4;
        mat.envMapIntensity = 0.95;
      } else if (mat.name === "Titanium") {
        mat.roughness = 0.4;
        mat.envMapIntensity = 1.2;
      } else if (mat.name === "Livery" || mat.name === "Seam") {
        mat.roughness = 0.3;
        mat.envMapIntensity = 1.25;
      }
    });
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const longest = Math.max(size.x, size.y, size.z);
    clone.position.set(
      -box.min.x - size.x / 2,
      -box.min.y - size.y / 2,
      -box.min.z - size.z / 2,
    );
    const holder = new THREE.Group();
    holder.add(clone);
    if (longest === size.z) {
      holder.rotation.y = Math.PI / 2; // length along Z → X
    } else if (longest === size.y) {
      holder.rotation.z = -Math.PI / 2; // length along Y → X
    }
    return { object: holder, scale: LENGTH / longest };
  }, [scene]);

  useFrame((state) => {
    if (!group.current || REDUCED) return;
    const t = state.clock.elapsedTime;

    // Hover drift: gentle bob, ±0.45 world units (~16px) over ~6s
    group.current.position.y = Math.sin(t * 1.05) * 0.45;

    // Starship rumble while driving in: gentle structural shudder that dies
    // down over the ride and ends still. Idle stays calm.
    if (rumbling) {
      if (rumbleStart.current === null) rumbleStart.current = t;
      const elapsed = t - rumbleStart.current;
      const k = Math.max(0, 1 - elapsed / RUMBLE_DECAY_S) ** 2; // fade to 0
      group.current.position.y += (Math.sin(t * 57) * 0.03 + Math.sin(t * 23) * 0.027) * k;
      group.current.position.x = X_OFF + Math.sin(t * 43) * 0.033 * k;
      group.current.rotation.z = Math.sin(t * 31) * 0.002 * k;
    } else {
      rumbleStart.current = null;
      group.current.position.x = X_OFF;
      group.current.rotation.z = 0;
    }

    // Plume: noise scroll + slow breathing
    plumeMaterial.uniforms.uTime.value = t;
    if (plumeRef.current) {
      const breathe = 1 + Math.sin(t * 2.4) * 0.05;
      plumeRef.current.scale.set(breathe, breathe, 1);
    }
  });

  return (
    <group ref={group} position={[X_OFF, 0, 0]}>
      <group scale={normalized.scale}>
        <primitive object={normalized.object} />
      </group>
      <mesh ref={plumeRef} position={[-HALF - 5.6, 0, 0]} material={plumeMaterial}>
        <planeGeometry args={[13, 3.8]} />
      </mesh>
    </group>
  );
}

// No static fallback by decision 0004: if WebGL is unavailable the hero is
// just the type — nothing renders here.
function webglSupported() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function HeroRocket3D({ rumbling = false }: { rumbling?: boolean }) {
  const [supported, setSupported] = useState(false);
  const [visible, setVisible] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSupported(webglSupported());
    const el = wrapRef.current;
    if (!el) return;
    // Render only while the hero is on screen; pause offscreen.
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="relative h-full w-full">
      {supported && visible && (
        <div className="absolute inset-0">
          <Canvas
            dpr={[1, 2]}
            // The wrapper animates transforms (rotation!) — measure the layout
            // box, not the transformed bounding rect, or the canvas mis-sizes.
            resize={{ offsetSize: true }}
            gl={{ alpha: true, antialias: true }}
            // Orthographic like the Blender render — a close wide-angle lens
            // distorts a 32-unit rocket badly. zoom 35 px/unit → 42.3x8 world view.
            orthographic
            camera={{ zoom: 35, position: [0, 0, 60], near: 0.1, far: 200 }}
          >
            <DarkStudioEnvironment />
            {/* Faint direct light for diffuse shape; the dark IBL does the rest */}
            <ambientLight intensity={0.3} />
            <directionalLight position={[6, 8, 10]} intensity={1.4} />
            <directionalLight position={[-8, -3, 6]} intensity={0.5} color="#C8CEDA" />
            <Suspense fallback={null}>
              <Rocket rumbling={rumbling} />
            </Suspense>
          </Canvas>
        </div>
      )}
    </div>
  );
}
