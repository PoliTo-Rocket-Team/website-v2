import assert from "node:assert/strict";
import { test } from "node:test";
import { isTeamPageLayer, NO_TEAM_LAYER, textOf } from "./team-layer";
import { GROUP_PHOTO, placementOf } from "@/lib/photo-crops";
import { publicStoreHost } from "@/lib/storage/pathname";
import { describedGroupPhoto, groupPhotoDescriptions, withGroupPhoto } from "./team-page-edit";
import { ownsTeamPageUpload } from "./team-page-photos";
import { team } from "./team";
import { withLayerText } from "./team-roles";

// The Team page's visual layer (issues #283 and #855): the intro text, the
// figures and the group photo, read back only when this code could have
// written them. The page seats live in the stored layout (./team-layout.ts).

test("a layer is read back only when this code could have written it", () => {
  const owns = ownsTeamPageUpload(publicStoreHost("store_Own123"));
  const own = "https://own123.public.blob.vercel-storage.com/photos/team-page-1.jpg";
  const full = { intro: "Edited intro.", figures: team.header.stats, groupPhoto: { src: "/team/team-2026.jpg", alt: "The team in 2026" } };
  assert.ok(isTeamPageLayer(JSON.parse(JSON.stringify(full)), owns));
  assert.ok(isTeamPageLayer(NO_TEAM_LAYER, owns));
  // The group photo's description is optional (issue #430).
  assert.ok(isTeamPageLayer({ ...NO_TEAM_LAYER, groupPhoto: { src: "/team/team-2026.jpg", alt: "" } }, owns));
  // A group photo uploaded in the editor, on the store's own host (issue #510).
  assert.ok(isTeamPageLayer({ ...NO_TEAM_LAYER, groupPhoto: { src: own, alt: "The team in 2026" } }, owns));
  // A layer saved before the figures were editable has no figures key, and reads as one that left them alone.
  assert.ok(isTeamPageLayer({ ...NO_TEAM_LAYER, figures: team.header.stats }, owns));
  const bad: unknown[] = [
    null,
    { ...NO_TEAM_LAYER, intro: undefined },
    { ...NO_TEAM_LAYER, groupPhoto: { src: "https://x.example/p.jpg", alt: "x" } },
    // Another Blob store's Team page upload, and a file of the own store that the editor did not upload.
    { ...NO_TEAM_LAYER, groupPhoto: { src: "https://other456.public.blob.vercel-storage.com/photos/team-page-1.jpg", alt: "x" } },
    { ...NO_TEAM_LAYER, groupPhoto: { src: "https://own123.public.blob.vercel-storage.com/photos/member-1.jpg", alt: "x" } },
    // Always four figures, each with a value and a label.
    { ...NO_TEAM_LAYER, figures: team.header.stats.slice(0, 3) },
    { ...NO_TEAM_LAYER, figures: [{ value: "", label: { text: "MEMBERS" } }, ...team.header.stats.slice(1)] },
    // The people fields epic #835 kept for one release are gone since issue #855.
    { ...NO_TEAM_LAYER, leader: {} },
    { ...NO_TEAM_LAYER, spots: {} },
    { ...NO_TEAM_LAYER, addedLeaders: [] },
    { ...NO_TEAM_LAYER, departments: {} },
    { ...NO_TEAM_LAYER, addedDepartments: [] },
    { ...NO_TEAM_LAYER, extra: 1 },
  ];
  for (const value of bad) assert.equal(isTeamPageLayer(value, owns), false, JSON.stringify(value));
});

test("the group photo's crops are an optional layer key: kept through save and read, absent reads as centred, malformed is refused", () => {
  const owns = ownsTeamPageUpload(publicStoreHost("store_Own123"));
  const own = "https://own123.public.blob.vercel-storage.com/photos/team-page-1.jpg";
  const crops = { phone: { x: 0.1, y: 0.2, width: 0.5, height: 0.5 } };
  // Uploaded and cropped in the editor (issue #971): the crop for phones only, laptops left centred.
  const picked = describedGroupPhoto(own, { [own]: "The team" }, { [own]: crops });
  const saved = textOf(withGroupPhoto(team, textOf(NO_TEAM_LAYER), picked));
  const read = JSON.parse(JSON.stringify(saved));
  assert.ok(isTeamPageLayer(read, owns));
  assert.deepEqual(read.groupPhoto, { src: own, alt: "The team", crops });
  assert.deepEqual(withLayerText(team, read).coreMembers.groupPhoto.crops, crops);
  // The phone box shows its crop; the laptop box, left unset, shows the photo centred.
  assert.deepEqual(placementOf(GROUP_PHOTO, read.groupPhoto.crops, { shape: "phone", box: "exact" }), { kind: "crop", crop: crops.phone });
  assert.equal(placementOf(GROUP_PHOTO, read.groupPhoto.crops, { shape: "desktop", box: "exact" })?.kind, "centre");
  // A layer saved before crops has no key: it reads, and its photo draws as it always did.
  const before = { ...NO_TEAM_LAYER, groupPhoto: { src: own, alt: "The team" } };
  assert.ok(isTeamPageLayer(before, owns));
  assert.equal(placementOf(GROUP_PHOTO, withLayerText(team, before).coreMembers.groupPhoto.crops, { shape: "phone", box: "exact" }), null);
  // An upload with no frame moved stores no key at all.
  assert.equal("crops" in withGroupPhoto(team, textOf(NO_TEAM_LAYER), describedGroupPhoto(own, {}, { [own]: {} })).groupPhoto!, false);
  for (const bad of [{ square: crops.phone }, { phone: { x: 0.8, y: 0, width: 0.5, height: 0.5 } }, { phone: { x: 0, y: 0, width: 0, height: 1 } }, [crops.phone]]) {
    assert.equal(isTeamPageLayer({ ...NO_TEAM_LAYER, groupPhoto: { src: own, alt: "", crops: bad } }, owns), false, JSON.stringify(bad));
  }
});

test("picking another group photo shows that photo's own description, never the one typed for the last", () => {
  const original = { src: "/team/team-2025.jpg", alt: "The team in 2025" } as const;
  let descriptions = groupPhotoDescriptions(original, original);
  // Typed for the record's photo, then another photo picked: it starts with none.
  descriptions = { ...descriptions, [original.src]: "Edited" };
  assert.deepEqual(describedGroupPhoto("/team/team-2026.jpg", descriptions), { src: "/team/team-2026.jpg", alt: "" });
  descriptions = { ...descriptions, "/team/team-2026.jpg": "The team in 2026" };
  // Back to the first: its own text is still there.
  assert.deepEqual(describedGroupPhoto(original.src, descriptions), { src: original.src, alt: "Edited" });
  assert.deepEqual(describedGroupPhoto("/team/team-2026.jpg", descriptions), { src: "/team/team-2026.jpg", alt: "The team in 2026" });
});
