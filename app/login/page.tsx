import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { GoogleSignInButton } from "@/components/login-form";
import { RocketFlame } from "@/components/login/rocket-flame";
import { TestDeveloperSignIn } from "@/components/test-developer-sign-in";
import { brand } from "@/lib/brand-colors";

export const metadata: Metadata = {
  title: "Sign in | Polito Rocket Team",
  description: "Sign in with your Google account.",
};

// Boards 36 (desktop) and 36m (phone): a full-height split with no navbar and
// no footer. The image side is a 420px band on top on phones.
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="flex min-h-svh flex-col bg-ground md:flex-row">
      <ImageSide />
      {/* From md the rows split the free height 5 : 7 around the heading and
          button, which puts board 36's whole stack (y 315, 270 tall) in the
          middle. The rest flows into the last row, so the preview-only test
          developer section grows downward and never moves the heading up. */}
      <section className="relative flex flex-1 flex-col items-center overflow-hidden px-5 py-10 md:grid md:min-h-svh md:grid-rows-[5fr_auto_7fr] md:justify-items-center md:px-12 md:py-0">
        <Image
          src="/login/gray.webp"
          alt=""
          fill
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-cover object-[50%_59%]"
        />
        <div aria-hidden="true" className="absolute inset-0 bg-ground/55" />

        <div className="relative flex w-full max-w-[360px] flex-col items-center gap-7 text-center md:row-start-2">
          <div className="flex flex-col items-center gap-2.5">
            <h1 className="text-[36px] font-bold leading-[1.1]">Sign in</h1>
            <p className="text-[16px] leading-[1.1] text-text-2">Use your Google account to continue.</p>
          </div>
          <Suspense fallback={<div className="h-11 w-[209px]" aria-hidden="true" />}>
            <GoogleSignInButton />
          </Suspense>
        </div>

        <div className="relative flex w-full max-w-[360px] flex-col items-center text-center md:row-start-3 md:self-start">
          <Suspense fallback={null}>
            <TestDeveloperEntry searchParams={searchParams} />
          </Suspense>
          <p className="mt-7 max-w-[300px] text-[12px] leading-[1.6] text-prt-text/70 md:max-w-[320px]">
            The dashboard is available to team members only. Other accounts can apply for open
            positions.
          </p>
          <p className="mt-7 text-[12px] leading-[1.6] text-prt-text/50">
            By signing in, you agree to our
            <br />
            <Link href="/terms" className="font-medium text-prt-text transition-colors duration-300 ease-out hover:text-accent">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="font-medium text-prt-text transition-colors duration-300 ease-out hover:text-accent">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}

// Previews and `next dev` only (issue #141). Read at request time, never
// prerendered, so a build promoted to production cannot carry it.
async function TestDeveloperEntry({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const cb = (await searchParams).cb;
  return <TestDeveloperSignIn cb={typeof cb === "string" ? cb : null} />;
}

// Board 36's shade over the left photo: dark at the top under the logo,
// clear through the rocket, then down to ground under the caption.
const PHOTO_SHADE = `linear-gradient(to bottom, ${brand.ground}B3 0%, ${brand.ground}00 20%, ${brand.ground}00 55%, ${brand.ground}D9 82%, ${brand.ground} 100%)`;

function ImageSide() {
  return (
    <section
      aria-label="Polito Rocket Team"
      className="relative h-[420px] shrink-0 overflow-hidden md:h-auto md:min-h-svh md:w-1/2 md:border-r md:border-white-10"
    >
      <Image
        src="/login/plume.webp"
        alt=""
        fill
        priority
        sizes="(min-width: 768px) 50vw, 100vw"
        className="object-cover object-[50%_59%]"
      />
      <div aria-hidden="true" className="absolute inset-0" style={{ background: PHOTO_SHADE }} />

      {/* The stage is board 36's, centred; board 36m draws it at 0.43. */}
      <div className="absolute inset-x-0 top-[70px] flex justify-center md:top-[160px]">
        <RocketFlame
          className="shrink-0 origin-top scale-[0.43] md:scale-100"
          rocketClassName="-translate-y-[78px] md:translate-y-0"
        />
      </div>

      <Link href="/" aria-label="Polito Rocket Team home" className="absolute left-6 top-5 md:left-12 md:top-11">
        <Image
          src="/brand/prt-mark-white.svg"
          alt=""
          width={32}
          height={32}
          className="h-8 w-auto md:hidden"
        />
        <Image
          src="/brand/prt-logo-white.svg"
          alt=""
          width={220}
          height={32}
          className="hidden h-auto w-[220px] md:block"
        />
      </Link>

      <div className="absolute inset-x-6 bottom-6 md:inset-x-12 md:bottom-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-accent">Polito Rocket Team</p>
        <p className="mt-1.5 text-[22px] font-bold leading-tight md:mt-2 md:text-[28px]">
          Born for space, built in Torino.
        </p>
      </div>
    </section>
  );
}
