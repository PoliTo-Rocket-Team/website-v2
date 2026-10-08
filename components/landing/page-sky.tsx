import type { ReactNode } from "react";
import { Starfield } from "./starfield";

/** One band of the page sky's stars, px: the streak tile's height. */
const SKY_BAND = 1800;
/** Enough bands for the longest page with every list opened (8 x 1800 = 14400px). */
const SKY_BANDS = 8;

// The page sky (board 21): a repeating streak tile, a grain layer and stars,
// with no shooting star. It sits behind its children, which paint no
// background of their own. The homepage runs it from below the hero to the
// apply band; /projects and the project pages run it behind the whole page,
// footer included.
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
                {/* Both layers are drawn down from the sky's top edge, so every page
            shows the same texture at the same height under the navbar,
            whatever the page's length. A page whose sky runs into the footer
            puts the footer inside the sky (LandingFooter inSky), so the tile
            carries on into it with no line. */}
        <div className={`page-sky-light ${fadeTop ? "page-sky-fade" : ""}`} />
        <div className="page-sky-grain" />
        {/* The footer's starfield, without its shooting star, laid in
            fixed bands of 1800px (the streak tile's height) from the top.
            Stars sit in percent of their band, never of the whole page, so
            every page shows the same density whatever its height, and a
            page that grows as it loads (a streamed section, "Show all")
            keeps its stars where they are. Each band has its own seed, so
            the sky does not visibly repeat; bands past the page's end are
            clipped. Sizes are whole pixels, 2 or 3, and no two stars sit
            within 1.5% of each other on both axes, so every star renders as
            its own round dot. */}
        {Array.from({ length: SKY_BANDS }, (_, i) => (
          <div key={i} className="absolute inset-x-0" style={{ top: i * SKY_BAND, height: SKY_BAND }}>
            <Starfield
              count={100}
              seed={31 + i}
              twinkleEvery={9}
              sizeMin={2}
              sizeMax={3.4}
              wholePixels
              minSpacing={1.5}
              dimOpacity={0.6}
            />
          </div>
        ))}
      </div>
      {children}
    </div>
  );
}
