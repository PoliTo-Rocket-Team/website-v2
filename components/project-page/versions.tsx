import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { specRows, versionList, type Version, type Versions } from "@/lib/project-pages";
import { SectionHead, Value } from "./parts";

// Versions. Boards 23 and 24 (from md): one table of the versions, the
// highlighted one's column bold under an accent pill. Boards 23m and 24m
// (below md): a tab set, one version at a time, the highlighted one selected
// by default.

function VersionsTable({ versions, label }: { versions: Versions; label: string }) {
  const list = versionList(versions);
  const cols = "grid gap-x-6";
  const grid = { gridTemplateColumns: `minmax(160px,340px) repeat(${list.length}, 1fr)` };
  return (
    <div role="table" aria-label={label} className="mt-12 hidden md:block">
      <div role="row" className={`${cols} border-b border-hairline pb-4`} style={grid}>
        <div role="columnheader">
          <span className="sr-only">Spec</span>
        </div>
        {list.map((v) => {
          const highlighted = v === versions.highlighted;
          return (
            <div role="columnheader" key={v.pill}>
              <span
                className={`inline-block rounded-full border px-3 py-1 font-mono text-xs tracking-[0.15em] ${
                  highlighted ? "border-accent text-accent" : "border-white-10 text-prt-text"
                }`}
              >
                {v.pill}
              </span>
              <p className="mt-3 font-mono text-[11px] tracking-[0.2em] text-prt-muted">{v.role.text}</p>
            </div>
          );
        })}
      </div>
      {specRows.map(([key, rowLabel]) => (
        <div role="row" key={key} className={`${cols} items-center border-b border-hairline py-3`} style={grid}>
          <span role="rowheader" className="font-mono text-[11px] tracking-[0.2em] text-prt-muted">
            {rowLabel}
          </span>
          {list.map((v) => (
            <span
              role="cell"
              key={v.pill}
              className={`text-[17px] ${v === versions.highlighted ? "font-semibold text-prt-text" : "text-text-2"}`}
            >
              <Value value={v.specs[key]} />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function VersionCard({ version }: { version: Version }) {
  return (
    <>
      <p className="font-mono text-[10px] tracking-[0.15em] text-accent">{version.role.phone ?? version.role.text}</p>
      <dl className="glass-card mt-4 rounded-2xl px-4 py-1">
        {specRows.map(([key, label]) => (
          <div key={key} className="flex items-center justify-between border-b border-hairline py-2.5 last:border-0">
            <dt className="font-mono text-[10px] tracking-[0.2em] text-prt-muted">{label}</dt>
            <dd className="text-[15px] font-semibold text-prt-text">
              <Value value={version.specs[key]} />
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}

function VersionsTabs({ versions }: { versions: Versions }) {
  const list = versionList(versions);
  return (
    <Tabs defaultValue={versions.highlighted.pill} className="mt-6 md:hidden">
      <TabsList aria-label="Version" className="rounded-full border border-white-10 bg-white-5 p-1">
        {list.map((v) => (
          <TabsTrigger
            key={v.pill}
            value={v.pill}
            className="flex-1 rounded-full py-2 font-mono text-[13px] text-text-2 transition-colors duration-300 ease-out data-[state=active]:bg-prt-text data-[state=active]:text-ground"
          >
            {v.tab}
          </TabsTrigger>
        ))}
      </TabsList>
      {list.map((v) => (
        <TabsContent key={v.pill} value={v.pill} className="mt-4">
          <VersionCard version={v} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

export function ProjectVersions({ num, name, versions }: { num: string; name: string; versions: Versions }) {
  return (
    <section className="px-5 pt-14 md:px-16 md:pt-[120px]">
      <div className="mx-auto max-w-[1312px]">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end md:gap-8">
          <SectionHead num={num} label="VERSIONS" title={versions.title} />
          <p className="hidden max-w-[420px] text-[15px] leading-[22px] text-text-2 md:mb-2 md:block">
            {versions.note.text}
          </p>
        </div>
        <VersionsTable versions={versions} label={`${name} versions`} />
        <VersionsTabs versions={versions} />
        <p className="mt-4 text-[13px] text-prt-muted md:hidden">
          {versions.note.phone ?? versions.note.text}
        </p>
      </div>
    </section>
  );
}
