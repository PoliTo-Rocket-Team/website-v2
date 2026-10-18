// Sample pages (app/preview/*): fixed sample content that lets a reviewer see
// a look no real record draws yet, such as the placeholder rocket (#296,
// #360). They read no database and no dummy array, so they do not follow
// dummy mode (lib/dummy-data/mode.ts): a preview with its seeded database
// shows them too. Production never does; there the route answers 404.

/** The two variables the gate reads. */
export type SamplePagesEnv = {
  readonly NODE_ENV?: string;
  readonly VERCEL_ENV?: string;
};

function processSamplePagesEnv(): SamplePagesEnv {
  return { NODE_ENV: process.env.NODE_ENV, VERCEL_ENV: process.env.VERCEL_ENV };
}

/** Whether sample pages exist: on a Vercel preview, or under `next dev` with no Vercel environment. */
export function samplePagesOn(env: SamplePagesEnv = processSamplePagesEnv()): boolean {
  if (env.VERCEL_ENV) return env.VERCEL_ENV === "preview";
  return env.NODE_ENV === "development";
}
