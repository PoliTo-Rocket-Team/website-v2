// Deterministic starfield: seeded PRNG so SSR and client render identical stars.
type Star = { x: number; y: number; size: number; twinkle: boolean; delay: number };

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeStars(
  count: number,
  seed: number,
  twinkleEvery = 6,
  sizeMin = 1,
  sizeMax = 3.2,
  wholePixels = false,
  minSpacing = 0,
): Star[] {
  const rand = mulberry32(seed);
  const round = wholePixels ? Math.round : (n: number) => n;
  const tooClose = (a: Star, x: number, y: number) =>
    Math.abs(a.x - x) < minSpacing && Math.abs(a.y - y) < minSpacing;
  const stars: Star[] = [];
  // A spacing too wide for the count would never finish; stop drawing then.
  for (let draws = 0; stars.length < count && draws < count * 50; draws++) {
    // Draw order is x, y, size, delay: changing it moves every seeded sky.
    // A star too close to a kept one is dropped after its four draws, so
    // with no spacing every star is kept and the sky is as it always was.
    const x = rand() * 100;
    const y = rand() * 100;
    const size = round(sizeMin + rand() * (sizeMax - sizeMin));
    const delay = rand() * 4;
    if (stars.some((s) => tooClose(s, x, y))) continue;
    stars.push({ x, y, size, twinkle: stars.length % twinkleEvery === 0, delay });
  }
  return stars;
}

export function Starfield({
  count = 34,
  seed = 42,
  twinkleEvery = 6,
  sizeMin = 1,
  sizeMax = 3.2,
  dimOpacity = 0.35,
  reducedMotion = "twinkle",
  wholePixels = false,
  minSpacing = 0,
  className = "",
}: {
  count?: number;
  seed?: number;
  twinkleEvery?: number;
  sizeMin?: number;
  sizeMax?: number;
  dimOpacity?: number;
  /**
   * What twinkling stars do under prefers-reduced-motion. The hero and footer
   * skies keep twinkling as built; the page sky between them holds still.
   */
  reducedMotion?: "twinkle" | "still";
  /**
   * Round each star to a whole pixel size. A fractional box under 3px
   * rasterises as a short dash, not a dot; the page sky rounds, while the
   * hero and footer skies keep their stars as built.
   */
  wholePixels?: boolean;
  /**
   * Keep stars apart, in percent of the sky on each axis: a star closer than
   * this to a kept star on both axes is dropped. Two stars that touch merge
   * into one dash. The page sky spaces its stars; the hero and footer skies
   * keep their stars as built.
   */
  minSpacing?: number;
  className?: string;
}) {
  const stars = makeStars(count, seed, twinkleEvery, sizeMin, sizeMax, wholePixels, minSpacing);
  const twinkleClass =
    reducedMotion === "still" ? "animate-twinkle motion-reduce:animate-none" : "animate-twinkle";
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {stars.map((s, i) => (
        <span
          key={i}
          className={`absolute rounded-full bg-white ${s.twinkle ? twinkleClass : ""}`}
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            opacity: s.twinkle ? undefined : dimOpacity,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
