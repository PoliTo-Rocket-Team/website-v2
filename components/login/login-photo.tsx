import { getImageProps } from "next/image";
import { loginBlur, type LoginPhotoSrc } from "./login-blur";

// A full-bleed background photo on /login (board 36), issue #446.
//
// Both photos are grainy shots under a shade. Past 1200 px wide the encoder
// spends its bytes on grain, not on detail you can see: the plume is 394 KB at
// its full 1504 px and 177 KB at 1200. A retina laptop asks for the 1920 file,
// so the widths above the cap leave the `srcSet`, and every screen gets at
// most the 1200 file.
//
// The photo paints after the heading and the button: it is not preloaded and
// not high priority, so it never queues ahead of the page's CSS and fonts.
// Until it arrives, its blurred preview holds the place.

/** The widest file a login photo is served at, in image px. */
const PHOTO_MAX_WIDTH = 1200;

export function LoginPhoto({
  src,
  sizes,
  position,
}: {
  src: LoginPhotoSrc;
  sizes: string;
  /** CSS `object-position`; the blurred preview lines up with it. */
  position: string;
}) {
  const { props } = getImageProps({
    src,
    alt: "",
    fill: true,
    sizes,
    loading: "eager",
    placeholder: "blur",
    blurDataURL: loginBlur[src],
    style: { objectPosition: position },
  });
  const candidates = cappedCandidates(props.srcSet);
  return (
    // getImageProps gives next/image's own <img> props; only the srcSet is cut.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...props}
      alt=""
      src={candidates.at(-1)?.url ?? props.src}
      srcSet={candidates.length > 0 ? candidates.map((c) => `${c.url} ${c.width}w`).join(", ") : undefined}
      className="object-cover"
    />
  );
}

type Candidate = { url: string; width: number };

/** The `srcSet` entries no wider than `PHOTO_MAX_WIDTH`, narrowest first. */
function cappedCandidates(srcSet: string | undefined): Candidate[] {
  if (srcSet === undefined) return [];
  return srcSet
    .split(", ")
    .map((entry) => {
      const [url, descriptor] = entry.split(" ");
      return { url, width: Number.parseInt(descriptor, 10) };
    })
    .filter((c) => c.width <= PHOTO_MAX_WIDTH);
}
