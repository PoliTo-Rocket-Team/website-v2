import { Fragment, type ReactNode } from "react";
import { LandingFooter } from "@/components/landing/footer";
import { LandingNavbar } from "@/components/landing/navbar";
import { PageSky } from "@/components/landing/page-sky";
import { siteFooterOf, type PageChrome } from "@/lib/page-chrome";
import {
  pageRowsOf,
  type NumberedBlock,
  type PageBlock,
  type PageRow,
  type ProjectPageRecord,
  type ProjectPart,
  type TextBlock,
} from "@/lib/project-pages";
import type { Project } from "@/lib/projects";
import { ProjectFacts } from "./facts";
import { ProjectGallery } from "./gallery";
import { ProjectHero } from "./hero";
import type { BlockFrame } from "./parts";
import { ProjectLaunches } from "./launches";
import { ProjectPhoto } from "./photo";
import { ProjectPlan } from "./plan";
import { ProjectReasons } from "./reasons";
import { ProjectText, TextRow } from "./story";
import { ProjectVersions } from "./versions";

// One project page as drawn, from a page record and the project's /projects
// entry: the public route draws the published record (./project-page.tsx),
// and the editor draws the record being typed under the edit shell, with each
// part outlined through `frame` (issue #298), with no navbar and no footer
// (`chrome="none"`, issue #495). Below the hero the page draws its blocks in
// order, leaving out a hidden one; two half-width text blocks in a row sit
// side by side (epic #522, `pageRowsOf`). Each part is outlined round its
// content (epic #614): the top in three parts (`ProjectPart`), and each
// block on the page's column, the gallery across the page as its carousel
// runs.

export type { ProjectPart };

/** Wraps one part of the page; the public page draws each part as it is. */
export type ProjectFrame = (part: ProjectPart, node: ReactNode) => ReactNode;

const bare: ProjectFrame = (_, node) => node;

/** The block wrapped in its frame. */
const framed = (frame: ProjectFrame, block: PageBlock, node: ReactNode): ReactNode => frame(`block:${block.id}`, node);

/** A block that fills the page's width: every kind but text. Its content sits in `frame`. */
function WideBlock({ numbered, project, frame }: { numbered: NumberedBlock<Exclude<PageBlock, TextBlock>>; project: Project; frame: BlockFrame }) {
  const { block } = numbered;
  // Every titled kind takes a number (`hasHeading`); facts and a photo have no heading.
  const num = numbered.num ?? "";
  switch (block.kind) {
    case "facts":
      return <ProjectFacts facts={block.facts} frame={frame} />;
    case "photo":
      return <ProjectPhoto photo={block.photo} caption={block.caption} frame={frame} />;
    case "versions":
      return <ProjectVersions num={num} name={project.name} versions={block} frame={frame} />;
    case "launches":
      return <ProjectLaunches num={num} log={block} texture={project.texture} frame={frame} />;
    case "timeline":
      return <ProjectPlan num={num} plan={block} frame={frame} />;
    case "points":
      return <ProjectReasons num={num} reasons={block} frame={frame} />;
    case "gallery":
      return <ProjectGallery num={num} name={project.name} gallery={block} frame={frame} />;
  }
}

/** A text block's frame sits around its column, inside the row, as the two stories' did. */
const textColumn = (frame: ProjectFrame, { block, num }: NumberedBlock<TextBlock>) => framed(frame, block, <ProjectText block={block} num={num} />);

function Row({ row, project, frame }: { row: PageRow; project: Project; frame: ProjectFrame }) {
  if (row.kind === "halves") {
    return (
      <TextRow>
        {row.blocks.map((half) => (
          <Fragment key={half.block.id}>{textColumn(frame, half)}</Fragment>
        ))}
      </TextRow>
    );
  }
  const numbered = row.block;
  if (numbered.block.kind === "text") {
    return <TextRow full={numbered.block.width === "full"}>{textColumn(frame, { block: numbered.block, num: numbered.num })}</TextRow>;
  }
  const block = numbered.block;
  return <WideBlock numbered={{ block, num: numbered.num }} project={project} frame={(node) => framed(frame, block, node)} />;
}

const rowKey = (row: PageRow) => (row.kind === "halves" ? row.blocks.map((b) => b.block.id).join("+") : row.block.block.id);

export function ProjectPageView(
  props: {
    project: Project;
    record: ProjectPageRecord;
    frame?: ProjectFrame;
  } & PageChrome,
) {
  const { project, record, frame } = props;
  const outlined = frame ?? bare;
  const footer = siteFooterOf(props);
  return (
    <div className="relative bg-ground">
      {footer !== null && <LandingNavbar />}
      {/* The footer's own top pad is the gap under the last block; with no footer the sky closes the page by one pad, below the last outline. */}
      <PageSky className={footer === null ? "pb-section" : ""}>
        <main>
          <ProjectHero
            project={project}
            hero={record.hero}
            underNavbar={footer !== null}
            frame={frame && ((part, node) => frame(`top:${part}`, node))}
          />
          {pageRowsOf(record).map((row) => (
            <Row key={rowKey(row)} row={row} project={project} frame={outlined} />
          ))}
        </main>
        {footer !== null && <LandingFooter inSky projects={footer} />}
      </PageSky>
    </div>
  );
}
