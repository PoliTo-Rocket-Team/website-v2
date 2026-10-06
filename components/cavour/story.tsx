import { compartments } from "./data";
import { SectionHead } from "./parts";

// Board 23: 01 The name and 02 The design side by side, 64px apart. The
// design column lists the five compartments nose to motor, numbered bottom
// to top. Board 23m stacks them with shorter copy.
export function CavourStory() {
  return (
    <section className="px-5 pt-14 md:px-16 md:pt-[120px]">
      <div className="mx-auto grid max-w-[1312px] gap-14 md:grid-cols-2 md:gap-16">
        <div>
          <SectionHead eyebrow="01 – THE NAME" title="Named after a prime minister." />
          <div className="mt-4 space-y-6 text-[15px] leading-[24px] text-text-2 md:mt-10 md:text-[17px] md:leading-[27px]">
            <p className="hidden md:block">
              Camillo Benso, Count of Cavour, was one of the leading figures of Italian Unification and the main
              promoter of Italy&apos;s industrial and scientific development. He was the first prime minister of
              Italy. The Team&apos;s first project is named after him.
            </p>
            <p className="hidden md:block">
              In line with the Team&apos;s Mission &amp; Vision, Cavour&apos;s design is simple and pragmatic, built
              to draw the way for future projects. It is the first rocket of the Founding Fathers series.
            </p>
            <p className="md:hidden">
              Camillo Benso, Count of Cavour, led Italian Unification and pushed Italy&apos;s industry and science
              forward. He was Italy&apos;s first prime minister. Cavour is the first rocket of
              the Founding Fathers series.
            </p>
          </div>
        </div>

        <div>
          <SectionHead
            eyebrow="02 – THE DESIGN"
            title={
              <>
                Single stage, solid motor,
                <br />
                composite airframe.
              </>
            }
          />
          <p className="mt-4 text-[15px] leading-[24px] text-text-2 md:mt-10 md:text-[17px] md:leading-[27px]">
            Two body tubes and a coupler, four compartments plus the nose cone.
            <span className="hidden md:inline">
              {" "}
              The structure is lightweight composite; every internal part is a high-performance 3D-printed
              carbon-reinforced polymer. Internal diameter 100 mm, variable target altitude.
            </span>
            <span className="md:hidden">
              {" "}
              Lightweight composite structure; every internal part is 3D-printed carbon-reinforced polymer.
            </span>
          </p>

          <ol aria-label="Compartments, nose to motor" className="mt-6 border-t border-hairline md:mt-8">
            {compartments.map((c) => (
              <li
                key={c.num}
                className="grid grid-cols-[28px_104px_1fr] items-center border-b border-hairline py-2.5 md:grid-cols-[36px_200px_1fr] md:py-3.5"
              >
                <span className="font-mono text-[10px] text-accent md:text-[11px]">{c.num}</span>
                <span className="text-[15px] font-semibold md:text-[17px]">{c.name}</span>
                <span className="text-[13px] text-text-2 md:text-[15px]">
                  <span className="md:hidden">{c.phone}</span>
                  <span className="hidden md:inline">{c.desc}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-4 hidden font-mono text-[11px] tracking-[0.2em] text-dim md:block">
            BOTTOM TO TOP · 01 → 05
          </p>
        </div>
      </div>
    </section>
  );
}
