import { CopyText } from "@/components/project-page/parts";
import type { OutreachFeature } from "@/lib/outreach-types";
import { Photo } from "./photo";

// Boards 32 and 32m, "Featured": the summit the team started, as one glass
// card. From md the group photo fills the left part and the story sits right
// of it; on phones the photo sits on top. The editions close the story.
export function Feature({ feature }: { feature: OutreachFeature }) {
  return (
    <section className="px-5 pt-section md:px-16">
      <article className="glass-card mx-auto grid max-w-[1312px] overflow-hidden rounded-xl md:grid-cols-[minmax(0,47fr)_minmax(0,53fr)]">
        <div className="relative h-[200px] md:h-auto md:min-h-[460px]">
          <Photo photo={feature.photo} sizes="(min-width: 1440px) 620px, (min-width: 768px) 47vw, 100vw" />
        </div>
        <div className="flex flex-col justify-center p-5 md:p-12">
          <p className="font-mono text-[11px] tracking-[0.2em] text-accent">{feature.eyebrow}</p>
          <h2 className="mt-3 text-[22px] font-bold leading-[1.2] tracking-[-0.02em] md:mt-4 md:text-[34px] md:leading-[1.15]">
            {feature.title}
          </h2>
          <p className="mt-3 text-[14px] leading-[1.6] text-text-2 md:mt-5 md:text-[15px]">
            <CopyText copy={feature.story} />
          </p>
          <dl className="mt-6 grid grid-cols-3 gap-4 md:mt-8">
            {feature.editions.map((e) => (
              <div key={e.year} className="flex flex-col-reverse">
                <dt className="mt-1 font-mono text-[9px] tracking-[0.15em] text-prt-muted md:text-[10px] md:tracking-[0.2em]">
                  {e.place.toUpperCase()}
                </dt>
                <dd className="text-[18px] font-bold leading-none text-prt-text md:text-[22px]">{e.year}</dd>
              </div>
            ))}
          </dl>
        </div>
      </article>
    </section>
  );
}
