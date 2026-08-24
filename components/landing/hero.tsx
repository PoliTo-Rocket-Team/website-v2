"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Starfield } from "./starfield";

const HeroRocket3D = dynamic(() => import("./hero-rocket-3d"), { ssr: false });

// Hero choreography per .decisions/0004 (no pinning):
//   enter   — title + slogan lightly separated (board 04 idle), words stagger in
//   drive   — rocket climbs in from lower-left OVER the type at ~22°, leveling
//             out as it decelerates; text holds still so eyes stay on the rocket
//   settled — only now the type drifts that last bit apart; copy fades in
//   liftoff — one-shot: past ~18% scroll the rocket accelerates out up-right
//   gone    — rocket left; when the hero is fully visible again, replay
type Phase = "enter" | "drive" | "settled" | "liftoff" | "gone";

const HOLD_MS = 2000; // gathered hold before the rocket appears
const DRIVE_MS = 7000; // rocket drive-in duration (Starship pace)
const LIFTOFF_MS = 1800;
const LIFTOFF_SCROLL = 0.18; // fraction of hero height
const REPLAY_SCROLL = 40; // px — hero counts as "fully visible" again

// Gathered offsets from final positions, matching board 04's no-rocket idle:
// already separated, just less — the final split is a small, calm move.
const TITLE_GATHER_Y = 80;
const SLOGAN_GATHER_Y = -26;

