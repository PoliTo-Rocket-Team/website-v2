"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import Plume from "./hero-plume";
import { applyWeathering, PROFILES, type WeatherUniforms } from "./hero-weathering";

// Three.js hero stage: cavour.glb horizontal, nose right, matching the static
// render's framing (nose ~95% across, plume trailing to the left edge).
// Idle: hover bob only (decision 0004: no shake); plume lives in hero-plume.tsx.
// Scroll fly-out stays on the CSS wrapper in hero.tsx.

// Canvas 2400x280, centred where the old 1480px stage was: ~750px of room
// behind the nozzle for the plume. World view: 8 units tall, ~68.6 wide.
const LENGTH = 32; // rocket length in world units (matches the static render)
const HALF = LENGTH / 2;
const X_OFF = 3.2; // shifts nose to ~95% of the canvas width

const REDUCED =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// IBL: a real small-studio HDRI (Poly Haven, CC0). Real softboxes and
// falloff give the metals proper streaks and the orange paint a believable
// sheen — the previous hand-built strip environment read flat and cartoony.
const HDRI = "/design/hdri/studio_small_03.hdr";

// The GLB's fins are single-sided sheets with zero thickness, so from the
// side they vanish into a line. Extrude each sheet into a plate: a front
// and back copy offset along the sheet normal, plus walls along every
// boundary edge. Flat per-face normals so the edges read as machined.
// (No fillet: a rounded rim mirrors the environment and shifts the fin's
// color as the rocket bobs.)
const FIN_THICKNESS_OF_SPAN = 0.026;
function extrudeSheet(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = mergeVertices(source.index ? source : source.clone());
  g.computeBoundingBox();
  const size = g.boundingBox!.getSize(new THREE.Vector3());
  const axes = [size.x, size.y, size.z];
  const thin = axes.indexOf(Math.min(...axes));
  const span = Math.max(...axes);
  const half = (span * FIN_THICKNESS_OF_SPAN) / 2;
  const n = new THREE.Vector3(thin === 0 ? 1 : 0, thin === 1 ? 1 : 0, thin === 2 ? 1 : 0);

  const pos = g.attributes.position as THREE.BufferAttribute;
  const idx = g.index!;
  const P = (i: number) => new THREE.Vector3().fromBufferAttribute(pos, i);
  const front = (i: number) => P(i).addScaledVector(n, half);
  const back = (i: number) => P(i).addScaledVector(n, -half);

  const out: number[] = [];
  const push = (...v: THREE.Vector3[]) => v.forEach((p) => out.push(p.x, p.y, p.z));
  const edgeCount = new Map<string, number>();
  const edges: [number, number][] = [];
  for (let t = 0; t < idx.count; t += 3) {
    const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2);
    push(front(a), front(b), front(c));
    push(back(a), back(c), back(b));
    for (const [u, v] of [[a, b], [b, c], [c, a]] as [number, number][]) {
      const key = u < v ? `${u}_${v}` : `${v}_${u}`;
      edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
      edges.push([u, v]);
    }
  }
  for (const [u, v] of edges) {
    const key = u < v ? `${u}_${v}` : `${v}_${u}`;
    if (edgeCount.get(key) !== 1) continue; // interior edge
    push(front(u), front(v), back(v));
    push(front(u), back(v), back(u));
  }
  const plate = new THREE.BufferGeometry();
  plate.setAttribute("position", new THREE.Float32BufferAttribute(out, 3));
  plate.computeVertexNormals();
  return plate;
}

