import Image from "next/image";
import { Linkedin, Mail } from "lucide-react";
import { contactsOf, initials } from "@/lib/about/people";
import type { Person } from "@/lib/about/types";

// The people pieces every Team page section shares: a round colour photo,
// with the PRT mark or the initials when there is none, and the LinkedIn and
// mail icons. The name is always printed beside the circle, so the photo
// itself is decorative.

/**
 * What a circle with no photo shows: the PRT mark (the org chart's leaders)
 * or the initials. "mark-to-initials" shows the mark on phones and the
 * initials from lg, as a department head does (boards 26m and 26).
 */
export type Fallback = "mark" | "initials" | "mark-to-initials";

export function Avatar({
  person,
  sizeClass,
  sizes,
  fallback,
  initialsClass = "text-[10px]",
}: {
  person: Pick<Person, "name" | "photo">;
  /** Width and height, for example "h-[60px] w-[60px] lg:h-[120px] lg:w-[120px]". */
  sizeClass: string;
  /** The photo's rendered width for next/image, for example "120px". */
  sizes: string;
  fallback: Fallback;
  initialsClass?: string;
}) {
  return (
    <span className={`relative block shrink-0 overflow-hidden rounded-full bg-surface-2 ${sizeClass}`}>
      {person.photo !== undefined ? (
        <Image src={person.photo} alt="" fill sizes={sizes} className="object-cover" />
      ) : (
        <>
          {fallback !== "initials" && (
            <Image
              src="/brand/prt-mark-white.svg"
              alt=""
              width={444}
              height={220}
              className={`absolute left-1/2 top-1/2 w-[78%] -translate-x-1/2 -translate-y-1/2 ${
                fallback === "mark-to-initials" ? "lg:hidden" : ""
              }`}
            />
          )}
          {fallback !== "mark" && (
            <span
              aria-hidden
              className={`absolute inset-0 items-center justify-center font-mono tracking-[0.05em] text-text-2 ${initialsClass} ${
                fallback === "mark-to-initials" ? "hidden lg:flex" : "flex"
              }`}
            >
              {initials(person.name)}
            </span>
          )}
        </>
      )}
    </span>
  );
}

/** LinkedIn, then mail, each only when the person has one. */
export function Contacts({
  person,
  iconClass,
  className = "",
}: {
  person: Pick<Person, "name" | "linkedin" | "email">;
  /** The icon's size, for example "h-[18px] w-[18px]". */
  iconClass: string;
  className?: string;
}) {
  const { linkedin, email } = contactsOf(person);
  const link = "text-prt-muted transition-colors duration-300 ease-out hover:text-accent";
  // Every person shows both icons (boards 26 and 26m). One with no address
  // yet is dimmed and not a link, so it never leads nowhere; it becomes a
  // link as soon as the record gets the address.
  const missing = "text-dim";
  return (
    <span className={`flex items-center gap-3 ${className}`}>
      {linkedin !== undefined ? (
        <a href={linkedin} target="_blank" rel="noopener noreferrer" aria-label={`${person.name} on LinkedIn`} className={link}>
          <Linkedin aria-hidden className={iconClass} strokeWidth={1.5} />
        </a>
      ) : (
        <span aria-hidden className={missing}>
          <Linkedin className={iconClass} strokeWidth={1.5} />
        </span>
      )}
      {email !== undefined ? (
        <a href={email} aria-label={`Email ${person.name}`} className={link}>
          <Mail aria-hidden className={iconClass} strokeWidth={1.5} />
        </a>
      ) : (
        <span aria-hidden className={missing}>
          <Mail className={iconClass} strokeWidth={1.5} />
        </span>
      )}
    </span>
  );
}

/**
 * One person in a Departments or Advisors grid (boards 26, 26d and 26m): the
 * round photo with the name, the role and the icons beside it. From lg every
 * cell's photo is 96px; below lg each section keeps its own phone size.
 */
export function PersonCell({
  person,
  role,
  accent,
  phone,
  fallback,
}: {
  person: Pick<Person, "name" | "photo" | "linkedin" | "email">;
  role?: string;
  /** The role in accent (a head, a principal advisor); otherwise grey. */
  accent: boolean;
  /** Below lg: the photo's size and the gap beside it, for example "h-14 w-14" and "gap-4". */
  phone: { avatar: string; gap: string };
  fallback: Fallback;
}) {
  return (
    <div className={`flex items-center ${phone.gap} lg:gap-4`}>
      <Avatar
        person={person}
        sizeClass={`${phone.avatar} lg:h-24 lg:w-24`}
        sizes="96px"
        fallback={fallback}
        initialsClass="text-[13px] lg:text-[18px]"
      />
      <div className="min-w-0">
        <p className="text-[16px] font-semibold leading-tight tracking-[-0.01em] text-prt-text lg:text-[19px]">{person.name}</p>
        {role !== undefined && (
          <p className={`mt-0.5 text-[13px] leading-tight lg:mt-1 lg:text-[14px] ${accent ? "text-accent" : "text-text-2"}`}>{role}</p>
        )}
        <Contacts person={person} iconClass="h-4 w-4" className="mt-1.5 lg:mt-2 lg:gap-2.5" />
      </div>
    </div>
  );
}
