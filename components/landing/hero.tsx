"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Starfield } from "./starfield";

const HeroRocket3D = dynamic(() => import("./hero-rocket-3d"), { ssr: false });

// Hero choreography per .decisions/0004 (no pinning). Title + slogan start
// gathered (close together where the rocket will park) and part at the
// rocket's own pace as it drives in.
//   enter   — words stagger in, type gathered
//   drive   — rocket climbs in from off-screen lower-left OVER the type,
//             decelerating, nose easing from 14° to 6° up; parks at 6°.
//             Title rises and slogan drops on the same curve to make room
//   settled — copy fades in
// The entrance plays once per page load; there is no scroll lift-off.
type Phase = "enter" | "drive" | "settled";

const HOLD_MS = 2000; // gathered hold before the rocket appears
const TITLE_GATHER_Y = 64; // px the title sits lower while gathered
const SLOGAN_GATHER_Y = -96; // px the slogan sits higher while gathered
const DRIVE_MS = 7000; // rocket drive-in duration (Starship pace)

// Board fit, as CSS vars so the inline <script> below can set them before the
// SSR'd hero ever paints (no unscaled flash on load):
//   --hero-scale  downscale-only board zoom: min(1, vw/1440, vh/900)
//   --hero-h      section height: the viewport height, clamped between the
//                 scaled board (900·s) and the scaled stretch cap (1080·s) —
//                 so a width-limited scale still fills the screen vertically
//                 by stretching the board, never by showing the next section
const applyHeroVars = () => {
  const s = Math.min(1, window.innerWidth / 1440, window.innerHeight / 900);
  const h = Math.min(Math.max(window.innerHeight, 900 * s), 1080 * s);
  const style = document.documentElement.style;
  style.setProperty("--hero-scale", String(s));
  style.setProperty("--hero-h", `${h}px`);
};
// Same logic, inlined into the HTML stream (runs during parse, pre-paint).
const HERO_VARS_SCRIPT =
  "(function(){var s=Math.min(1,innerWidth/1440,innerHeight/900);" +
  "var h=Math.min(Math.max(innerHeight,900*s),1080*s);" +
  "var t=document.documentElement.style;" +
  "t.setProperty('--hero-scale',String(s));t.setProperty('--hero-h',h+'px')})()";
const HERO_H = "var(--hero-h, min(100vh, 1080px))";
// Earth + its fades span the whole viewport (in stage coordinates, so ÷ scale)
// — on ultra-wide screens the photo zooms up and the limb arc continues to the
// edges instead of ending in a hard vertical cut. Never below the design 1800.
const EARTH_W = "max(1800px, calc(100vw / var(--hero-scale, 1)))";
// Soft sky-colored fade rendered behind white type: invisible on the black
// sky, it just dims the stars behind the glyphs so none reads as a defect.
const TEXT_FADE = "radial-gradient(ellipse 50% 50% at 50% 50%, #010101 35%, #01010100 72%)";

