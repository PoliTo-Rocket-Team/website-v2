import type { RocketModel } from "@/lib/rocket-model";
import EfestoBuilt from "./engine-efesto";
import CavourBuilt from "./rocket-cavour";
import PlaceholderBuilt from "./rocket-placeholder";
import VesBuilt from "./rocket-ves";

/**
 * The code-built model for each rocket model, and for Efesto's engine. Every
 * one takes the same `{ weather, length }` and is laid along +X, nose at +X,
 * so any stage draws any model in the same pose. Imports three.js: only a 3D
 * chunk may use it.
 */
export const builtRockets: Record<RocketModel, typeof CavourBuilt> = {
  cavour: CavourBuilt,
  ves: VesBuilt,
  efesto: EfestoBuilt,
  placeholder: PlaceholderBuilt,
};
