/**
 * Cavour at arrow size, nose to the right: grey hull, white seam ring, orange
 * nose, swept fins trailing past the tail, a stub of nozzle. 1em tall like
 * the → it replaces; the fins set the height, the hull is a third of it.
 * Hull and fins are lifted well off black so it reads on the page ground.
 */
export function RocketArrow({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 16" aria-hidden="true" className={`inline-block h-[1em] w-[3em] ${className}`}>
      <path d="M6 6.4 H13 L8.5 3.2 H4 Z M6 9.6 H13 L8.5 12.8 H4 Z" fill="#6E6E75" />
      <path d="M6 6.8 H3.8 L3 8 L3.8 9.2 H6 Z" fill="#8A8A8F" />
      <rect x="6" y="6.2" width="26" height="3.6" fill="#5A5A60" />
      <rect x="31" y="6.2" width="2.2" height="3.6" fill="#F2F2F0" />
      <path d="M33 6.2 Q42 6.3 47 8 Q42 9.7 33 9.8 Z" fill="#FF5100" />
    </svg>
  );
}
