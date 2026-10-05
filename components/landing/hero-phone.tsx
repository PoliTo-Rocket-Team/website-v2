import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { brand } from "@/lib/brand-colors";
import { Starfield } from "./starfield";

// Board 24 hero (phone, below md). The same sky, earth, stars, live rocket and
// entrance as the 1440 board in hero.tsx, laid out on a 390px-wide, 760px-tall
// frame instead of scaling the desktop board down: title 30px at y≈120 below
// the 64px bar, "BORN FOR / SPACE" 58px on two lines at y≈250, the earth from
// y300, the rocket climbing right at about 21° with its nose near (315, 320),
// and the body copy at 15px from y≈584. Positions run from the left and right
// 20px edges, so wider phones keep the same shape.
//
// The rocket canvas keeps the hero's 2400x280 proportions at 0.29 scale, so
// the same camera draws the same rocket at about 330px long. A canvas sized
// down (rather than a CSS scale) keeps the drive-in's vw/vh path in screen
// units. The outer wrapper adds 15° to the stage's own 6° parked tilt.
const ROCKET_SCALE = 0.29;
const ROCKET_W = 2400 * ROCKET_SCALE;
const ROCKET_H = 280 * ROCKET_SCALE;
const ROCKET_TILT = -15; // deg, on top of the stage's -6°
// The canvas centre sits 182px left of and 70px below the nose once tilted.
const ROCKET_CENTER = { right: 257, top: 390 };

type Props = {
  /** Class that parts title and slogan on the drive-in curve, if running. */
  separateClass: string;
  separateStyle: (gatherY: number) => CSSProperties;
  wordClass: string;
  sloganClass: string;
  copyVisible: boolean;
  /** The rocket stage (hero.tsx owns its mount and phase), or null. */
  rocket: ReactNode;
};

const TITLE_GATHER_Y = 40;
const SLOGAN_GATHER_Y = -56;

export function HeroPhoneStage({
  separateClass,
  separateStyle,
  wordClass,
  sloganClass,
  copyVisible,
  rocket,
}: Props) {
  return (
    <div className="relative h-full w-full md:hidden">
      {/* Earth from y300 to the bottom, its hard top edge blended into the sky */}
      <div className="absolute inset-x-0 bottom-0 top-[300px]">
        <Image src="/design/earth-limb-sym.jpg" alt="" fill priority sizes="100vw" className="object-cover object-top" />
      </div>
      <div
        className="absolute inset-x-0 top-[300px] h-20"
        style={{ background: "linear-gradient(to bottom, #010101, #01010100)" }}
      />

      {/* Scrim: the desktop wash on the 760 frame, ending on ground */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to top, ${brand.ground} 0px, ${brand.ground}B3 150px, ${brand.ground}1A 420px, ${brand.ground}66 760px)`,
        }}
      />

      <div className="absolute inset-x-0 top-0 h-[400px]">
        <Starfield count={40} seed={7} className="h-full" />
        <Starfield count={120} seed={13} twinkleEvery={0} sizeMin={0.5} sizeMax={1.2} dimOpacity={0.22} className="h-full" />
      </div>

      <h1
        className={`absolute inset-x-5 top-[126px] text-[30px] font-extrabold leading-[0.89] tracking-[-0.93px] text-prt-text ${separateClass}`}
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

      <p
        className={`absolute inset-x-5 top-[250px] text-[58px] font-extrabold leading-[0.89] tracking-[-2px] text-prt-text ${separateClass}`}
        style={separateStyle(SLOGAN_GATHER_Y)}
      >
        <span className={`hero-type inline-block ${sloganClass}`} style={{ animationDelay: "450ms" }}>
          BORN FOR
          <br />
          SPACE
        </span>
      </p>

      <p
        className={`absolute inset-x-5 top-[584px] text-[15px] leading-[1.53] text-prt-text ${
          copyVisible ? "animate-hero-fade" : "opacity-0"
        }`}
        style={{ animationDelay: "600ms" }}
      >
        The rocket engineering student team of Politecnico di Torino, Italy. 150+ undergraduate,
        graduate and PhD students researching, designing and building rocket engines and
        experimental rockets with scientific payloads.
      </p>

      {rocket && (
        <div
          className="pointer-events-none absolute will-change-transform"
          style={{
            width: ROCKET_W,
            height: ROCKET_H,
            left: `calc(100% - ${ROCKET_CENTER.right}px)`,
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
