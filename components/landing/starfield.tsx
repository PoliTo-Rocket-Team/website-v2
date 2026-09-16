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

function makeStars(count: number, seed: number, twinkleEvery = 6, sizeMin = 1, sizeMax = 3.2): Star[] {
  const rand = mulberry32(seed);
  return Array.from({ length: count }, (_, i) => ({
    x: rand() * 100,
    y: rand() * 100,
    size: sizeMin + rand() * (sizeMax - sizeMin),
    twinkle: i % twinkleEvery === 0,
    delay: rand() * 4,
  }));
}

export function Starfield({
  count = 34,
  seed = 42,
  twinkleEvery = 6,
  sizeMin = 1,
  sizeMax = 3.2,
  dimOpacity = 0.35,
  className = "",
}: {
  count?: number;
  seed?: number;
  twinkleEvery?: number;
  sizeMin?: number;
  sizeMax?: number;
  dimOpacity?: number;
  className?: string;
}) {
  const stars = makeStars(count, seed, twinkleEvery, sizeMin, sizeMax);
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {stars.map((s, i) => (
        <span
          key={i}
          className={`absolute rounded-full bg-white ${s.twinkle ? "animate-twinkle" : ""}`}
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
