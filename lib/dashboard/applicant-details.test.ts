import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { applicantSections, type ApplicantDetails } from "./applicant-details";

const EMPTY: ApplicantDetails = {
  email: "giulia.rossi@example.com",
  phone: null,
  politoId: null,
  year: null,
  degree: null,
  birthDate: null,
  gender: null,
  country: null,
  origin: null,
  linkedin: null,
  referral: null,
};

const FULL: ApplicantDetails = {
  email: "giulia.rossi@example.com",
  phone: "+39 351 234 5678",
  politoId: "312456",
  year: "Year 1 Master's",
  degree: "Aerospace Engineering",
  birthDate: "2003-03-14",
  gender: "Female",
  country: "Italy",
  origin: "Domestic",
  linkedin: "https://www.linkedin.com/in/giuliarossi",
  referral: "Instagram",
};

describe("the Applications panel's applicant groups (issue #406)", () => {
  test("every field the apply form and Your details collect shows, in its group", () => {
    assert.deepEqual(applicantSections(FULL), [
      {
        title: "Contact",
        fields: [
          { label: "Email", value: "giulia.rossi@example.com" },
          { label: "Phone", value: "+39 351 234 5678" },
          { label: "PoliTo ID", value: "s312456" },
        ],
      },
      {
        title: "Studies",
        fields: [
          { label: "Year", value: "Year 1 Master's" },
          { label: "Degree", value: "Aerospace Engineering" },
        ],
      },
      {
        title: "Personal",
        fields: [
          { label: "Birth date", value: "14 Mar 2003" },
          { label: "Gender", value: "Female" },
          { label: "Country", value: "Italy" },
          { label: "Origin", value: "Domestic" },
          { label: "Found us through", value: "Instagram" },
        ],
      },
      { title: "Links", fields: [{ label: "LinkedIn", value: "linkedin.com/in/giuliarossi", href: "https://www.linkedin.com/in/giuliarossi" }] },
    ]);
  });

  test("only empty values are hidden, and a group with none left is hidden too", () => {
    assert.deepEqual(applicantSections({ ...EMPTY, country: "  ", degree: "Physics Engineering" }), [
      { title: "Contact", fields: [{ label: "Email", value: "giulia.rossi@example.com" }] },
      { title: "Studies", fields: [{ label: "Degree", value: "Physics Engineering" }] },
    ]);
  });

  test("a stored LinkedIn that is not a profile link shows as text, with no link", () => {
    const links = applicantSections({ ...EMPTY, linkedin: "giulia on linkedin" }).find((s) => s.title === "Links");
    assert.deepEqual(links?.fields, [{ label: "LinkedIn", value: "giulia on linkedin" }]);
  });
});
