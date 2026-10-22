import type { Spec } from "@/lib/projects";
import type { NewProject } from "../new-project";
import type { EngineRecord, ProjectRecord, VehicleRecord } from "./record";

// Frozen (migration 0050, issue #525): `newProjectRecord` of
// lib/project-content/new-project.ts as it stood before page blocks, at
// 468cf55 on huey/landing-page. A project made after page blocks has no
// record from before them, so its `content` holds the one New project stored
// then (../row.ts, `newRowContent`); see ./record.ts for why the folder
// is kept.

/** The brand textures (board 21); a new project takes one by its address, so the same address always gets the same one. */
const TEXTURES = ["/textures/project-cavour.webp", "/textures/project-ves.webp", "/textures/project-efesto.webp"] as const;

function textureOf(slug: string): string {
  let hash = 0;
  for (const char of slug) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TEXTURES[hash % TEXTURES.length];
}

const spec = (label: string, value: string): Spec => ({ label: { text: label }, value: { text: value } });

/** The draft New project stores: whole, with starting copy, and the placeholder rocket on its card and page. */
export function newProjectRecord(input: NewProject, year: number): ProjectRecord {
  const name = input.name.trim();
  const kindLabel = input.kind === "vehicle" ? "Rocket" : "Engine";
  const intro = `${name} is a new ${kindLabel.toLowerCase()} by the PoliTo Rocket Team.`;
  const since = String(year);
  const base = {
    slug: input.slug,
    name,
    texture: textureOf(input.slug),
    description: intro,
    hero: {
      intro: { text: intro },
      status: "IN DESIGN",
      dates: `${since} – NOW`,
      // A rocket slot with no model of its own draws the placeholder.
      visual: { caption: `${name.toUpperCase()} · IN DESIGN`, rocket: {} },
      facts: [{ value: "In design", label: { text: "STATUS" } }] as const,
    },
    nameStory: {
      title: `Why ${name}.`,
      body: { text: [`Where the name ${name} comes from.`] as [string], phone: `Where the name ${name} comes from.` },
    },
    design: {
      title: "How it is built.",
      body: { text: ["What it is made of, and why."] as [string], phone: "What it is made of, and why." },
      parts: {
        label: "Parts",
        caption: "BOTTOM TO TOP",
        items: [{ name, desc: `${kindLabel} · in design`, phone: "In design" }] as const,
      },
    },
  };
  const card = {
    year: { text: `${since}–` },
    status: "IN DESIGN",
    statusTone: "light" as const,
    desc: { text: intro },
    specs: [spec("KIND", kindLabel), spec("SINCE", since), spec("STATUS", "In design")] as const,
  };
  const listing = {
    years: `${since} – NOW`,
    description: { text: intro },
    specs: [
      spec("KIND", kindLabel),
      spec("SINCE", since),
      spec("STATUS", "In design"),
      spec("TEAM", "PRT"),
      spec("CITY", "Torino"),
      spec("SCHOOL", "PoliTo"),
    ] as const,
  };
  if (input.kind === "vehicle") {
    const vehicle: VehicleRecord = { ...base, kind: "vehicle", card, listing: { ...listing, versions: [], logSummary: "IN DESIGN" } };
    return vehicle;
  }
  const engine: EngineRecord = { ...base, kind: "engine", card, listing: { ...listing, workLines: [], milestone: "IN DESIGN" } };
  return engine;
}
