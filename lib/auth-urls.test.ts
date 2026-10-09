import assert from "node:assert/strict";
import { test } from "node:test";
import {
  authUrls,
  LOCAL_URL,
  PRODUCTION_URL,
  PROXY_HOST_URL,
  trustedOriginsFor,
  trustsOrigin,
} from "./auth-urls";

const V2DEV_GOOGLE_CALLBACK = "https://v2dev.politorocketteam.it/api/auth/callback/google";
const PREVIEW_DEPLOYMENT_HOST = "website-v2-abc123xyz-info-42486522s-projects.vercel.app";
const PREVIEW_BRANCH_HOST = "website-v2-git-build-130-oauth-proxy-info-42486522s-projects.vercel.app";

const previewEnv = {
  VERCEL_ENV: "preview",
  VERCEL_URL: PREVIEW_DEPLOYMENT_HOST,
  VERCEL_BRANCH_URL: PREVIEW_BRANCH_HOST,
  VERCEL_GIT_COMMIT_REF: "build/130-oauth-proxy",
};

test("production signs in directly on v2, with the proxy off", () => {
  const urls = authUrls({ VERCEL_ENV: "production", VERCEL_URL: PREVIEW_DEPLOYMENT_HOST });
  assert.equal(urls.baseURL, "https://v2.politorocketteam.it");
  assert.equal(urls.baseURL, PRODUCTION_URL);
  assert.deepEqual(urls.proxy, { on: false });
  assert.equal(trustsOrigin(urls, `https://${PREVIEW_BRANCH_HOST}`), false);
});

test("a preview uses its own URL, with the proxy on through v2dev", () => {
  const urls = authUrls(previewEnv);
  assert.equal(urls.deployment, "preview");
  assert.equal(urls.baseURL, `https://${PREVIEW_BRANCH_HOST}`);
  assert.deepEqual(urls.proxy, {
    on: true,
    productionURL: "https://v2dev.politorocketteam.it",
    googleRedirectURI: V2DEV_GOOGLE_CALLBACK,
  });
});

test("a preview with no branch URL uses its deployment URL", () => {
  const urls = authUrls({ VERCEL_ENV: "preview", VERCEL_URL: PREVIEW_DEPLOYMENT_HOST });
  assert.equal(urls.baseURL, `https://${PREVIEW_DEPLOYMENT_HOST}`);
  assert.equal(urls.proxy.on, true);
});

test("local dev signs in directly on localhost:3000, with the proxy off", () => {
  for (const env of [{}, { VERCEL_ENV: "development" }]) {
    const urls = authUrls(env);
    assert.equal(urls.baseURL, "http://localhost:3000");
    assert.equal(urls.baseURL, LOCAL_URL);
    assert.deepEqual(urls.proxy, { on: false });
  }
});

test("v2dev, the proxy's fixed host, runs the plugin on its own URL", () => {
  const urls = authUrls({
    VERCEL_ENV: "preview",
    VERCEL_URL: "website-v2-def456-info-42486522s-projects.vercel.app",
    VERCEL_GIT_COMMIT_REF: "huey/landing-page",
  });
  assert.equal(urls.deployment, "proxy-host");
  assert.equal(urls.baseURL, PROXY_HOST_URL);
  assert.deepEqual(urls.proxy, {
    on: true,
    productionURL: PROXY_HOST_URL,
    googleRedirectURI: V2DEV_GOOGLE_CALLBACK,
  });
  // It accepts the round-trip from any of this project's previews.
  assert.equal(trustsOrigin(urls, `https://${PREVIEW_BRANCH_HOST}`), true);
});

test("a preview trusts its own origin, this project's previews and v2dev", () => {
  const urls = authUrls(previewEnv);
  for (const origin of [
    `https://${PREVIEW_BRANCH_HOST}`,
    `https://${PREVIEW_DEPLOYMENT_HOST}`,
    "https://website-v2-git-huey-landing-page-info-42486522s-projects.vercel.app",
    "https://v2dev.politorocketteam.it",
  ]) {
    assert.equal(trustsOrigin(urls, origin), true, origin);
  }
});

test("a preview rejects other projects' and look-alike origins", () => {
  const urls = authUrls(previewEnv);
  for (const origin of [
    "https://other-project.vercel.app",
    "https://website-v2-x-other-team.vercel.app",
    "https://website-v2-x-info-42486522s-projects.vercel.app.evil.com",
    "https://evil.website-v2-x-info-42486522s-projects.vercel.app",
    "https://website-v2-a.b-info-42486522s-projects.vercel.app",
    "http://website-v2-x-info-42486522s-projects.vercel.app",
    "https://website-v2-x-info-42486522s-projects.vercel.app:8443",
    "https://website-v2-x-info-42486522s-projects.vercel.app/path",
    "not a url",
  ]) {
    assert.equal(trustsOrigin(urls, origin), false, origin);
  }
});

test("the list handed to better-auth adds a request's Origin only when trusted", () => {
  const urls = authUrls(previewEnv);
  const from = (origin: string) => new Request("https://example.test/api/auth/x", { headers: { origin } });
  const sibling = "https://website-v2-git-other-pr-info-42486522s-projects.vercel.app";

  assert.ok(trustedOriginsFor(urls, from(sibling)).includes(sibling));
  assert.ok(!trustedOriginsFor(urls, from("https://other-project.vercel.app")).includes("https://other-project.vercel.app"));
  assert.deepEqual(trustedOriginsFor(urls, undefined), [...urls.origins]);
  assert.ok(urls.origins.includes("https://v2dev.politorocketteam.it"));
});

test("an unknown VERCEL_ENV, or a preview with no URL, is refused", () => {
  assert.throws(() => authUrls({ VERCEL_ENV: "staging" }));
  assert.throws(() => authUrls({ VERCEL_ENV: "preview" }));
});
