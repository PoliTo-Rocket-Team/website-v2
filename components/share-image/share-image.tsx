import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { ReactNode } from "react";
import sharp from "sharp";
import { brand } from "@/lib/brand-colors";
import { drawnBackdrop } from "@/lib/share-image-backdrop";
import type { Backdrop, RepoFile, ShareCard } from "@/lib/share-image";

// Draws one share image (board 90, issue #454) from its card
// (lib/share-image.ts). Everything is read from disk: the fonts bundled
// beside this file (Archivo and Geist Mono, SIL Open Font License, the two
// families the site sets) and the images under public/ and design/. The one
// exception is a post's photo uploaded in the dashboard: it is fetched from
// this deployment's own public Blob store (issue #469, see
// lib/share-image-backdrop.ts). The image renderer reads PNG and JPEG only, so each image is
// decoded and sized here first: most of the site's textures, stills and
// photos are WebP.

export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 } as const;
export const SHARE_IMAGE_TYPE = "image/png";
export const SHARE_IMAGE_ALT = "PoliTo Rocket Team";

const { width: W, height: H } = SHARE_IMAGE_SIZE;
const PAD = 72;

const fromRoot = (file: string) => join(process.cwd(), file);

async function fonts() {
  const font = (file: string) => readFile(fromRoot(`components/share-image/fonts/${file}`));
  const [regular, bold, mono] = await Promise.all([font("archivo-400.ttf"), font("archivo-700.ttf"), font("geist-mono-400.ttf")]);
  return [
    { name: "Archivo", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Archivo", data: bold, weight: 700 as const, style: "normal" as const },
    { name: "Geist Mono", data: mono, weight: 400 as const, style: "normal" as const },
  ];
}

type Box = { width: number; height: number };

/**
 * An image as a data URL, sized to `box`: covered (cropped to fill) or
 * stretched to it. A photo or texture is JPEG; a still with transparency
 * stays PNG.
 */
async function picture(file: RepoFile, box: Box, fit: "cover" | "fill", alpha = false): Promise<string> {
  return sized(await readFile(fromRoot(file)), box, fit, alpha);
}

/** `picture` for bytes already in hand: a repo file's, or a post's stored photo's. Rejects bytes `sharp` cannot decode. */
async function sized(source: Uint8Array, box: Box, fit: "cover" | "fill", alpha = false): Promise<string> {
  const image = sharp(source).resize(box.width, box.height, { fit });
  const bytes = alpha ? await image.png().toBuffer() : await image.jpeg({ quality: 88 }).toBuffer();
  return `data:image/${alpha ? "png" : "jpeg"};base64,${bytes.toString("base64")}`;
}

async function logo(): Promise<string> {
  const svg = await readFile(fromRoot("public/brand/prt-logo-white.svg"));
  return `data:image/svg+xml;base64,${svg.toString("base64")}`;
}

/** A shade of the page ground, `alpha` from 0 to 1, for the gradients over a texture or photo. */
const ground = (alpha: number) => `rgba(10, 10, 10, ${alpha})`;

const full = { position: "absolute", left: 0, top: 0, width: W, height: H, display: "flex" } as const;

function Layer({ src }: { src: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- the image renderer draws plain <img>
  return <img src={src} alt="" width={W} height={H} style={full} />;
}

function Shade({ gradient }: { gradient: string }) {
  return <div style={{ ...full, backgroundImage: gradient }} />;
}

function Eyebrow({ children }: { children: string }) {
  return (
    <div style={{ display: "flex", fontFamily: "Geist Mono", fontSize: 16, lineHeight: 1, letterSpacing: 4, color: brand.accent }}>
      {children}
    </div>
  );
}

function Title({ children, size, width, lines }: { children: string; size: number; width: number; lines: number }) {
  return (
    <div
      style={{
        display: "block",
        marginTop: 24,
        maxWidth: width,
        fontFamily: "Archivo",
        fontWeight: 700,
        fontSize: size,
        lineHeight: 1.06,
        letterSpacing: -0.025 * size,
        color: brand.text,
        lineClamp: lines,
      }}
    >
      {children}
    </div>
  );
}

/** The subtitle; beside a project's vehicle it wraps short of the still (`width` 510). */
function Subtitle({ children, width = 630 }: { children: string; width?: number }) {
  return (
    <div
      style={{
        display: "block",
        marginTop: 30,
        maxWidth: width,
        fontFamily: "Archivo",
        fontSize: 26,
        lineHeight: 1.4,
        color: brand.text2,
        lineClamp: 3,
      }}
    >
      {children}
    </div>
  );
}

/** The logo bottom left, the page's address bottom right and the accent line along the bottom edge. */
function Footer({ logoSrc, url }: { logoSrc: string; url: string }) {
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: PAD,
          width: W - 2 * PAD,
          bottom: 68,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- the image renderer draws plain <img> */}
        <img src={logoSrc} alt="" width={220} height={32} />
        <div style={{ display: "flex", fontFamily: "Geist Mono", fontSize: 16, letterSpacing: 3, color: brand.text2 }}>{url}</div>
      </div>
      <div style={{ position: "absolute", left: 0, bottom: 0, width: W, height: 6, backgroundColor: brand.accent }} />
    </>
  );
}

/** The words top left, as the default, project and page layouts set them. */
function TopWords({ card, children }: { card: ShareCard; children?: ReactNode }) {
  return (
    <div style={{ position: "absolute", left: PAD, top: 76, display: "flex", flexDirection: "column" }}>
      <Eyebrow>{card.eyebrow}</Eyebrow>
      <Title size={76} width={600} lines={3}>
        {card.title}
      </Title>
      {children}
    </div>
  );
}

