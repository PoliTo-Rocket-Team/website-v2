import type { Launch } from "@/lib/projects";

// The launch log (board 22): one row per campaign. A nominal result reads in
// the success green; a setback, a failed recovery or a flight that never left
// the pad, reads in the brand orange. The board never uses red.

/** No flight: nothing to measure. */
const NONE = "–";

function resultTone(launch: Launch) {
  return launch.flight?.nominal ? "text-success" : "text-accent";
}

function Result({ launch }: { launch: Launch }) {
  return (
    <>
      <p className={resultTone(launch)}>{launch.result}</p>
      {launch.award && (
        <p className="mt-1.5 font-mono text-[11px] tracking-[0.15em] text-accent">
          {launch.award.short ?? launch.award.name}
        </p>
      )}
    </>
  );
}

const head = "pb-4 text-left font-mono text-[11px] font-normal tracking-[0.2em] text-prt-muted";

/** From md: the table across the card. */
export function LaunchLog({ launches }: { launches: readonly Launch[] }) {
  return (
    <table className="w-full table-fixed text-[15px] leading-[1.4]">
      <colgroup>
        <col className="w-[110px] lg:w-[150px]" />
        <col />
        <col className="w-[96px] lg:w-[130px]" />
        <col className="w-[96px] lg:w-[130px]" />
        <col className="w-[210px] lg:w-[298px]" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col" className={head}>DATE</th>
          <th scope="col" className={head}>WHERE</th>
          <th scope="col" className={head}>APOGEE</th>
          <th scope="col" className={head}>MAX SPEED</th>
          <th scope="col" className={head}>RESULT</th>
        </tr>
      </thead>
      <tbody>
        {launches.map((l) => (
          <tr key={l.date} className="border-t border-white-10 align-top">
            <td className="py-4 pr-4 text-prt-text">{l.date}</td>
            <td className="py-4 pr-4 text-prt-text">{l.where}</td>
            <td className="py-4 pr-4 text-prt-text">{l.flight?.apogee ?? NONE}</td>
            <td className="py-4 pr-4 text-prt-text">{l.flight?.maxSpeed ?? NONE}</td>
            <td className="py-4">
              <Result launch={l} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Below md: the same rows, stacked inside the accordion. */
export function LaunchLogStacked({ launches }: { launches: readonly Launch[] }) {
  return (
    <ol className="text-[14px] leading-[1.45]">
      {launches.map((l, i) => (
        <li key={l.date} className={i === 0 ? "pb-4" : "border-t border-white-10 py-4"}>
          <p className="font-mono text-[11px] tracking-[0.15em] text-prt-muted">{l.date.toUpperCase()}</p>
          <p className="mt-1 text-prt-text">{l.where}</p>
          <dl className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <dt className="font-mono text-[9px] tracking-[0.2em] text-prt-muted">APOGEE</dt>
              <dd className="mt-0.5 font-semibold text-prt-text">{l.flight?.apogee ?? NONE}</dd>
            </div>
            <div>
              <dt className="font-mono text-[9px] tracking-[0.2em] text-prt-muted">MAX SPEED</dt>
              <dd className="mt-0.5 font-semibold text-prt-text">{l.flight?.maxSpeed ?? NONE}</dd>
            </div>
          </dl>
          <div className="mt-2">
            <Result launch={l} />
          </div>
        </li>
      ))}
    </ol>
  );
}
