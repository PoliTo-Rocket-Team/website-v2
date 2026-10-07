import { partNumber, type DesignStory, type NameStory, type Prose } from "@/lib/project-pages";
import { SectionHead } from "./parts";

// 01 The name and 02 The design side by side, 64px apart (boards 23, 24,
// 25). The design column lists the parts top to bottom, numbered bottom to
// top. The phone boards stack them with shorter copy.

function Body({ body }: { body: Prose }) {
  return (
    <div className="mt-4 text-[15px] leading-[24px] text-text-2 md:mt-10 md:text-[17px] md:leading-[27px]">
      <div className="hidden space-y-6 md:block">
        {body.text.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
      <p className="md:hidden">{body.phone}</p>
    </div>
  );
}

export function ProjectStory({ name, design }: { name: NameStory; design: DesignStory }) {
  const { items } = design.parts;
  return (
    <section className="px-5 pt-14 md:px-16 md:pt-[120px]">
      <div className="mx-auto grid max-w-[1312px] gap-14 md:grid-cols-2 md:gap-16">
        <div>
          <SectionHead num="01" label="THE NAME" title={name.title} />
          <Body body={name.body} />
        </div>

        <div>
          <SectionHead num="02" label="THE DESIGN" title={design.title} />
          <Body body={design.body} />

          {/* One grid for the whole list, so a long name widens its column for
              every row alike; it never drops below board 23m's 104px. */}
          <ol
            aria-label={design.parts.label}
            className="mt-6 grid grid-cols-[28px_minmax(104px,max-content)_1fr] border-t border-hairline md:mt-8 md:grid-cols-[36px_200px_1fr]"
          >
            {items.map((part, i) => (
              <li
                key={part.name}
                className="col-span-3 grid grid-cols-subgrid items-center border-b border-hairline py-2.5 md:py-3.5"
              >
                <span className="font-mono text-[10px] text-accent md:text-[11px]">{partNumber(i, items.length)}</span>
                <span className="pr-2 text-[15px] font-semibold md:text-[17px]">{part.name}</span>
                <span className="text-[13px] text-text-2 md:text-[15px]">
                  <span className="md:hidden">{part.phone}</span>
                  <span className="hidden md:inline">{part.desc}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-4 hidden font-mono text-[11px] tracking-[0.2em] text-dim md:block">
            {design.parts.caption} · 01 → {partNumber(0, items.length)}
          </p>
        </div>
      </div>
    </section>
  );
}
