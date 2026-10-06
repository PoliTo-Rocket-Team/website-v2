import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { brand } from "@/lib/brand-colors";
import { Starfield } from "./starfield";

// Board 24 hero (phone, below md). The same sky, earth, stars, live rocket and
// entrance as the 1440 board in hero.tsx, laid out on a 390px-wide, 650px-tall
// frame instead of scaling the desktop board down. Top to bottom: the title
// 30px at y≈113 below the 64px bar, the rocket climbing right at about 21°,
// "BORN FOR / SPACE" 52px on two lines right below the rocket at y≈384, then
// the body copy at 14px from y≈510. All three text blocks are centred between
// the 20px edges (issue #67). The earth photo starts at y215 and is smaller
// than the desktop one. Text runs from the left and right 20px edges and the
// rocket from the centre line, so every width below md stays centred.
//
// The rocket canvas keeps the hero's 2400x280 proportions at 0.29 scale, so
// the same camera draws the same rocket at about 330px long. A canvas sized
// down (rather than a CSS scale) keeps the drive-in's vw/vh path in screen
// units. The outer wrapper adds 15° to the stage's own 6° parked tilt.
const ROCKET_SCALE = 0.29;
const ROCKET_W = 2400 * ROCKET_SCALE;
const ROCKET_H = 280 * ROCKET_SCALE;
const ROCKET_TILT = -15; // deg, on top of the stage's -6°
// Huey's ruling on PR #68: the parked rocket's visible body, nose tip to tail
// fin tips, is centred across the frame at every width below md. The canvas
// draws about 10.1px per world unit. Tilted 21°, the nose tip lands 182px right
// of the canvas centre and the near upper tail fin tip, enlarged about 10% by
// the camera's perspective, 144px left of it. That body's middle is 19px right
// of the canvas centre, so the canvas centre sits 19px left of the frame's
// middle. At 390 the nose lands near x358 and the fins near x32.
const ROCKET_CENTER = { fromMiddle: -19, top: 252 };
const EARTH_TOP = 215;

/**
 * `sizes` for the earth photo, shared by both hero frames. Each frame
 * preloads the photo even while CSS hides it, so the two must resolve to the
 * same file at every width or the browser fetches it twice. Below md the
 * phone frame is 100vw wide. From md the desktop box is max(1800px × scale,
 * 100vw) on screen (hero.tsx), and scale is at most 100vw / 1440: 1800px from
 * 1440 to 1800 wide, at most 125vw below that, 100vw above.
 */
export const EARTH_SIZES = "(min-width: 1800px) 100vw, (min-width: 1440px) 1800px, (min-width: 768px) 125vw, 100vw";

type Props = {
  /** Class that parts title and slogan on the drive-in curve, if running. */
  separateClass: string;
  separateStyle: (gatherY: number) => CSSProperties;
  wordClass: string;
  sloganClass: string;
  /** Hides the body copy until the entrance settles, then fades it in. */
  copyClass: string;
  /** The rocket stage (hero.tsx owns its mount and phase), or null. */
  rocket: ReactNode;
};

const TITLE_GATHER_Y = 64;
const SLOGAN_GATHER_Y = -96;

export function HeroPhoneStage({
  separateClass,
  separateStyle,
  wordClass,
  sloganClass,
  copyClass,
  rocket,
}: Props) {
  return (
    <div className="relative h-full w-full md:hidden">
      {/* Earth from y215 to the bottom, its hard top edge blended into the sky */}
      <div className="absolute inset-x-0 bottom-0" style={{ top: EARTH_TOP }}>
        <Image src="/design/earth-limb-sym.jpg" alt="" fill priority sizes={EARTH_SIZES} className="object-cover object-top" />
      </div>
      <div
        className="absolute inset-x-0 h-16"
        style={{ top: EARTH_TOP, background: "linear-gradient(to bottom, #010101, #01010100)" }}
      />

      {/* Scrim: the desktop wash on the 650 frame, ending on ground */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to top, ${brand.ground} 0px, ${brand.ground}B3 130px, ${brand.ground}1A 360px, ${brand.ground}66 650px)`,
        }}
      />

      <div className="absolute inset-x-0 top-0 h-[320px]">
        <Starfield count={40} seed={7} className="h-full" />
        <Starfield count={120} seed={13} twinkleEvery={0} sizeMin={0.5} sizeMax={1.2} dimOpacity={0.22} className="h-full" />
      </div>

      <h1
        className={`absolute inset-x-5 top-[113px] text-center text-[30px] font-extrabold leading-[0.89] tracking-[-0.93px] text-prt-text ${separateClass}`}
        style={separateStyle(TITLE_GATHER_Y)}
      >
        {["POLITO", "ROCKET", "TEAM"].map((word, i) => (
          <span key={word}>
            <span className={`hero-type inline-block ${wordClass}`} style={{ animationDelay: `${i * 75}ms` }}>
              {word}
            </span>
            {i < 2 ? " " : ""}
          </span>
        ))}
      </h1>

      {/* Huey's ruling on PR #68: the slogan is always exactly two lines, and
          the body copy follows it in flow, so the two can never overlap. Two
          52px lines at 0.89 leading end at y≈477; 33px more puts the body at
          y≈510. */}
      <div className="absolute inset-x-5 top-[384px] flex flex-col">
        <p
          className={`whitespace-nowrap text-center text-[52px] font-extrabold leading-[0.89] tracking-[-1.8px] text-prt-text ${separateClass}`}
          style={separateStyle(SLOGAN_GATHER_Y)}
        >
          <span className={`hero-type inline-block ${sloganClass}`} style={{ animationDelay: "450ms" }}>
            BORN FOR
            <br />
            SPACE
          </span>
        </p>

        <p
          className={`mt-[33px] text-center text-[14px] leading-[1.5] text-prt-text ${copyClass}`}
          style={{ animationDelay: "600ms" }}
        >
          The rocket engineering student team of Politecnico di Torino, Italy. 150+ undergraduate,
          graduate and PhD students researching, designing and building rocket engines and
          experimental rockets with scientific payloads.
        </p>
      </div>

      {rocket && (
        <div
          className="pointer-events-none absolute will-change-transform"
          style={{
            width: ROCKET_W,
            height: ROCKET_H,
            left: `calc(50% + ${ROCKET_CENTER.fromMiddle}px)`,
            top: ROCKET_CENTER.top,
            transform: `translate(-50%, -50%) rotate(${ROCKET_TILT}deg)`,
          }}
        >
          {rocket}
        </div>
      )}
    </div>
  );
}