export function Hero() {
  const [phase, setPhase] = useState<Phase>("enter");
  const [reduced, setReduced] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReduced(true);
      setPhase("settled");
    }
  }, []);

  // Keep the fit vars fresh on resize (initial values come from the inline
  // script; this also covers client-side navigations to this page).
  useEffect(() => {
    applyHeroVars();
    window.addEventListener("resize", applyHeroVars);
    return () => window.removeEventListener("resize", applyHeroVars);
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
  }, [phase, reduced]);

  // Body/hairline/strip stay hidden until the rocket has settled.
  const copyVisible = phase !== "enter" && phase !== "drive";

  // Title/slogan: gathered while entering, then part on the drive-in curve.
  // The animation fills forward, so they stay put once settled.
  const gathered = !reduced && phase === "enter";
  const separateClass = reduced || phase === "enter" ? "" : "animate-hero-separate";
  const separateStyle = (gatherY: number): React.CSSProperties => ({
    ["--gather-y" as string]: `${gatherY}px`,
    transform: gathered ? `translateY(${gatherY}px)` : undefined,
  });

  return (
    <section
      ref={sectionRef}
      className="relative flex justify-center overflow-hidden"
      // #010101 = the earth photo's measured sky color, so the sky above/beside
      // the photo is identical to the photo's own black (bg-ground would read
      // a touch grayer); the scrim still ends solid ground color at the bottom
      style={{ height: HERO_H, background: "#010101" }}
    >
      <script dangerouslySetInnerHTML={{ __html: HERO_VARS_SCRIPT }} />
      {/* Stage fills the section; on viewports taller than the 900px board the
          extra height opens up between the top-anchored title and the
          bottom-anchored slogan/copy block — type never scales. On smaller
          screens the fixed 900px board is scaled down to fit instead: its
          unscaled height (--hero-h / --hero-scale) is then exactly 900px. */}
      <div
        className="relative w-[1440px] shrink-0"
        style={{
          height: `calc(${HERO_H} / var(--hero-scale, 1))`,
          transform: "scale(var(--hero-scale, 1))",
          transformOrigin: "top center",
        }}
      >
        {/* Earth: (-180, 300) 1800x1013 on the 900 board — bottom-anchored so
            the horizon keeps its distance to the slogan on taller viewports.
            object-top keeps the limb pinned to the container's top when the
            photo zooms to cover ultra-wide viewports. */}
        <div
          className="absolute bottom-[-413px] left-1/2 h-[1013px] -translate-x-1/2"
          style={{ width: EARTH_W }}
        >
          {/* earth-limb-sym.jpg = the photo's left half mirrored at the arc
              peak (scripted from earth-limb.jpg), so the limb arc is
              symmetric around the center */}
          <Image src="/design/earth-limb-sym.jpg" alt="" fill priority sizes="100vw" className="object-cover object-top" />
        </div>

        {/* Soft blend over the earth image's hard top edge (behind the slogan) */}
        <div
          className="absolute bottom-[380px] left-1/2 h-[220px] -translate-x-1/2"
          style={{ width: EARTH_W, background: "linear-gradient(to bottom, #010101, #01010100)" }}
        />

        {/* Scrim, anchored from the bottom (px stops = design's 100%/80%/45%
            of the 900 board); above 900px from the bottom it holds the light
            #0B0B0C66 wash the design has at the top */}
        <div
          className="absolute left-1/2 top-0 h-full -translate-x-1/2"
          style={{
            width: EARTH_W,
            background:
              "linear-gradient(to top, #0B0B0C 0px, #0B0B0CB3 180px, #0B0B0C1A 495px, #0B0B0C66 900px)",
          }}
        />

        {/* Starfield: the whole sky — full earth width, from the top down to
            100px past the earth photo's top edge (at 100% − 600px), so the CSS
            stars blend into the photo's own faint stars with no clean band */}
        <div
          className="absolute left-1/2 top-0 -translate-x-1/2"
          style={{ width: EARTH_W, height: "calc(100% - 500px)" }}
        >
          <Starfield count={90} seed={7} className="h-full" />
          {/* dense dust layer: hundreds of sub-pixel stars matching the earth
              photo's faint speckle (twinkleEvery 0 = no twinkle) */}
          <Starfield count={280} seed={13} twinkleEvery={0} sizeMin={0.5} sizeMax={1.2} dimOpacity={0.22} className="h-full" />
        </div>

        {/* Title: y180 */}
        <h1
          className={`absolute left-16 top-[180px] w-[1312px] text-center font-extrabold leading-[0.89] tracking-[-2.8px] text-prt-text ${separateClass}`}
          style={{ fontSize: 90, ...separateStyle(TITLE_GATHER_Y) }}
        >
          {/* star-dimming fade behind the glyphs; moves with the title */}
          <span
            aria-hidden
            className="absolute left-1/2 top-1/2 -z-10 h-[280px] w-[1380px] -translate-x-1/2 -translate-y-1/2"
            style={{ background: TEXT_FADE }}
          />
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

        {/* Lower block, bottom-anchored: slogan y464 → strip y852 on the 900
            board = a 436px-tall band pinned to the bottom edge */}
        <div className="absolute bottom-0 left-0 h-[436px] w-full">
          {/* Slogan */}
          <p
            className={`absolute left-16 top-0 w-[1312px] text-[148px] font-extrabold leading-[0.89] tracking-[-5.2px] text-prt-text ${separateClass}`}
            style={separateStyle(SLOGAN_GATHER_Y)}
          >
            <span
              className={`inline-block ${reduced ? "" : "animate-slogan-down motion-reduce:animate-none"}`}
              style={{ animationDelay: "450ms" }}
            >
              BORN FOR SPACE
            </span>
          </p>

          {/* Body: (64, 644) on the board → 180 below the slogan */}
          <p
            className={`absolute left-16 top-[180px] w-[600px] text-[22px] leading-[1.3] text-prt-text ${
              copyVisible ? "animate-hero-fade" : "opacity-0"
            }`}
            style={{ animationDelay: "600ms" }}
          >
            The rocket engineering student team of Politecnico di Torino, Italy. 150+ undergraduate,
            graduate and PhD students researching, designing and building rocket engines and
            experimental rockets with scientific payloads.
          </p>

          {/* Hairline + fact strip: y815 / y852 on the board */}
          <div
            className={`absolute left-16 top-[351px] h-px w-[1312px] bg-hairline ${copyVisible ? "animate-hero-fade" : "opacity-0"}`}
            style={{ animationDelay: "700ms" }}
          />
          <p
            className={`absolute left-16 top-[388px] font-mono text-[11px] tracking-[1.5px] text-prt-muted ${
              copyVisible ? "animate-hero-fade" : "opacity-0"
            }`}
            style={{ animationDelay: "700ms" }}
          >
            EST. 2021 · TORINO, ITALY&nbsp;&nbsp;&nbsp;&nbsp; IREC 2025 · 1ST DESIGN &amp; BUILD
            &nbsp;&nbsp;&nbsp;&nbsp; EUROC 2024 · 4TH VEHICLE
          </p>
        </div>

        {/* Rocket: (-60, 204) 1480x280 on the board, canvas widened to 2400
            around the same centre so the plume has room behind the nozzle —
            rendered AFTER the text
            so the angled fly-in passes over it (depth). On taller viewports it
            drifts down by half the extra space, staying centered between the
            title and the slogan. Mounted (parked offscreen) during the hold so
            the GLB and shaders
            are warm before the flight starts. */}
        {!reduced && (
          <div
            className="pointer-events-none absolute left-[-520px] h-[280px] w-[2400px] will-change-transform"
            style={{ top: "calc(204px + (100% - 900px) / 2)" }}
          >
            <div
              className={`h-full w-full ${phase === "enter" ? "" : "animate-rocket-drive-in"}`}
              style={phase === "enter" ? { transform: "translate(-105vw, 36vh) rotate(-14deg)" } : undefined}
            >
              <HeroRocket3D fullBurn={phase === "drive"} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
