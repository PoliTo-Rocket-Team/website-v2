"use client";

import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { GripVertical, Plus, Trash2, TriangleAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import { measurePartnerLogo, removePartner, reorderPartners, savePartner } from "@/app/dashboard/actions";
import { moveTo } from "@/lib/content/order";
import { editorVersion, statusOf, type ContentItem, type PublishStep } from "@/lib/content/versioned";
import { PARTNER_TEXT_LIMITS, type Partner, type PartnerLogo, type PartnerTier } from "@/lib/partners";
import { fieldsOf, partnerFieldErrors, websiteLabel, type PartnerFieldErrors, type PartnerFields } from "@/lib/partners-fields";
import type { MeasuredLogo } from "@/lib/partners-editor";
import { ConfirmDialog } from "./confirm-dialog";
import { CONTENT_FOCUS as FOCUS, PublishFooter, RowMenu, StatusPill, TextField, useDragOrder, type DragRow } from "./content-parts";
import { Toggle } from "./controls";
import { DrawerPage, PanelBody, SidePanel } from "./drawer";
import { EYEBROW, PageHeader, PRIMARY_PILL } from "./page-header";
import { PANEL } from "./panel";
import { RowOpen } from "./row-open";

// The Partners page (boards 76 and 76b, issue #256): the partners in site
// order, Main then Media, each row dragged to its place in its tier; a row or
// New partner opens the edit panel, whose Save draft keeps the public pages as
// they are and whose Publish puts the partner on them. The page keeps the
// list it was sent and each answer from the server; every write is checked
// there again, behind the site-content gate.

const TIERS: readonly { tier: PartnerTier; title: string; label: string }[] = [
  { tier: "main", title: "Main partners", label: "Main partner" },
  { tier: "media", title: "Media partners", label: "Media partner" },
];

type Panel = { kind: "closed" } | { kind: "new" } | { kind: "edit"; id: number };

const CLOSED: Panel = { kind: "closed" };

function shownOf(item: ContentItem<Partner>): Partner {
  return editorVersion(item.version);
}

export function PartnersView({ items: initial }: { items: readonly ContentItem<Partner>[] }) {
  const [items, setItems] = useState<readonly ContentItem<Partner>[]>(initial);
  const [panel, setPanel] = useState<Panel>(CLOSED);
  const ordered = [...items].sort((a, b) => a.siteOrder - b.siteOrder);
  const editing = panel.kind === "edit" ? (items.find((item) => item.id === panel.id) ?? null) : null;

  const saved = (item: ContentItem<Partner>) => {
    setItems((list) => (list.some((i) => i.id === item.id) ? list.map((i) => (i.id === item.id ? item : i)) : [...list, item]));
    setPanel({ kind: "edit", id: item.id });
  };
  const removed = (id: number) => {
    setItems((list) => list.filter((i) => i.id !== id));
    setPanel(CLOSED);
  };
  const reordered = (tier: PartnerTier, ids: readonly number[]) => {
    const before = items;
    // The tier keeps the slots it held, as the server keeps them (lib/content/order.ts).
    const slots = ordered.filter((i) => shownOf(i).tier === tier).map((i) => i.siteOrder);
    const next = new Map(ids.map((id, i) => [id, slots[i]]));
    setItems((list) => list.map((i) => (next.has(i.id) ? { ...i, siteOrder: next.get(i.id)! } : i)));
    void reorderPartners(tier, ids).then((result) => {
      if (!result.ok) {
        setItems(before);
        toast.error(result.error);
      }
    });
  };

  return (
    <DrawerPage drawerOpen={panel.kind !== "closed"} wide>
      <PageHeader
        title="Partners"
        intro="Partners on the Partners page and the home page logo strip, in site order. Drag to reorder."
        action={
          <button type="button" onClick={() => setPanel({ kind: "new" })} className={PRIMARY_PILL}>
            <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
            New partner
          </button>
        }
      />

      <div className="mt-6 flex flex-col gap-5">
        {TIERS.map(({ tier, title }) => (
          <TierGroup
            key={tier}
            title={title}
            items={ordered.filter((item) => shownOf(item).tier === tier)}
            selectedId={editing?.id ?? null}
            panelOpen={panel.kind !== "closed"}
            onOpen={(id) => setPanel({ kind: "edit", id })}
            onReorder={(ids) => reordered(tier, ids)}
            onRemoved={removed}
          />
        ))}
      </div>

      <PartnerPanel
        key={panel.kind === "edit" ? panel.id : panel.kind}
        open={panel.kind !== "closed" && (panel.kind === "new" || editing !== null)}
        item={editing}
        onClose={() => setPanel(CLOSED)}
        onSaved={saved}
        onRemoved={removed}
      />
    </DrawerPage>
  );
}

// One tier (board 76): its heading and count over its rows. A row drags
// within the tier only; its menu moves it up or down for the keyboard.
function TierGroup({
  title,
  items,
  selectedId,
  panelOpen,
  onOpen,
  onReorder,
  onRemoved,
}: {
  title: string;
  items: readonly ContentItem<Partner>[];
  selectedId: number | null;
  panelOpen: boolean;
  onOpen: (id: number) => void;
  onReorder: (ids: readonly number[]) => void;
  onRemoved: (id: number) => void;
}) {
  const ids = items.map((item) => item.id);
  const drag = useDragOrder(ids, onReorder);
  // Outside the rows: a click in the dialog would otherwise reach the row and open the panel.
  const [removing, setRemoving] = useState<ContentItem<Partner> | null>(null);
  const shown = drag.order.map((id) => items.find((item) => item.id === id)!).filter(Boolean);

  return (
    <section className={`${PANEL} overflow-hidden`}>
      <h2 className={`${EYEBROW} flex items-center gap-3 border-b border-hairline px-4 py-3.5 md:px-5`}>
        {title}
        <span className="text-prt-muted">{items.length}</span>
      </h2>
      {items.length === 0 ? (
        <p className="px-5 py-5 text-[14px] text-prt-muted">No partners here yet.</p>
      ) : (
        <ul className="divide-y divide-hairline" {...drag.list}>
          {shown.map((item, index) => (
            <PartnerRow
              key={item.id}
              item={item}
              selected={item.id === selectedId}
              panelOpen={panelOpen}
              drag={drag.row(item.id, index)}
              onOpen={() => onOpen(item.id)}
              onMove={index === 0 && index === items.length - 1 ? null : (to) => onReorder(moveTo(ids, item.id, to))}
              index={index}
              last={items.length - 1}
              onRemove={() => setRemoving(item)}
            />
          ))}
        </ul>
      )}
      {removing !== null && (
        <RemoveDialog open onOpenChange={(open) => !open && setRemoving(null)} item={removing} onRemoved={() => onRemoved(removing.id)} />
      )}
    </section>
  );
}

function PartnerRow({
  item,
  selected,
  panelOpen,
  drag,
  onOpen,
  onMove,
  index,
  last,
  onRemove,
}: {
  item: ContentItem<Partner>;
  selected: boolean;
  panelOpen: boolean;
  drag: DragRow;
  onOpen: () => void;
  onMove: ((to: number) => void) | null;
  index: number;
  last: number;
  onRemove: () => void;
}) {
  const partner = shownOf(item);
  // While a side panel is open from 1280px, the list keeps under half the width: the website
  // column and the grip give way and the logo box narrows, so the name and one line keep their
  // room (as Members, Orders and Access do, #244). Drag still works on the row itself.
  const squeezed = panelOpen ? "xl:hidden" : "";
  return (
    <li
      draggable
      onDragStart={drag.onDragStart}
      onDragOver={drag.onDragOver}
      onDragEnd={drag.onDragEnd}
      onClick={onOpen}
      className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors duration-300 ease-out md:gap-4 md:px-5 ${
        selected ? "bg-accent/[0.08]" : "hover:bg-white-5"
      } ${drag.dragged ? "opacity-50" : ""}`}
    >
      <GripVertical aria-hidden className={`hidden h-4 w-4 shrink-0 cursor-grab text-dim md:block ${squeezed}`} strokeWidth={1.75} />
      <LogoBox logo={partner.logo} name={partner.name} size={panelOpen ? "row-narrow" : "row"} />
      <span className="min-w-0 flex-1">
        <RowOpen label={`Open ${partner.name}`} onOpen={onOpen} className="block truncate text-[15px] text-prt-text">
          {partner.name}
        </RowOpen>
        <span className="block truncate text-[13px] text-prt-muted">{partner.oneLiner}</span>
      </span>
      <span className={`hidden w-[200px] shrink-0 truncate text-[13px] lg:block ${squeezed} ${partner.website ? "text-text-2" : "text-dim"}`}>
        {partner.website ? websiteLabel(partner.website) : "No website"}
      </span>
      <span className="w-[86px] shrink-0">
        <StatusPill status={statusOf(item.version)} short />
      </span>
      <RowMenu
        name={partner.name}
        onUp={onMove && index > 0 ? () => onMove(index - 1) : null}
        onDown={onMove && index < last ? () => onMove(index + 1) : null}
        onRemove={onRemove}
      />
    </li>
  );
}

/**
 * A logo on the dark ground, drawn white when it is too dark for the page, as
 * the public pages draw it. A logo the store did not keep shows the
 * partner's name, as the boards draw every logo.
 */
function LogoBox({
  logo,
  name,
  size,
}: {
  logo: Pick<PartnerLogo, "src" | "darkLogo">;
  name: string;
  // "row-narrow" is a list row beside an open side panel: it keeps the phone width from 1280px.
  size: "row" | "row-narrow" | "panel";
}) {
  const box = {
    row: "h-10 w-[78px] md:w-[110px] rounded-md bg-white-5 px-2.5",
    "row-narrow": "h-10 w-[78px] md:w-[110px] xl:w-[78px] rounded-md bg-white-5 px-2.5",
    panel: "h-[72px] w-[180px] rounded-lg border border-hairline bg-ground px-4",
  }[size];
  const img = size === "panel" ? "max-h-10" : "max-h-[22px]";
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden ${box}`}>
      {logo.src === "" ? (
        <span className="truncate text-[13px] font-semibold text-text-2">{name}</span>
      ) : (
        // An uploaded logo is a Blob or data URL; next/image would need every store host configured.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo.src} alt="" className={`max-w-full object-contain ${img} ${logo.darkLogo ? "brightness-0 invert" : ""}`} />
      )}
    </span>
  );
}