export function Hero() {
  const [phase, setPhase] = useState<Phase>("enter");
  const [cycle, setCycle] = useState(0); // remount key → restarts CSS animations
  const [reduced, setReduced] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReduced(true);
      setPhase("settled");
    }
  }, []);

  // Phase timers
  useEffect(() => {
    if (reduced) return;
    if (phase === "enter") {
      const t = setTimeout(() => setPhase("drive"), HOLD_MS);
      return () => clearTimeout(t);
    }
    if (phase === "drive") {
      const t = setTimeout(() => setPhase("settled"), DRIVE_MS);
      return () => clearTimeout(t);
    }
    if (phase === "liftoff") {
      const t = setTimeout(() => setPhase("gone"), LIFTOFF_MS);
      return () => clearTimeout(t);
    }
  }, [phase, reduced]);

  // Scroll: one-shot lift-off past the threshold; replay once fully back
  useEffect(() => {
    if (reduced) return;
    const onScroll = () => {
      const h = sectionRef.current?.offsetHeight ?? 900;
      const p = phaseRef.current;
      if (window.scrollY > h * LIFTOFF_SCROLL && (p === "drive" || p === "settled")) {
        setPhase("liftoff");
      } else if (window.scrollY < REPLAY_SCROLL && p === "gone") {
        setCycle((c) => c + 1);
        setPhase("enter");
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [reduced]);

  // Text holds its gathered spot through the whole flight; splits at the end.
  const gathered = phase === "enter" || phase === "drive";
  const copyVisible = !gathered; // body/hairline/strip fade in with the split

  return (
    <section ref={sectionRef} className="relative flex h-screen max-h-[900px] justify-center overflow-hidden bg-ground">
      <div key={cycle} className="relative h-[900px] w-[1440px] shrink-0">
        {/* Earth: (-180, 300) 1800x1013 */}
        <div className="absolute left-[-180px] top-[300px] h-[1013px] w-[1800px]">
          <Image src="/design/earth-limb.jpg" alt="" fill priority sizes="1800px" className="object-cover" />
        </div>

        {/* Soft blend over the earth image's hard top edge (behind the slogan) */}
        <div
          className="absolute left-0 top-[300px] h-[220px] w-full"
          style={{ background: "linear-gradient(to bottom, #0B0B0C, #0B0B0C00)" }}
        />

        {/* Scrim: #0B0B0C66 → #0B0B0C1A 45% → #0B0B0CB3 80% → #0B0B0C */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, #0B0B0C66 0%, #0B0B0C1A 45%, #0B0B0CB3 80%, #0B0B0C 100%)",
          }}
        />

        {/* Starfield: 1440x560, top */}
        <div className="absolute left-0 top-0 h-[560px] w-[1440px]">
          <Starfield count={42} seed={7} className="h-full" />
        </div>

        {/* Title: final y120; gathered = pushed down toward the rocket band */}
        <h1
          className="absolute left-16 top-[120px] w-[1312px] text-center font-extrabold leading-[0.89] tracking-[-2.8px] text-prt-text transition-transform duration-[2400ms] ease-[cubic-bezier(0.45,0,0.15,1)]"
          style={{ fontSize: 90, transform: gathered ? `translateY(${TITLE_GATHER_Y}px)` : "translateY(0)" }}
        >
          {["POLITO", "ROCKET", "TEAM"].map((word, i) => (
            <span key={word}>
              <span
                className={`inline-block ${reduced ? "" : "animate-word-up motion-reduce:animate-none"}`}
                style={{ animationDelay: `${i * 75}ms` }}
              >
                {word}
              </span>
              {i < 2 ? " " : ""}
            </span>
          ))}
        </h1>

        {/* Slogan: final y464; gathered = pulled up a touch */}
        <p
          className="absolute left-16 top-[464px] w-[1312px] text-[148px] font-extrabold leading-[0.89] tracking-[-5.2px] text-prt-text transition-transform duration-[2400ms] ease-[cubic-bezier(0.45,0,0.15,1)]"
          style={{ transform: gathered ? `translateY(${SLOGAN_GATHER_Y}px)` : "translateY(0)" }}
        >
          <span
            className={`inline-block ${reduced ? "" : "animate-slogan-down motion-reduce:animate-none"}`}
            style={{ animationDelay: "450ms" }}
          >
            BORN FOR SPACE
          </span>
        </p>

        {/* Rocket: (-60, 204) 1480x280 — rendered AFTER both text lines so the
            angled fly-in passes over them (depth). Drive-in sits inside the
            lift-off layer. Mounted (parked offscreen) during the hold so the
            GLB and shaders are warm before the flight starts. */}
        {!reduced && (
          <div
            className={`pointer-events-none absolute left-[-60px] top-[204px] h-[280px] w-[1480px] will-change-transform ${
              phase === "liftoff" || phase === "gone" ? "animate-rocket-liftoff" : ""
            }`}
          >
            <div
              className={`h-full w-full ${phase === "enter" ? "" : "animate-rocket-drive-in"}`}
              style={phase === "enter" ? { transform: "translate(-68vw, 24vh) rotate(-22deg)" } : undefined}
            >
              <HeroRocket3D rumbling={phase === "drive"} />
            </div>
          </div>
        )}

        {/* Body: (64, 644) 600 wide */}
        <p
          className={`absolute left-16 top-[644px] w-[600px] text-[22px] leading-[1.3] text-prt-text ${
            copyVisible ? "animate-hero-fade" : "opacity-0"
          }`}
          style={{ animationDelay: "600ms" }}
        >
          The rocket engineering student team of Politecnico di Torino, Italy. 150+ undergraduate,
          graduate and PhD students researching, designing and building rocket engines and
          experimental rockets with scientific payloads.
        </p>

        {/* Hairline + fact strip */}
        <div
          className={`absolute left-16 top-[815px] h-px w-[1312px] bg-hairline ${copyVisible ? "animate-hero-fade" : "opacity-0"}`}
          style={{ animationDelay: "700ms" }}
        />
        <p
          className={`absolute left-16 top-[852px] font-mono text-[11px] tracking-[1.5px] text-prt-muted ${
            copyVisible ? "animate-hero-fade" : "opacity-0"
          }`}
          style={{ animationDelay: "700ms" }}
        >
          EST. 2021 · TORINO, ITALY&nbsp;&nbsp;&nbsp;&nbsp; IREC 2025 · 1ST DESIGN &amp; BUILD
          &nbsp;&nbsp;&nbsp;&nbsp; EUROC 2024 · 4TH VEHICLE
        </p>
      </div>
    </section>
  );
}
