/**
 * Cavour at arrow size, nose to the right: grey hull, white seam ring, orange
 * nose, swept fins trailing past the tail, a stub of nozzle. 1em tall like
 * the → it replaces; the fins set the height, the hull is a third of it.
 * Hull and fins are lifted well off black so it reads on the page ground.
 */
export function RocketArrow({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 16" aria-hidden="true" className={`inline-block h-[1em] w-[3em] ${className}`}>
      <RocketShape />
    </svg>
  );
}

/**
 * The same rocket launching (board 35, "Send application"): turned 45° so
 * the nose points up and right, with a short flame under the tail. The box is
 * square around the turned rocket.
 */
export function RocketLaunch({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="-3 -15 46 46" aria-hidden="true" className={`inline-block h-[1.75em] w-[1.75em] ${className}`}>
      <g transform="rotate(-45 20 8)">
        <path d="M3.6 6.5 Q-1 7 -6 8 Q-1 9 3.6 9.5 Z" className="fill-accent" />
        <path d="M3.6 7.3 Q0.6 7.6 -2.4 8 Q0.6 8.4 3.6 8.7 Z" className="fill-prt-text/80" />
        <RocketShape />
      </g>
    </svg>
  );
}

function RocketShape() {
  return (
    <>
      {/* Grey hull and fins: the commented exception in the design manifest. */}
      <path d="M6 6.4 H13 L8.5 3.2 H4 Z M6 9.6 H13 L8.5 12.8 H4 Z" fill="#6E6E75" />
      <path d="M6 6.8 H3.8 L3 8 L3.8 9.2 H6 Z" fill="#8A8A8F" />
      <rect x="6" y="6.2" width="26" height="3.6" fill="#5A5A60" />
      <rect x="31" y="6.2" width="2.2" height="3.6" className="fill-prt-text" />
      <path d="M33 6.2 Q42 6.3 47 8 Q42 9.7 33 9.8 Z" className="fill-accent" />
    </>
  );
}
