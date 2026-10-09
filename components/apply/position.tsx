import { ArrowLeft, Check, Lock, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { StatePopover } from "@/components/apply/state-popover";
import { GoogleSignInButton } from "@/components/login-form";
import { RocketArrow } from "@/components/landing/rocket-arrow";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { positionPage, sentMessage, signInMessage } from "@/lib/apply/page";

// The position page /apply/<slug> (boards 35, 35b, 35c and 35d, with 35m to
// 35dm on phones): a back link, the meta line, the title, the description and
// the two skill lists, then the form (board 35). In every other state the page
// shows only that top part, under a popover for the state (issue #147). The
// column is 1040px wide, centred.

export type PositionView = {
  code: string;
  department: string;
  division: string;
  title: string;
  description: string;
  required: readonly string[];
  desirable: readonly string[];
};

export function PositionLayout({ position, children }: { position: PositionView; children?: ReactNode }) {
  return (
    <div className="px-5 md:px-16">
      <div className="mx-auto max-w-[1040px]">
        <Link
          href="/apply"
          className="mt-[30px] inline-flex items-center gap-2.5 text-[14px] text-prt-text transition-colors duration-300 ease-out hover:text-accent md:mt-[60px]"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          {positionPage.back}
        </Link>
        <Header position={position} />
        <Skills required={position.required} desirable={position.desirable} />
        {children !== undefined && <div className="mt-10 md:mt-16">{children}</div>}
      </div>
    </div>
  );
}

function Header({ position }: { position: PositionView }) {
  const [lead, ...body] = position.description
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p !== "");
  return (
    <header className="mt-6 md:mt-14">
      <p className="font-mono text-[11px] tracking-[0.2em] text-dim">
        <span className="text-accent max-md:block">{position.code}</span>
        <span aria-hidden className="mx-3 max-md:hidden">
          ·
        </span>
        {/* On phones each name is a flex item, so the line wraps at the dot first.
            A name wider than the screen still wraps inside itself instead of widening the page. */}
        <span className="max-md:mt-2 max-md:flex max-md:flex-wrap max-md:gap-x-3 max-md:gap-y-2">
          <span className="md:whitespace-nowrap">{position.department.toUpperCase()} DEPARTMENT</span>
          <span aria-hidden className="md:mx-3">
            ·
          </span>
          <span className="md:whitespace-nowrap">{position.division.toUpperCase()} DIVISION</span>
        </span>
      </p>
      <h1 className="mt-3 text-[34px] font-bold leading-[1.1] tracking-[-0.025em] md:mt-5 md:text-[64px] md:leading-[1.05]">
        {position.title}
      </h1>
      {lead !== undefined && (
        <p className="mt-4 text-[17px] leading-[1.6] text-text-2 md:mt-6 md:text-[21px]">{lead}</p>
      )}
      {body.length > 0 && (
        <div className="mt-8 flex flex-col gap-4 text-[16px] leading-[1.7] text-text-2 md:mt-6 md:gap-5 md:text-[17px] md:leading-[1.85]">
          {body.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      )}
    </header>
  );
}

function Skills({ required, desirable }: { required: readonly string[]; desirable: readonly string[] }) {
  if (required.length === 0 && desirable.length === 0) return null;
  return (
    <div className="mt-8 grid gap-8 md:mt-14 md:grid-cols-2 md:gap-x-10">
      {required.length > 0 && (
        <SkillList title={positionPage.requiredTitle} skills={required} icon={<Check className="h-4 w-4 text-accent" />} />
      )}
      {desirable.length > 0 && (
        <SkillList title={positionPage.desirableTitle} skills={desirable} icon={<Plus className="h-4 w-4 text-prt-muted" />} />
      )}
    </div>
  );
}

function SkillList({ title, skills, icon }: { title: string; skills: readonly string[]; icon: ReactNode }) {
  return (
    <section>
      <h2 className="text-[20px] font-bold tracking-[-0.02em] md:text-[28px]">{title}</h2>
      <ul className="mt-4 flex flex-col gap-3 md:mt-6 md:gap-4">
        {skills.map((s) => (
          <li key={s} className="flex gap-3 text-[15px] leading-snug text-text-2 md:text-[17px]">
            <span aria-hidden className="mt-0.5 shrink-0 md:mt-1">
              {icon}
            </span>
            {s}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The popover's title: the dialog's label. */
function PopoverTitle({ children }: { children: ReactNode }) {
  return <DialogTitle className="text-[28px] font-bold leading-tight tracking-[-0.02em]">{children}</DialogTitle>;
}

function PopoverBody({ children }: { children: ReactNode }) {
  return <DialogDescription className="mt-3 text-[15px] leading-[1.6] text-text-2">{children}</DialogDescription>;
}

function PopoverIcon({ tone, children }: { tone: "accent" | "neutral"; children: ReactNode }) {
  const look = tone === "accent" ? "border-accent/40 bg-accent-soft text-accent" : "border-white-10 bg-white-5 text-text-2";
  return (
    <span aria-hidden className={`mx-auto mb-7 flex h-14 w-14 items-center justify-center rounded-full border ${look}`}>
      {children}
    </span>
  );
}

function PopoverLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group mt-9 flex h-12 w-full items-center justify-center gap-4 rounded-full border border-white-10 px-6 text-[15px] font-semibold text-prt-text transition-colors duration-300 ease-out hover:border-border-strong hover:text-accent"
    >
      {children}
      <RocketArrow className="opacity-80 transition duration-300 ease-out group-hover:translate-x-1.5 group-hover:opacity-100" />
    </Link>
  );
}

/** Boards 35e and 35em: signed out. Google brings the user back to this page. */
export function SignInPopover({ title, returnTo }: { title: string; returnTo: string }) {
  return (
    <StatePopover>
      <Image
        src="/brand/prt-mark-white.svg"
        alt=""
        width={444}
        height={220}
        className="mx-auto mb-10 h-8 w-auto max-md:hidden"
      />
      <p className="font-mono text-[11px] tracking-[0.1em] text-accent">{positionPage.eyebrow}</p>
      <div className="mt-3">
        <PopoverTitle>{positionPage.signIn.title}</PopoverTitle>
      </div>
      <PopoverBody>{signInMessage(title)}</PopoverBody>
      <div className="mt-9 [&_button]:h-12 [&_button]:w-full [&_button]:justify-center [&_button]:text-[16px]">
        <Suspense fallback={<div className="h-12" aria-hidden />}>
          <GoogleSignInButton returnTo={returnTo} />
        </Suspense>
      </div>
      <p className="mt-9 text-[13px] leading-[1.5] text-prt-muted md:-mx-4 md:text-[12px]">{positionPage.signIn.terms}</p>
    </StatePopover>
  );
}

/** Boards 35c and 35cm: this user has applied for this position. */
export function SentPopover(props: { firstName: string; title: string; division: string; email: string }) {
  return (
    <StatePopover>
      <PopoverIcon tone="accent">
        <Check className="h-6 w-6" />
      </PopoverIcon>
      <PopoverTitle>{positionPage.sent.title}</PopoverTitle>
      <PopoverBody>{sentMessage(props)}</PopoverBody>
      <PopoverLink href="/apply">{positionPage.sent.action}</PopoverLink>
    </StatePopover>
  );
}

/** Boards 35d and 35dm: the position is closed, deleted, or recruitment is off. */
export function ClosedPopover() {
  return (
    <StatePopover>
      <PopoverIcon tone="neutral">
        <Lock className="h-6 w-6" />
      </PopoverIcon>
      <PopoverTitle>{positionPage.closed.title}</PopoverTitle>
      <PopoverBody>{positionPage.closed.body}</PopoverBody>
      <PopoverLink href="/apply">{positionPage.closed.action}</PopoverLink>
    </StatePopover>
  );
}
