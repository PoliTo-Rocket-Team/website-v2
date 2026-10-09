import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { GoogleSignInButton } from "@/components/login-form";
import { TestDeveloperSignIn, TestDeveloperSignInSpace } from "@/components/test-developer-sign-in";

export const metadata: Metadata = {
  title: "Sign in | Polito Rocket Team",
  description: "Sign in with your Google account.",
};

// Boards 36 (desktop) and 36m (phone): a full-height split with no navbar and
// no footer. The image side is a 420px band on top on phones. The whole
// sign-in panel is in the prerendered page, its background preloaded like
// the image side's; only the test developer entry waits for the request, in
// a space its own size (issue #157).
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="flex min-h-svh flex-col bg-ground md:flex-row">
      <ImageSide />
      <section className="relative flex flex-1 items-center justify-center overflow-hidden border-t border-hairline px-5 py-14 md:border-l md:border-t-0 md:px-10">
        <Image
          src="/login/gray.webp"
          alt=""
          fill
          priority
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-cover object-top"
        />
        <div aria-hidden="true" className="absolute inset-0 bg-ground/45" />

        <div className="relative flex w-full max-w-[320px] flex-col items-center text-center">
          <h1 className="text-[30px] font-bold leading-tight tracking-[-0.02em] md:text-[34px]">
            Sign in
          </h1>
          <p className="mt-2 text-[15px] text-text-2">Use your Google account to continue.</p>
          <div className="mt-7">
            <GoogleSignInButton />
          </div>
          <Suspense fallback={<TestDeveloperSignInSpace />}>
            <TestDeveloperEntry searchParams={searchParams} />
          </Suspense>
          <p className="mt-9 text-[12px] leading-relaxed text-text-2">
            The dashboard is available to team members only. Other accounts can apply for open
            positions.
          </p>
          <p className="mt-6 text-[12px] leading-relaxed text-text-2">
            By signing in, you agree to our
            <br />
            <Link href="/terms" className="text-prt-text transition-colors duration-300 ease-out hover:text-accent">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-prt-text transition-colors duration-300 ease-out hover:text-accent">
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

function ImageSide() {
  return (
    <section
      aria-label="Polito Rocket Team"
      className="relative h-[420px] shrink-0 overflow-hidden md:h-auto md:min-h-svh md:w-1/2"
    >
      <Image
        src="/login/plume.webp"
        alt=""
        fill
        priority
        sizes="(min-width: 768px) 50vw, 100vw"
        className="object-cover object-top"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-ground/20" />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-ground via-ground/80 to-transparent"
      />

      {/* The upright Cavour, with a streaky blurred flame under the tail. */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-[56px] flex -translate-x-1/2 flex-col items-center md:top-[18%]"
      >
        <Image
          src="/login/cavour-upright.webp"
          alt=""
          width={147}
          height={832}
          priority
          className="relative z-10 h-[230px] w-auto md:h-[400px]"
        />
        <div className="relative -mt-2 h-[160px] w-[64px] md:h-[280px] md:w-[96px]">
          <div className="absolute inset-0 rounded-full bg-gradient-to-b from-accent via-accent/40 to-transparent opacity-80 blur-xl" />
          <div className="absolute left-1/2 top-0 h-[85%] w-[18px] -translate-x-1/2 rounded-full bg-gradient-to-b from-prt-text via-prt-text/40 to-transparent blur-[6px] md:w-[28px]" />
          <div className="absolute left-1/2 top-0 h-[40%] w-[8px] -translate-x-1/2 rounded-full bg-gradient-to-b from-prt-text to-transparent blur-[2px] md:w-[11px]" />
        </div>
      </div>

      <Link href="/" aria-label="Polito Rocket Team home" className="absolute left-5 top-5 md:left-12 md:top-11">
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

      <div className="absolute inset-x-5 bottom-6 md:inset-x-12 md:bottom-12">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">Polito Rocket Team</p>
        <p className="mt-2 text-[22px] font-bold leading-tight tracking-[-0.01em] md:text-[28px]">
          Born for space, built in Torino.
        </p>
      </div>
    </section>
  );
}
