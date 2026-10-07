"use client";

import { useId, useState } from "react";
import Image from "next/image";
import { ChevronDown, Linkedin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { linkedinUrl, searchMembers } from "@/lib/about/people";
import type { CoreMembers as CoreMembersData, Member } from "@/lib/about/types";
import { SectionHead } from "./section-head";
import { groupPhotoBlur } from "./team-blur";

// Boards 26 and 26m, "Core members": the group photo, a search by name or
// role, and the members in alphabetical order, four columns from lg (two
// from md) and one on phones. Until "Show all" is pressed the list shows its
// first nine rows (36 members) from md and ten members on phones. A search
// looks through every member and shows every match.

/** How many members show before "Show all": ten on phones, nine rows of four from md. */
const FIRST_PHONE = 10;
const FIRST_WIDE = 36;

function MemberRow({ member, hiddenClass }: { member: Member; hiddenClass: string }) {
  return (
    <li className={`items-center gap-3 border-b border-white-10 py-3.5 ${hiddenClass}`}>
      {/* Top-aligned, so a name with no role lines up with its row. */}
      <div className="min-w-0 flex-1 self-start">
        <p className="truncate text-[15px] leading-tight text-prt-text">{member.name}</p>
        {member.role !== undefined && <p className="mt-1 truncate text-[13px] leading-tight text-prt-muted">{member.role}</p>}
      </div>
      {member.linkedin !== undefined && (
        <a
          href={linkedinUrl(member.linkedin)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${member.name} on LinkedIn`}
          className="shrink-0 text-dim transition-colors duration-300 ease-out hover:text-accent"
        >
          <Linkedin aria-hidden className="h-4 w-4" strokeWidth={1.5} />
        </a>
      )}
    </li>
  );
}

export function CoreMembers({ core }: { core: CoreMembersData }) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const searchId = useId();
  const total = core.members.length;
  const searching = query.trim() !== "";
  const shown = searchMembers(core.members, query);
  const everyone = showAll || searching;

  /** Rows past the first few stay in the page, hidden, so the list is whole for search engines and "Show all" moves nothing. */
  const hiddenClassOf = (i: number) => {
    if (everyone || i < FIRST_PHONE) return "flex";
    if (i < FIRST_WIDE) return "hidden md:flex";
    return "hidden";
  };

  return (
    <section className="px-5 pt-section md:px-16">
      <div className="mx-auto max-w-[1312px]">
        <SectionHead eyebrow={`${core.eyebrow} · ${total}`} title={core.title} align="left" />

        <div className="relative mt-6 aspect-[350/210] overflow-hidden rounded-xl md:mt-10 md:aspect-[1312/520]">
          <Image
            src={core.groupPhoto.src}
            alt={core.groupPhoto.alt}
            fill
            sizes="(min-width: 1440px) 1312px, 100vw"
            placeholder="blur"
            blurDataURL={groupPhotoBlur}
            className="object-cover"
          />
        </div>

        <div className="mt-6 flex items-center justify-between gap-6 md:mt-10">
          <div className="relative w-full md:max-w-[360px]">
            <label htmlFor={searchId} className="sr-only">
              Search members by name or role
            </label>
            <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-prt-muted" strokeWidth={1.75} />
            <Input
              id={searchId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or role"
              autoComplete="off"
              className="h-11 rounded-lg border-white-10 bg-white-5 pl-11 text-[15px] text-prt-text ring-offset-ground placeholder:text-prt-muted focus-visible:ring-1 focus-visible:ring-prt-text/60 focus-visible:ring-offset-0 md:text-[15px]"
            />
          </div>
          <p aria-hidden className="hidden shrink-0 font-mono text-[11px] tracking-[0.2em] text-dim md:block">
            A – Z
          </p>
        </div>

        <p aria-live="polite" className="sr-only">
          {searching ? `${shown.length} of ${total} members match` : ""}
        </p>

        {shown.length > 0 ? (
          <ul className="mt-4 grid grid-cols-1 md:mt-6 md:grid-cols-2 md:gap-x-8 lg:grid-cols-4">
            {shown.map((m, i) => (
              <MemberRow key={m.name} member={m} hiddenClass={hiddenClassOf(i)} />
            ))}
          </ul>
        ) : (
          <p className="mt-8 text-[15px] text-prt-muted">No member matches that search.</p>
        )}

        {!everyone && (
          <div className="mt-8 flex justify-center md:mt-10">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAll(true)}
              className="h-12 w-full rounded-full border-white-10 bg-transparent px-6 text-[15px] font-medium text-prt-text hover:border-border-strong hover:bg-transparent hover:text-prt-text focus-visible:ring-1 focus-visible:ring-prt-text/60 focus-visible:ring-offset-0 md:w-auto"
            >
              Show all {total} members
              <ChevronDown aria-hidden strokeWidth={1.75} />
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
