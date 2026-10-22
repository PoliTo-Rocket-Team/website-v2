import assert from "node:assert/strict";
import { test } from "node:test";
import { interviewEmailHref } from "./interview-email";

// Open email in Move to interview (issue #207).

test("the interview email link carries the encoded subject and body for the applicant, the role and the lead", () => {
  const href = interviewEmailHref({
    to: "giulia.rossi@gmail.com",
    applicant: "Giulia Rossi",
    position: "Mission Analyst",
    lead: "Marco Bianchi",
    site: "https://politorocketteam.it/",
  });
  const url = new URL(href);
  assert.equal(url.protocol, "mailto:");
  assert.equal(url.pathname, "giulia.rossi@gmail.com");
  assert.ok(href.includes("?subject=PoliTo%20Rocket%20Team%20%E2%80%94%20interview%20for%20Mission%20Analyst&body="));
  assert.equal(url.searchParams.get("subject"), "PoliTo Rocket Team — interview for Mission Analyst");
  assert.equal(
    url.searchParams.get("body"),
    [
      "Hi Giulia,",
      "",
      "Thank you for applying to the PoliTo Rocket Team. We would like to invite you to an interview for Mission Analyst.",
      "",
      "Please sign in at https://politorocketteam.it/dashboard, open My applications and pick one of the times we offered.",
      "",
      "Best regards,",
      "Marco Bianchi",
    ].join("\n"),
  );
  // Encoded, not raw: no spaces or line breaks in the link itself.
  assert.ok(!/[\s]/.test(href));
});
