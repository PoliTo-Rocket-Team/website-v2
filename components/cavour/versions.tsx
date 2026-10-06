import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FLIGHT_CONFIG, configs, specRows, type Config } from "./data";
import { SectionHead } from "./parts";

// 03 Versions. Board 23 (from md): one table of the three configurations,
// the SA Cup flight configuration's column highlighted. Board 23m (below md):
// a tab set, one configuration at a time, the flight configuration selected
// by default.

function Value({ value }: { value: string | null }) {
  if (value !== null) return <>{value}</>;
  return (
    <>
      <span aria-hidden className="text-dim">
        –
      </span>
      <span className="sr-only">Not given</span>
    </>
  );
}

function VersionsTable() {
  const cols = "grid grid-cols-[minmax(160px,340px)_1fr_1fr_1fr] gap-x-6";
  return (
    <div role="table" aria-label="Cavour configurations" className="mt-12 hidden md:block">
      <div role="row" className={`${cols} border-b border-hairline pb-4`}>
        <div role="columnheader">
          <span className="sr-only">Spec</span>
        </div>
        {configs.map((c) => {
          const flight = c.id === FLIGHT_CONFIG;
          return (
            <div role="columnheader" key={c.id}>
              <span
                className={`inline-block rounded-full border px-3 py-1 font-mono text-xs tracking-[0.15em] ${
                  flight ? "border-accent text-accent" : "border-white-10 text-prt-text"
                }`}
              >
                CVR {c.id}
              </span>
              <p className="mt-3 font-mono text-[11px] tracking-[0.2em] text-prt-muted">{c.role}</p>
            </div>
          );
        })}
      </div>
      {specRows.map(([key, label]) => (
        <div role="row" key={key} className={`${cols} items-center border-b border-hairline py-3`}>
          <span role="rowheader" className="font-mono text-[11px] tracking-[0.2em] text-prt-muted">
            {label}
          </span>
          {configs.map((c) => (
            <span
              role="cell"
              key={c.id}
              className={`text-[17px] ${c.id === FLIGHT_CONFIG ? "font-semibold text-prt-text" : "text-text-2"}`}
            >
              <Value value={c.specs[key]} />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function ConfigCard({ config }: { config: Config }) {
  const flight = config.id === FLIGHT_CONFIG;
  return (
    <>
      <p className="font-mono text-[10px] tracking-[0.15em] text-accent">
        {config.role}
        {flight && " · FLIGHT CONFIGURATION"}
      </p>
      <dl className="glass-card mt-4 rounded-2xl px-4 py-1">
        {specRows.map(([key, label]) => (
          <div key={key} className="flex items-center justify-between border-b border-hairline py-2.5 last:border-0">
            <dt className="font-mono text-[10px] tracking-[0.2em] text-prt-muted">{label}</dt>
            <dd className="text-[15px] font-semibold text-prt-text">
              <Value value={config.specs[key]} />
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}

function VersionsTabs() {
  return (
    <Tabs defaultValue={FLIGHT_CONFIG} className="mt-6 md:hidden">
      <TabsList aria-label="Configuration" className="rounded-full border border-white-10 bg-white-5 p-1">
        {configs.map((c) => (
          <TabsTrigger
            key={c.id}
            value={c.id}
            className="flex-1 rounded-full py-2 font-mono text-[13px] text-text-2 transition-colors duration-300 ease-out data-[state=active]:bg-prt-text data-[state=active]:text-ground"
          >
            {c.id}
          </TabsTrigger>
        ))}
      </TabsList>
      {configs.map((c) => (
        <TabsContent key={c.id} value={c.id} className="mt-4">
          <ConfigCard config={c} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

export function CavourVersions() {
  return (
    <section className="px-5 pt-14 md:px-16 md:pt-[120px]">
      <div className="mx-auto max-w-[1312px]">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end md:gap-8">
          <SectionHead eyebrow="03 – VERSIONS" title="One airframe, three configurations." />
          <p className="hidden max-w-[420px] text-[15px] leading-[22px] text-text-2 md:mb-2 md:block">
            Naming: CVR · body diameter (mm) · motor diameter (mm) · motor grains. Highlighted column is the SA Cup
            flight configuration.
          </p>
        </div>
        <VersionsTable />
        <VersionsTabs />
        <p className="mt-4 text-[13px] text-prt-muted md:hidden">
          Naming: CVR · body diameter · motor diameter · motor grains.
        </p>
      </div>
    </section>
  );
}
