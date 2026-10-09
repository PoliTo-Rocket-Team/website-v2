import { ArrowLeft, Check, Lock, Plus } from "lucide-react";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { GoogleSignInButton } from "@/components/login-form";
import { RocketArrow } from "@/components/landing/rocket-arrow";
import { positionPage, sentMessage } from "@/lib/apply/page";

// The position page /apply/<slug> (boards 35, 35b, 35c and 35d, with 35m to
// 35dm on phones): a back link, the meta line, the title, the description and
// the two skill lists, then one card for the state the page is in. The column
// is 1040px wide, centred.

export type PositionView = {
  code: string;
  department: string;
  division: string;
  title: string;
  description: string;
  required: readonly string[];
  desirable: readonly string[];
};

export function PositionLayout({ position, children }: { position: PositionView; children: ReactNode }) {
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
        <div className="mt-10 md:mt-16">{children}</div>
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
        <span className="max-md:mt-2 max-md:block">
          {position.department.toUpperCase()} DEPARTMENT
          <span aria-hidden className="mx-3">
            ·
          </span>
          {position.division.toUpperCase()} DIVISION
        </span>
      </p>
      <h1 className="mt-3 text-[34px] font-bold leading-[1.1] tracking-[-0.025em] md:mt-5 md:text-[64px] md:leading-[1.05]">
        {position.title}
      </h1>
      {lead !== undefined && (
        <p className="mt-4 max-w-[760px] text-[17px] leading-[1.6] text-text-2 md:mt-6 md:text-[21px]">{lead}</p>
      )}
      {body.length > 0 && (
        <div className="mt-8 flex max-w-[760px] flex-col gap-4 text-[16px] leading-[1.7] text-text-2 md:mt-12 md:gap-5 md:text-[17px] md:leading-[1.85]">
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

/** The card shown in place of the form (boards 35b, 35c, 35d): 560px wide from md. */
function StateCard({ children }: { children: ReactNode }) {
  return <div className="glass-card max-w-[560px] rounded-xl p-6 md:p-9">{children}</div>;
}

function CardTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-[24px] font-bold leading-tight tracking-[-0.02em]">{children}</h2>;
}

function CardBody({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-[15px] leading-[1.6] text-text-2">{children}</p>;
}

function CardIcon({ tone, children }: { tone: "accent" | "neutral"; children: ReactNode }) {
  const look = tone === "accent" ? "border-accent/40 bg-accent-soft text-accent" : "border-white-10 bg-white-5 text-text-2";
  return (
    <span aria-hidden className={`mb-5 flex h-14 w-14 items-center justify-center rounded-full border ${look}`}>
      {children}
    </span>
  );
}

function CardLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group mt-6 inline-flex h-12 items-center justify-center gap-4 rounded-full border border-white-10 px-6 text-[15px] font-semibold text-prt-text transition-colors duration-300 ease-out hover:border-border-strong hover:text-accent max-md:w-full"
    >
      {children}
      <RocketArrow className="opacity-80 transition duration-300 ease-out group-hover:translate-x-1.5 group-hover:opacity-100" />
    </Link>
  );
}

/** Board 35b: signed out. Google brings the user back to this page. */
export function SignInCard({ returnTo }: { returnTo: string }) {
  return (
    <StateCard>
      <p className="font-mono text-[11px] tracking-[0.3em] text-accent">{positionPage.eyebrow}</p>
      <div className="mt-3">
        <CardTitle>{positionPage.signIn.title}</CardTitle>
      </div>
      <CardBody>{positionPage.signIn.body}</CardBody>
      <div className="mt-7 max-md:[&_button]:w-full max-md:[&_button]:justify-center">
        <Suspense fallback={<div className="h-11" aria-hidden />}>
          <GoogleSignInButton returnTo={returnTo} />
        </Suspense>
      </div>
    </StateCard>
  );
}

/** Board 35c: this user has applied for this position. */
export function SentCard(props: { firstName: string; title: string; division: string; email: string }) {
  return (
    <StateCard>
      <CardIcon tone="accent">
        <Check className="h-5 w-5" />
      </CardIcon>
      <CardTitle>{positionPage.sent.title}</CardTitle>
      <CardBody>{sentMessage(props)}</CardBody>
      <CardLink href="/apply">{positionPage.sent.action}</CardLink>
    </StateCard>
  );
}

/** Board 35d: the position is closed, deleted, or recruitment is off. */
export function ClosedCard() {
  return (
    <StateCard>
      <CardIcon tone="neutral">
        <Lock className="h-5 w-5" />
      </CardIcon>
      <CardTitle>{positionPage.closed.title}</CardTitle>
      <CardBody>{positionPage.closed.body}</CardBody>
      <CardLink href="/apply">{positionPage.closed.action}</CardLink>
    </StateCard>
  );
}