const sideShade = `linear-gradient(90deg, ${ground(0.06)} 0%, ${ground(0.38)} 25%, ${ground(0.7)} 50%, ${ground(0.84)} 75%, ${ground(0.95)} 100%)`;

/** A post's backdrop: its photo from disk, or from this deployment's public store, else the streak texture. */
async function backdropOf(backdrop: Backdrop): Promise<ReactNode> {
  const { shade: kind, src } = await drawnBackdrop(backdrop, {
    file: (file) => readFile(fromRoot(file)),
    fetch: (url, init) => fetch(url, init),
    picture: (bytes) => sized(bytes, SHARE_IMAGE_SIZE, "cover"),
  });
  const shade =
    kind === "photo"
      ? `linear-gradient(180deg, ${ground(0.15)} 0%, ${ground(0.45)} 40%, ${ground(0.8)} 70%, ${ground(0.95)} 100%)`
      : sideShade;
  return (
    <>
      <Layer src={src} />
      <Shade gradient={shade} />
    </>
  );
}

async function body(card: ShareCard): Promise<ReactNode> {
  switch (card.layout) {
    case "default": {
      // Cavour's vertical render, turned 40 degrees so its nose points up
      // and right, the whole rocket inside the frame (board 90, K2zr8Y).
      const rocket = { width: 73, height: 500 };
      const [texture, still] = await Promise.all([
        picture(card.texture, SHARE_IMAGE_SIZE, "cover"),
        picture(card.rocket, rocket, "fill", true),
      ]);
      return (
        <>
          <Layer src={texture} />
          <Shade gradient={sideShade} />
          {/* eslint-disable-next-line @next/next/no-img-element -- the image renderer draws plain <img> */}
          <img
            src={still}
            alt=""
            width={rocket.width}
            height={rocket.height}
            style={{ position: "absolute", left: 839 - rocket.width / 2, top: 324 - rocket.height / 2, transform: "rotate(40deg)" }}
          />
          <TopWords card={card}>
            <Subtitle>{card.subtitle}</Subtitle>
          </TopWords>
        </>
      );
    }
    case "project": {
      // The page panel's still (1968 x 930), scaled so the vehicle spans
      // the right half, nose right (board 90, IWf1F).
      const box = { width: 742, height: 351 };
      const [texture, still] = await Promise.all([
        picture(card.texture, SHARE_IMAGE_SIZE, "fill"),
        picture(card.still, box, "fill", true),
      ]);
      return (
        <>
          <Layer src={texture} />
          <Shade gradient={`linear-gradient(90deg, ${ground(0.55)} 0%, ${ground(0.45)} 50%, ${ground(0.6)} 100%)`} />
          {/* eslint-disable-next-line @next/next/no-img-element -- the image renderer draws plain <img> */}
          <img src={still} alt="" width={box.width} height={box.height} style={{ position: "absolute", left: 445, top: 125 }} />
          <TopWords card={card}>
            <Subtitle width={510}>{card.subtitle}</Subtitle>
          </TopWords>
        </>
      );
    }
    case "post":
      return (
        <>
          {await backdropOf(card.backdrop)}
          <div style={{ position: "absolute", left: PAD, bottom: 200, display: "flex", flexDirection: "column" }}>
            <Eyebrow>{card.eyebrow}</Eyebrow>
            <Title size={60} width={980} lines={3}>
              {card.title}
            </Title>
          </div>
        </>
      );
    case "page": {
      // The page texture, and the page's photo on the right fading into the
      // dark at its far edge and its foot (board 90, Zp3hm).
      const photoBox = { width: 500, height: H };
      const photoFrame = { position: "absolute", left: 0, top: 0, ...photoBox, display: "flex" } as const;
      const [texture, photo] = await Promise.all([
        picture(card.texture, SHARE_IMAGE_SIZE, "cover"),
        card.photo === null ? null : picture(card.photo, photoBox, "cover"),
      ]);
      return (
        <>
          <Layer src={texture} />
          <Shade gradient={`linear-gradient(90deg, ${ground(0.3)} 0%, ${ground(0.4)} 100%)`} />
          {photo !== null && (
            <div style={{ position: "absolute", left: W - photoBox.width, top: 0, width: photoBox.width, height: H, display: "flex" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- the image renderer draws plain <img> */}
              <img src={photo} alt="" width={photoBox.width} height={H} style={photoFrame} />
              <div style={{ ...photoFrame, backgroundImage: `linear-gradient(90deg, ${ground(0)} 0%, ${ground(0.1)} 60%, ${ground(0.9)} 100%)` }} />
              <div style={{ ...photoFrame, backgroundImage: `linear-gradient(180deg, ${ground(0)} 55%, ${ground(0.85)} 100%)` }} />
            </div>
          )}
          <TopWords card={card}>
            <Subtitle>{card.subtitle}</Subtitle>
          </TopWords>
        </>
      );
    }
  }
}

/** The share image of one card, as a 1200 x 630 PNG. */
export async function shareImage(card: ShareCard): Promise<ImageResponse> {
  const [content, logoSrc, fontList] = await Promise.all([body(card), logo(), fonts()]);
  return new ImageResponse(
    (
      <div style={{ ...full, backgroundColor: brand.ground }}>
        {content}
        <Footer logoSrc={logoSrc} url={card.url} />
      </div>
    ),
    { ...SHARE_IMAGE_SIZE, fonts: fontList },
  );
}
