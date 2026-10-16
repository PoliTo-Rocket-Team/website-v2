import type { RocketModel } from "@/lib/rocket-model";
import CavourBuilt from "./rocket-cavour";
import PlaceholderBuilt from "./rocket-placeholder";

/**
 * The code-built vehicle for each rocket model. Every one takes the same
 * `{ weather, length }` and is laid along +X, nose at +X, so any stage draws
 * any model in the same pose. Imports three.js: only a 3D chunk may use it.
 */
export const builtRockets: Record<RocketModel, typeof CavourBuilt> = {
  cavour: CavourBuilt,
  placeholder: PlaceholderBuilt,
};
