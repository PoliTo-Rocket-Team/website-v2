import type { ReactNode } from "react";
import { Starfield } from "./starfield";

// The page sky (board 21): a repeating streak tile, a grain layer and stars,
// with no shooting star. It sits behind its children, which paint no
// background of their own. The homepage runs it from below the hero to the
// apply band; /projects runs it behind the whole page above the footer.
export function PageSky({
  children,
  starsClassName = "",
}: {
  children: ReactNode;
  /** Offsets the stars, for example to start them below the hero scrim. */
  starsClassName?: string;
}) {
  return (
    <div className="relative isolate">
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
        <div className="page-sky-light" />
        <div className="page-sky-grain" />
        {/* The footer's starfield, without its shooting star. Stars are
            placed in percent, so the count is sized for the sky's usual
            height of about 3600px. Unlike the hero and footer skies, this
            one holds still under reduced motion. */}
        <Starfield
          count={200}
          seed={31}
          twinkleEvery={9}
          dimOpacity={0.6}
          reducedMotion="still"
          className={starsClassName}
        />
      </div>
      {children}
    </div>
  );
}