function Rocket({ fullBurn }: { fullBurn: boolean }) {
  const group = useRef<THREE.Group>(null!);
  const { scene } = useGLTF("/design/cavour.glb");
  const weather = useMemo<WeatherUniforms>(
    () => ({
      uRocketPos: { value: new THREE.Vector3(X_OFF, 0, 0) },
      uSootStart: { value: -HALF + 9 },
      uTail: { value: -HALF - 0.5 },
    }),
    [],
  );

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
    // Materials: matte, worn surfaces instead of the GLB's showroom finish.
    // Fins and bell lip ship fully metallic on a dark base, which under an
    // HDRI is nothing but a reflection of the studio — pulled toward dull
    // brushed metal. The paint keeps a faint clearcoat. Then procedural
    // wear (scuffs, streaks, soot toward the nozzle) goes on everything.
    const seen = new Set<THREE.Material>();
    clone.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (/^fin\d/i.test(mesh.name)) {
        mesh.geometry = extrudeSheet(mesh.geometry);
        (mesh.material as THREE.Material).side = THREE.DoubleSide;
      }
      const mat = mesh.material as THREE.MeshPhysicalMaterial;
      if (!mat?.isMeshStandardMaterial || seen.has(mat)) return;
      seen.add(mat);
      if (mat.name === "Aluminium") {
        // Dark anodized aluminium: a step lighter than the body's black,
        // dull rather than brushed so nothing flashes as the view shifts
        mat.color.setRGB(0.14, 0.145, 0.155);
        mat.metalness = 0.6;
        mat.roughness = 0.72;
        mat.envMapIntensity = 0.3;
        applyWeathering(mat, PROFILES.metal, weather);
      } else if (mat.name === "Titanium") {
        mat.color.setRGB(0.16, 0.165, 0.17);
        mat.metalness = 0.6;
        mat.roughness = 0.7;
        mat.envMapIntensity = 0.35;
        applyWeathering(mat, PROFILES.metal, weather);
      } else if (mat.name === "Livery" || mat.name === "DecalStrip") {
        mat.roughness = 0.62;
        if ("clearcoat" in mat) {
          mat.clearcoat = 0.12;
          mat.clearcoatRoughness = 0.65;
        }
        mat.envMapIntensity = 0.28;
        applyWeathering(mat, PROFILES.paint, weather);
      } else if (mat.name === "Seam") {
        mat.roughness = 0.7;
        mat.envMapIntensity = 0.5;
        applyWeathering(mat, PROFILES.trim, weather);
      } else if (mat.name === "Decal White") {
        mat.roughness = 0.6;
        mat.envMapIntensity = 0.55;
        applyWeathering(mat, PROFILES.paint, weather);
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
  }, [scene, weather]);

  useFrame((state) => {
    if (!group.current || REDUCED) return;
    const t = state.clock.elapsedTime;

    // Hover drift: barely-there, ±0.15 world units (~5px) over ~9s.
    // Enough to keep the rocket from reading as a sticker, never a bounce.
    group.current.position.y = Math.sin(t * 0.7) * 0.15;

    // Keep the procedural wear pinned to the hull while the group moves
    weather.uRocketPos.value.copy(group.current.position);
  });

  return (
    <group ref={group} position={[X_OFF, 0, 0]}>
      <group scale={normalized.scale}>
        <primitive object={normalized.object} />
      </group>
      <group position={[-HALF, 0, 0]}>
        <Plume fullBurn={fullBurn} />
      </group>
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

export default function HeroRocket3D({ fullBurn = false }: { fullBurn?: boolean }) {
  const [supported, setSupported] = useState(false);
  const [visible, setVisible] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSupported(webglSupported());
    const el = wrapRef.current;
    if (!el) return;
    // Keep the canvas mounted; only pause the frame loop while offscreen so
    // scrolling back shows the last frame, not a fresh reload.
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="relative h-full w-full">
      {supported && (
        <div className="absolute inset-0">
          <Canvas
            frameloop={visible ? "always" : "never"}
            dpr={[1, 2]}
            // The wrapper animates transforms (rotation!) — measure the layout
            // box, not the transformed bounding rect, or the canvas mis-sizes.
            resize={{ offsetSize: true }}
            gl={{ alpha: true, antialias: true }}
            shadows="soft"
            // Long lens: a 14° vertical fov from ~33 units back frames the same
            // 42x8 world window the orthographic setup did, but with the faint
            // foreshortening of a 200mm photo instead of a diagram's flatness.
            camera={{ fov: 14, position: [0, 0, 32.6], near: 1, far: 200 }}
          >
            <Environment files={HDRI} environmentIntensity={0.45} environmentRotation={[-Math.PI / 2, 0, 0]} />
            {/* Sun sits on the camera side, a little high: the screen-facing
                half is lit, shadows fall away behind the rocket, so no angle
                management. The HDRI adds the broad soft sheen. */}
            <ambientLight intensity={0.12} />
            <directionalLight
              position={[3, 4, 26]}
              intensity={2.1}
              castShadow
              shadow-mapSize={[2048, 2048]}
              shadow-bias={-0.0002}
              shadow-normalBias={0.02}
              shadow-camera-left={-24}
              shadow-camera-right={24}
              shadow-camera-top={8}
              shadow-camera-bottom={-8}
              shadow-camera-near={1}
              shadow-camera-far={80}
            />
            <directionalLight position={[-6, -5, 8]} intensity={0.04} color="#9FB0C8" />
            <directionalLight position={[10, 3, -8]} intensity={0.6} color="#FFD2B0" />
            <Suspense fallback={null}>
              <Rocket fullBurn={fullBurn} />
            </Suspense>
          </Canvas>
        </div>
      )}
    </div>
  );
}
