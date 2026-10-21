import { Fragment, type ReactNode } from "react";
import { LandingFooter } from "@/components/landing/footer";
import { LandingNavbar } from "@/components/landing/navbar";
import { PageSky } from "@/components/landing/page-sky";
import { siteFooterOf, type PageChrome } from "@/lib/page-chrome";
import { pageRowsOf, type NumberedBlock, type PageBlock, type PageRow, type ProjectPageRecord, type TextBlock } from "@/lib/project-pages";
import { isSectionBlock, type SectionBlockId } from "@/lib/project-content/sections";
import type { Project } from "@/lib/projects";
import { ProjectFacts } from "./facts";
import { ProjectGallery } from "./gallery";
import { ProjectHero } from "./hero";
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
// side by side (epic #522, `pageRowsOf`).

/**
 * The page's parts the editor can outline: the hero, and each block it edits
 * through a section of its panel, by the block's id (lib/project-content/sections.ts).
 */
export type ProjectPart = "hero" | SectionBlockId;

/** Wraps one part of the page; the public page draws each part as it is. */
export type ProjectFrame = (part: ProjectPart, node: ReactNode) => ReactNode;

const bare: ProjectFrame = (_, node) => node;

/** The block wrapped in its frame when the editor edits it through a panel section, else as it is. */
function framed(frame: ProjectFrame, block: PageBlock, node: ReactNode): ReactNode {
  return isSectionBlock(block) ? frame(block.id, node) : node;
}

/** A block that fills the page's width: every kind but text. */
function WideBlock({ numbered, project }: { numbered: NumberedBlock<Exclude<PageBlock, TextBlock>>; project: Project }) {
  const { block } = numbered;
  // Every titled kind takes a number (`hasHeading`); facts and a photo have no heading.
  const num = numbered.num ?? "";
  switch (block.kind) {
    case "facts":
      return <ProjectFacts facts={block.facts} />;
    case "photo":
      return <ProjectPhoto photo={block.photo} caption={block.caption} />;
    case "versions":
      return <ProjectVersions num={num} name={project.name} versions={block} />;
    case "launches":
      return <ProjectLaunches num={num} log={block} texture={project.texture} />;
    case "timeline":
      return <ProjectPlan num={num} plan={block} />;
    case "points":
      return <ProjectReasons num={num} reasons={block} />;
    case "gallery":
      return <ProjectGallery num={num} name={project.name} gallery={block} />;
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
  return <>{framed(frame, numbered.block, <WideBlock numbered={{ block: numbered.block, num: numbered.num }} project={project} />)}</>;
}

const rowKey = (row: PageRow) => (row.kind === "halves" ? row.blocks.map((b) => b.block.id).join("+") : row.block.block.id);

export function ProjectPageView(
  props: {
    project: Project;
    record: ProjectPageRecord;
    frame?: ProjectFrame;
  } & PageChrome,
) {
  const { project, record, frame = bare } = props;
  const footer = siteFooterOf(props);
  return (
    <div className="relative bg-ground">
      {footer !== null && <LandingNavbar />}
      <PageSky>
        <main>
          {frame("hero", <ProjectHero project={project} hero={record.hero} underNavbar={footer !== null} />)}
          {pageRowsOf(record).map((row) => (
            <Row key={rowKey(row)} row={row} project={project} frame={frame} />
          ))}
        </main>
        {footer !== null && <LandingFooter inSky projects={footer} />}
      </PageSky>
    </div>
  );
}
