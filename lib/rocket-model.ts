import { CAVOUR_CARD_POSTER, CAVOUR_STAGE_POSTER } from "@/components/landing/cavour-assets";
import { EFESTO_CARD_POSTER, EFESTO_STAGE_POSTER } from "@/components/landing/efesto-assets";
import { PLACEHOLDER_CARD_POSTER, PLACEHOLDER_STAGE_POSTER } from "@/components/landing/placeholder-assets";
import { VES_CARD_POSTER, VES_STAGE_POSTER } from "@/components/landing/ves-assets";

// Which model a project's card stage and page slot draw (issue #296). A
// model is code (components/landing/rocket-<name>.tsx, engine-<name>.tsx),
// never content: a project names the model written for it, and a project
// with none draws the shared placeholder until its own is built.

/** The vehicles written in code for one project each. */
export const ownRocketModels = ["cavour", "ves"] as const;
export type OwnRocketModel = (typeof ownRocketModels)[number];

/**
 * The engines written in code for one project each. Efesto is an engine that
 * has not flown, so it draws its engine, not a rocket (issue #382).
 */
export const ownEngineModels = ["efesto"] as const;
export type OwnEngineModel = (typeof ownEngineModels)[number];

/**
 * Every model written for a project. A rocket record names a rocket only; an
 * engine record may name either, because the import drew Cavour on Efesto's
 * card (lib/project-content/record.ts).
 */
export const ownModels = [...ownRocketModels, ...ownEngineModels] as const;
export type OwnModel = OwnRocketModel | OwnEngineModel;

/** What a model slot draws: a project's own model, or the shared placeholder. */
export type RocketModel = OwnModel | "placeholder";

/** The model to draw for a project: its own when it has one, else the placeholder. */
export function rocketModelOf(own: OwnModel | undefined): RocketModel {
  return own ?? "placeholder";
}

/**
 * The stills that stand in for each model's canvas: the card poster (shown
 * before the card canvas draws and without WebGL) and the project page's
 * panel still. Each is rendered offline from the model's own scene.
 */
const posters: Record<RocketModel, { card: string; stage: string }> = {
  cavour: { card: CAVOUR_CARD_POSTER, stage: CAVOUR_STAGE_POSTER },
  ves: { card: VES_CARD_POSTER, stage: VES_STAGE_POSTER },
  efesto: { card: EFESTO_CARD_POSTER, stage: EFESTO_STAGE_POSTER },
  placeholder: { card: PLACEHOLDER_CARD_POSTER, stage: PLACEHOLDER_STAGE_POSTER },
};

export function cardPosterOf(model: RocketModel): string {
  return posters[model].card;
}

/** A project's own model on its page, with the alt text its still carries. */
export type OwnRocket = { model: OwnModel; alt: string };

/**
 * The still a project page's panel draws for its model slot. The project's
 * own model reads with its alt text; the placeholder stands in for a vehicle
 * not yet modelled, so it is decorative and carries none.
 */
export function stageStillOf(own: OwnRocket | undefined): { src: string; alt: string } {
  const model = rocketModelOf(own?.model);
  return { src: posters[model].stage, alt: own?.alt ?? "" };
}
