import { ArrowUpRight } from "lucide-react";
import type { Partner, PartnerStory } from "@/lib/partners";
import { PartnerLogo, type LogoHeights } from "./partner-logo";
import { ReadMore } from "./read-more";

// One partner on the Partners page (boards 31, 31b, 31m): a liquid glass card
// with the logo, the name, one line on how they help and a link to their site.
//
// From md, hovering the card (or tabbing to its link) swaps the one-liner for
// the partner's own text, shrinks the logo and lights the edge in faint
// accent (board 31b). Both texts share one grid cell, so the card is always
// as tall as the longer one, and the cards of a row stretch to the tallest:
// nothing moves on hover. On phones "Read more" opens the same text (31m).
// A partner with no website shows no link; one with no text of its own has
// no swap and no "Read more".

/** Drawn heights in px: [phone, from md at rest]. On hover from md they halve, inside a box that keeps the mark's full height, so the names of a row line up and nothing below the logo moves. */
const LOGO_H: LogoHeights = { wordmark: [28, 64], mark: [48, 100] };

const logoClass = {
  wordmark: "h-7 md:h-16 md:group-hover:h-8 md:group-focus-within:h-8",
  mark: "h-12 md:h-[100px] md:group-hover:h-[50px] md:group-focus-within:h-[50px]",
} as const;

/** The widest a logo is drawn: a card's inner width on desktop. */
const LOGO_MAX_W = 370;

const swap = "transition-opacity duration-300 ease-out motion-reduce:transition-none";

function Story({ story }: { story: PartnerStory }) {
  return (
    <div className="space-y-2 text-[14px] leading-[1.55]">
      {story.about.map((paragraph) => (
        <p key={paragraph} className="text-text-2">
          {paragraph}
        </p>
      ))}
      {story.support !== undefined && <p className="text-prt-text">{story.support}</p>}
    </div>
  );
}

function WebsiteLink({ partner, href, label }: { partner: Partner; href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label}: ${partner.name} (opens in a new tab)`}
      className="group/link inline-flex items-center gap-2 text-[14px] text-prt-text transition-colors duration-300 ease-out hover:text-accent"
    >
      {label}
      <ArrowUpRight aria-hidden className="h-4 w-4 text-accent" />
    </a>
  );
}

export function PartnerCard({ partner }: { partner: Partner }) {
  const { story, website } = partner;
  return (
    <article className="glass-card group relative flex w-full flex-col rounded-xl p-5 md:p-7">
      {/* The faint accent edge of board 31b, over the glass edge. */}
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 z-[2] rounded-xl opacity-0 ring-1 ring-inset ring-accent/40 shadow-[0_0_32px_-10px_theme(colors.accent.DEFAULT/45%)] md:group-hover:opacity-100 md:group-focus-within:opacity-100 ${swap}`}
      />

      <div className="flex items-center md:h-[100px]">
        <PartnerLogo
          logo={partner.logo}
          alt={partner.name}
          heights={LOGO_H}
          maxWidth={LOGO_MAX_W}
          className={`max-w-full object-left transition-[height] duration-300 ease-out motion-reduce:transition-none ${logoClass[partner.logo.kind]}`}
        />
      </div>

      <h3 className="mt-3 text-[17px] font-semibold leading-snug text-prt-text md:mt-5 md:text-[19px]">{partner.name}</h3>

      {/* Desktop: the one-liner and the partner's text in one cell. */}
      <div className="mt-2.5 hidden md:grid">
        <p
          className={`[grid-area:1/1] text-[15px] leading-[1.55] text-text-2 ${story ? `md:group-hover:opacity-0 md:group-focus-within:opacity-0 ${swap}` : ""}`}
        >
          {partner.oneLiner}
        </p>
        {story !== undefined && (
          <div className={`[grid-area:1/1] opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 ${swap}`}>
            <Story story={story} />
          </div>
        )}
      </div>
      {website !== undefined && (
        <div className="mt-auto hidden pt-5 md:block">
          <WebsiteLink partner={partner} href={website} label="Visit website" />
        </div>
      )}

      {/* Phones: the one-liner, then "Read more" and the website link. */}
      <div className="md:hidden">
        <p className="mt-2.5 text-[14px] leading-[1.55] text-text-2">{partner.oneLiner}</p>
        {story !== undefined ? (
          <ReadMore
            story={<Story story={story} />}
            link={website !== undefined && <WebsiteLink partner={partner} href={website} label="Website" />}
          />
        ) : (
          website !== undefined && (
            <div className="mt-4 flex justify-end">
              <WebsiteLink partner={partner} href={website} label="Website" />
            </div>
          )
        )}
      </div>
    </article>
  );
}
