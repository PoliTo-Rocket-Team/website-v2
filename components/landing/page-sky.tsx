import type { ReactNode } from "react";
import { Starfield } from "./starfield";

// The page sky (board 21): a repeating streak tile, a grain layer and stars,
// with no shooting star. It sits behind its children, which paint no
// background of their own. The homepage runs it from below the hero to the
// apply band; /projects runs it behind the whole page above the footer.
export function PageSky({
  children,
  className = "",
  fadeTop = false,
}: {
  children: ReactNode;
  /** Layout on the sky itself, for example the section rhythm's top pad. */
  className?: string;
  /** Ramps the streak tile in from the top edge, where the sky meets the
      hero's ground-coloured bottom (.page-sky-fade in app/globals.css). */
  fadeTop?: boolean;
}) {
  return (
    <div className={`relative isolate ${className}`}>
      {/* bg-ground gives the grain's soft-light blend an opaque base where
          the faded tile lets the backdrop through; over transparency the
          grain would read as a grey band. */}
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden bg-ground">
        {/* Both layers are drawn up from the sky's bottom edge, so the
            footer's, drawn down from its top edge, carry straight on below
            it with no line (.page-sky-to-footer in app/globals.css). */}
        <div className={`page-sky-light page-sky-to-footer ${fadeTop ? "page-sky-fade" : ""}`} />
        <div className="page-sky-grain page-sky-to-footer" />
        {/* The footer's starfield, without its shooting star. Stars are
            placed in percent from the sky's top edge, so the count is sized
            for the sky's usual height of about 3600px. Sizes are whole
            pixels, 2 or 3, and no two stars sit within 1.5% of each other on
            both axes, at least 4.8px apart from a 320px-wide screen up, so
            every star renders as its own round dot. */}
        <Starfield
          count={200}
          seed={31}
          twinkleEvery={9}
          sizeMin={2}
          sizeMax={3.4}
          wholePixels
          minSpacing={1.5}
          dimOpacity={0.6}
        />
      </div>
      {children}
    </div>
  );
}