function RemoveDialog({
  open,
  onOpenChange,
  item,
  onRemoved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ContentItem<Partner>;
  onRemoved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const name = shownOf(item).name;
  const live = item.version.state === "published";
  const confirm = () =>
    startTransition(async () => {
      const result = await removePartner(item.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onOpenChange(false);
      onRemoved();
      toast.success(`${name} was removed.`);
    });
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={<Trash2 className="h-5 w-5" strokeWidth={1.75} />}
      title={`Remove ${name}?`}
      description={
        live
          ? `${name} leaves the Partners page and the home page logo strip at once, with its draft. This cannot be undone.`
          : `The draft of ${name} is deleted. This cannot be undone.`
      }
      cancelLabel="Keep partner"
      confirmLabel="Remove"
      danger
      pending={pending}
      onConfirm={confirm}
    />
  );
}

/** A logo picked in the panel and measured on the server, not saved yet. */
type PickedLogo = { file: File; preview: string; measured: MeasuredLogo };

// The edit panel (board 76b): the logo on the dark ground with its size and
// the "Draw it white" switch, which a picked logo's measurement pre-sets and
// the editor may flip (issue #394), and a warning, not a block, when the
// picked file sits on a solid box; Name and Tier, Website, then the three
// texts with their counters; Remove, Save draft and Publish at the foot. New
// partner is the same panel, empty, with no Remove.
function PartnerPanel({
  open,
  item,
  onClose,
  onSaved,
  onRemoved,
}: {
  open: boolean;
  item: ContentItem<Partner> | null;
  onClose: () => void;
  onSaved: (item: ContentItem<Partner>) => void;
  onRemoved: (id: number) => void;
}) {
  const current = item === null ? null : shownOf(item);
  const [fields, setFields] = useState<PartnerFields>(() => fieldsOf(current));
  const [picked, setPicked] = useState<PickedLogo | null>(null);
  const [darkLogo, setDarkLogo] = useState(current?.logo.darkLogo ?? false);
  const [logoError, setLogoError] = useState<string | undefined>();
  const [errors, setErrors] = useState<PartnerFieldErrors>({});
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const formId = useId();

  useEffect(() => () => {
    if (picked !== null) URL.revokeObjectURL(picked.preview);
  }, [picked]);

  const set = (name: keyof PartnerFields, value: string) => {
    setFields((f) => ({ ...f, [name]: value }));
    setErrors((e) => ({ ...e, [name]: undefined }));
  };

  const pick = (file: File | null) => {
    if (file === null) return;
    const form = new FormData();
    form.set("logo", file);
    setLogoError(undefined);
    startTransition(async () => {
      const result = await measurePartnerLogo(form);
      if (!result.ok) {
        setLogoError(result.error);
        return;
      }
      setPicked({ file, preview: URL.createObjectURL(file), measured: result.value });
      setDarkLogo(result.value.logo.darkLogo);
    });
  };

  const submit = (step: PublishStep) => {
    const found = partnerFieldErrors(fields);
    const missingLogo = item === null && picked === null;
    setErrors(found);
    if (missingLogo) setLogoError("Add the partner's logo.");
    if (Object.values(found).some((e) => e !== undefined) || missingLogo) return;
    const form = new FormData();
    for (const [name, value] of Object.entries(fields)) form.set(name, value);
    if (picked !== null) form.set("logo", picked.file);
    if (picked !== null || item !== null) form.set("darkLogo", String(darkLogo));
    startTransition(async () => {
      const result = await savePartner(item?.id ?? null, step, form);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setPicked(null);
      onSaved(result.value);
      const name = shownOf(result.value).name;
      toast.success(step === "publish" ? `${name} is published.` : `Draft of ${name} saved.`);
    });
  };

  const src = picked !== null ? picked.preview : current?.logo.src;
  const logo = src === undefined ? undefined : { src, darkLogo };
  const size = picked !== null ? picked.measured.logo : current?.logo;
  const status = item === null ? null : statusOf(item.version);
  const tierLabel = TIERS.find((t) => t.tier === (current?.tier ?? fields.tier))!.label;

  return (
    <SidePanel
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={item === null ? "New partner" : current!.name}
      wide
      below={
        status !== null && (
          <span className="mt-1.5 flex items-center gap-2.5 text-[13px] text-text-2">
            <StatusPill status={status} />
            {tierLabel}
          </span>
        )
      }
      footerLayout="spread"
      footer={<PublishFooter onRemove={item === null ? null : () => setConfirming(true)} pending={pending} onSubmit={submit} />}
    >
      <form id={formId} noValidate onSubmit={(e) => e.preventDefault()} className="flex min-h-0 flex-1 flex-col">
        <PanelBody className="flex flex-col gap-5">
          <div>
            <p className="mb-2 text-[13px] leading-snug text-prt-text">
              Logo <span className="ml-1.5 text-prt-muted">PNG, transparent background</span>
            </p>
            <div className="flex items-center gap-4">
              {logo !== undefined ? (
                <LogoBox logo={logo} name={fields.name || current?.name || ""} size="panel" />
              ) : (
                <span className="flex h-[72px] w-[180px] shrink-0 items-center justify-center rounded-lg border border-dashed border-white-10 text-[13px] text-dim">
                  No logo yet
                </span>
              )}
              <div className="min-w-0 space-y-1 text-[12px] leading-snug">
                {size !== undefined && (
                  <p className="truncate text-text-2">
                    {picked !== null && `${picked.file.name} · `}
                    {size.width} × {size.height}
                  </p>
                )}
                {logo !== undefined && (
                  <label className="flex w-fit cursor-pointer items-center gap-2 text-text-2">
                    <Toggle checked={darkLogo} onCheckedChange={setDarkLogo} label="Draw it white" />
                    Draw it white
                  </label>
                )}
                {picked?.measured.logo.darkLogo && <p className="text-prt-muted">Measured too dark for the page.</p>}
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/png,.png"
                  aria-label="Logo file"
                  className="sr-only"
                  onChange={(e) => {
                    pick(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => fileInput.current?.click()}
                  className={`inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-accent transition-colors duration-300 ease-out hover:text-accent-hover ${FOCUS}`}
                >
                  <Upload aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  {logo === undefined ? "Add logo" : "Replace logo"}
                </button>
              </div>
            </div>
            {picked?.measured.solidBackground && (
              <p role="status" className="mt-2 flex items-start gap-2 text-[13px] leading-snug text-warning">
                <TriangleAlert aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                This logo has a solid background, so the page shows a box around it. Use a PNG with a transparent background if you can.
              </p>
            )}
            {logoError !== undefined && <p className="mt-1.5 text-[12px] text-danger">{logoError}</p>}
          </div>

          <div className="grid gap-5 sm:grid-cols-[1fr_200px]">
            <TextField label="Name" value={fields.name} error={errors.name} onChange={(v) => set("name", v)} />
            <TierField value={fields.tier} onChange={(v) => set("tier", v)} />
          </div>
          <TextField
            label="Website"
            hint="optional"
            value={fields.website}
            error={errors.website}
            placeholder="https://"
            type="url"
            onChange={(v) => set("website", v)}
          />
          <TextField label="One line" value={fields.oneLiner} limit={PARTNER_TEXT_LIMITS.oneLiner} error={errors.oneLiner} onChange={(v) => set("oneLiner", v)} />
          <TextField label="About them" hint="optional" rows={3} value={fields.about} limit={PARTNER_TEXT_LIMITS.about} error={errors.about} onChange={(v) => set("about", v)} />
          <TextField
            label="What they do for us"
            hint="optional"
            rows={3}
            value={fields.support}
            limit={PARTNER_TEXT_LIMITS.support}
            error={errors.support}
            onChange={(v) => set("support", v)}
          />
        </PanelBody>
      </form>
      {item !== null && <RemoveDialog open={confirming} onOpenChange={setConfirming} item={item} onRemoved={() => onRemoved(item.id)} />}
    </SidePanel>
  );
}

/** Main or Media: one choice of two, as a segmented control (board 76b). */
function TierField({ value, onChange }: { value: string; onChange: (tier: PartnerTier) => void }) {
  const labelId = useId();
  return (
    <div>
      <p id={labelId} className="mb-2 text-[13px] leading-snug text-prt-text">
        Tier
      </p>
      <div role="radiogroup" aria-labelledby={labelId} className="grid h-11 grid-cols-2 gap-1 rounded-[10px] border border-white-10 bg-white-5 p-1">
        {TIERS.map(({ tier }) => (
          <TierOption key={tier} checked={value === tier} onSelect={() => onChange(tier)}>
            {tier === "main" ? "Main" : "Media"}
          </TierOption>
        ))}
      </div>
    </div>
  );
}

function TierOption({ checked, onSelect, children }: { checked: boolean; onSelect: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={`rounded-md text-[13px] transition-colors duration-300 ease-out ${FOCUS} ${
        checked ? "bg-white-10 font-semibold text-prt-text" : "text-text-2 hover:text-prt-text"
      }`}
    >
      {children}
    </button>
  );
}
