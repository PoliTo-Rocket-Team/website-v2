// PRT brand colours (Pencil board 21, brand sheet). tailwind.config.ts builds
// its tokens from these, and the few places that cannot take a Tailwind class
// (an inline style painted before CSS loads, a gradient with pixel stops)
// import them here, so a brand change is one edit.
export const brand = {
  /** Ink: the page ground and the text on the accent. */
  ground: "#0A0A0A",
  /** Paper: primary text. */
  text: "#FAF9F7",
  /** Signal orange. */
  accent: "#FF5E00",
  accentHover: "#FF7526",
  accentPressed: "#E05200",
} as const;
