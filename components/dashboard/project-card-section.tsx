"use client";

import type { CardFields, SpecFields } from "@/lib/project-content/card-fields";
import type { HomeCardView } from "@/lib/project-content/record";
import { TextField } from "./content-parts";
import { Toggle } from "./controls";
import { Field, inputClass, LOCKED_INPUT } from "./field";
import { CopyField, type FieldErrors } from "./project-panel-parts";

// The Card section of the Edit <project> panel (board 75d, issue #300): the
// project's card as Home draws it, opened by the Edit card chip on Home or
// on the Projects list. Its number is the card's place in the site order,
// set on the Projects page, so it shows here but is not a field. In Phone the
// fields with a phone version edit it.

const TONES: readonly { readonly value: CardFields["statusTone"]; readonly label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

export const cardSummary = (card: HomeCardView) => `${card.num} · ${card.status}, description, 3 specs`;

export function CardEditor({
  card,
  shown,
  kind,
  phone,
  errors,
  onChange,
}: {
  card: CardFields;
  /** The card as it is drawn now: its number and the pill a flight count reads. */
  shown: HomeCardView;
  kind: "vehicle" | "engine";
  phone: boolean;
  errors: FieldErrors;
  onChange: (change: Partial<CardFields>) => void;
}) {
  const setSpec = (index: number, spec: SpecFields) =>
    onChange({ specs: card.specs.map((s, i) => (i === index ? spec : s)) as unknown as CardFields["specs"] });
  const counting = kind === "vehicle" && card.countsFlights;
  return (
    <>
      <p className="text-[12px] leading-relaxed text-prt-muted">
        Card {shown.num}. The number is the card&apos;s place in the site order; drag the cards on the Projects page to change it.
      </p>
      <TextField label="Name" hint="on the card, the page and the Projects list" value={card.name} error={errors["card.name"]} onChange={(name) => onChange({ name })} />
      <CopyField label="Year" copy={card.year} phone={phone} error={errors["card.year"]} onChange={(year) => onChange({ year })} />

      <div>
        {kind === "vehicle" && (
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <span className="text-[13px] leading-snug text-prt-text">Count flights on the status pill</span>
            <Toggle label="Count flights on the status pill" checked={card.countsFlights} onCheckedChange={(countsFlights) => onChange({ countsFlights })} />
          </div>
        )}
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-2.5">
          {counting ? (
            <div className="min-w-0">
              <p className="mb-2 text-[13px] leading-snug text-prt-text">Status</p>
              <p className={`${LOCKED_INPUT} font-mono tracking-[0.15em]`}>{shown.status}</p>
            </div>
          ) : (
            <TextField label="Status" placeholder="IN DESIGN" value={card.status} error={errors["card.status"]} onChange={(status) => onChange({ status })} />
          )}
          <Field label="Pill">
            {(id) => (
              <select
                id={id}
                value={card.statusTone}
                onChange={(e) => onChange({ statusTone: e.target.value as CardFields["statusTone"] })}
                className={`${inputClass()} px-2.5`}
              >
                {TONES.map((tone) => (
                  <option key={tone.value} value={tone.value}>
                    {tone.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        {counting && <p className="mt-1.5 text-[12px] text-prt-muted">Counted off the launch history.</p>}
      </div>

      <CopyField label="Description" rows={3} copy={card.desc} phone={phone} error={errors["card.desc"]} onChange={(desc) => onChange({ desc })} />

      {card.specs.map((spec, i) => (
        <div key={i} className="rounded-[10px] border border-hairline bg-white-5 p-3">
          <p className="mb-2 font-mono text-[10px] tracking-[0.2em] text-dim">SPEC {i + 1}</p>
          <div className="grid grid-cols-2 gap-2.5">
            <CopyField label="Label" copy={spec.label} phone={phone} error={errors[`card.specs.${i}.label`]} onChange={(label) => setSpec(i, { ...spec, label })} />
            <CopyField label="Value" copy={spec.value} phone={phone} error={errors[`card.specs.${i}.value`]} onChange={(value) => setSpec(i, { ...spec, value })} />
          </div>
        </div>
      ))}
    </>
  );
}
