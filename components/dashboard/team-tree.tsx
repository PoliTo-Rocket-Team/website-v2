"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronDown, LocateFixed, Maximize2, Minus, Plus } from "lucide-react";
import { BOARD_SEAT_TITLES, divisionLabel, matchesQuery, type TeamTree, type TreePerson } from "@/lib/dashboard/team";
import { boxOf, layoutTeamTree, type Box, type TreeLayout, type TreeNode } from "@/lib/dashboard/tree-layout";
import { Avatar } from "./avatar";
import { SearchField } from "./directory";

// The Team tree as a family tree, drawn from the roster the data interface
// returns. From md it is board 54c: the whole tree on a canvas that pans
// (drag, wheel) and zooms (− / % / + / Fit, pinch), with a minimap, opening
// centred on the viewer's department. On phones it is board 54c-m: the same
// tree top-down and indented, each head and lead folding open in place, the
// viewer's department and division open first. Both draw the viewer's path
// from the leader down in accent and mark the viewer "you".

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const PILL = `inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-hairline px-3.5 text-[14px] font-medium text-prt-text transition-colors duration-300 ease-out hover:border-border-strong ${FOCUS}`;

function everyone(tree: TeamTree): TreePerson[] {
  return [
    ...(tree.leader ? [tree.leader] : []),
    ...tree.board.map((b) => b.person),
    ...tree.departments.flatMap((d) => [
      ...(d.head ? [d.head] : []),
      ...d.divisions.flatMap((v) => [...(v.lead ? [v.lead] : []), ...v.members]),
    ]),
  ];
}

/** A request to bring someone into view; the counter makes asking twice for one person move the view again. */
type Target = { readonly personId: number; readonly ask: number };

export function TeamTreeView({ tree }: { tree: TeamTree }) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<number | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const self = useMemo(() => everyone(tree).find((p) => p.self) ?? null, [tree]);

  const find = (next: string) => {
    setQuery(next);
    const match = next.trim() === "" ? null : everyone(tree).find((p) => matchesQuery([p.name], next)) ?? null;
    setFound(match?.id ?? null);
    if (match) setTarget((t) => ({ personId: match.id, ask: (t?.ask ?? 0) + 1 }));
  };

  const showMe = () => {
    if (!self) return;
    setQuery("");
    setFound(null);
    setTarget((t) => ({ personId: self.id, ask: (t?.ask ?? 0) + 1 }));
  };

  const people = `${tree.size} ${tree.size === 1 ? "person" : "people"}`;
  const detail = `${tree.season} team · ${people}.${self ? " Your path is highlighted." : ""}`;

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <header>
          <h1 className="text-[24px] font-bold leading-tight tracking-[-0.02em] md:text-[28px]">Team tree</h1>
          <p className="mt-1 text-[14px] text-prt-muted">{detail}</p>
        </header>
        <div className="flex items-center gap-2">
          <SearchField value={query} onChange={find} placeholder="Find someone" className="md:w-[240px]" />
          {self && (
            <button type="button" onClick={showMe} className={`${PILL} hidden md:inline-flex`}>
              <LocateFixed aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Show me
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 hidden md:block">
        <TreeCanvas tree={tree} found={found} target={target} />
      </div>
      <div className="mt-5 md:hidden">
        <PhoneTree tree={tree} found={found} target={target} />
      </div>
    </div>
  );
}

// Someone in several divisions is drawn once (board 54e): each other division
// they are in gets a blue "also" tag beside them and, on the canvas, a dashed
// blue line from that division. Blue keeps it apart from the accent path.

const ALSO_TAG = "inline-flex h-4 shrink-0 items-center whitespace-nowrap rounded-full bg-info-soft px-1.5 text-[10px] leading-none text-info";

function AlsoTags({ person }: { person: TreePerson }) {
  return (
    <>
      {person.also.map((d) => (
        <span key={d.divisionId} className={ALSO_TAG}>
          also {d.label}
        </span>
      ))}
    </>
  );
}

// The card every tree node above the member lists is drawn as.

function TreeCard({
  person,
  title,
  subtitle,
  onPath,
  found,
  trailing,
}: {
  person: TreePerson | null;
  title: string;
  subtitle: string | null;
  onPath: boolean;
  found: boolean;
  trailing?: ReactNode;
}) {
  return (
    <div
      className={`relative flex h-full w-full items-center gap-2.5 rounded-xl border px-2.5 text-left ${
        onPath ? "border-accent/70 bg-accent/[0.06]" : "border-hairline bg-panel"
      } ${found ? "ring-1 ring-accent" : ""}`}
    >
      {/* A card has no room beside it, so its tags hang from its lower edge. */}
      {person && person.also.length > 0 && (
        <span className="absolute -bottom-2 right-2 flex gap-1">
          <AlsoTags person={person} />
        </span>
      )}
      {person && <Avatar name={person.name} size="sm" accent />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold leading-tight text-prt-text">
          {title}
          {person?.self && " · you"}
        </span>
        {subtitle && (
          <span className={`mt-0.5 line-clamp-2 block text-[11px] leading-[1.25] ${onPath ? "text-accent" : "text-prt-muted"}`}>
            {subtitle}
          </span>
        )}
      </span>
      {trailing}
    </div>
  );
}

/**
 * A member under their lead: a small avatar and the name; the viewer's row is
 * outlined and marked "you". Their "also" tags follow the name and may run
 * past the row, as board 54e draws them.
 */
function MemberRow({ person, found }: { person: TreePerson; found: boolean }) {
  return (
    <div
      className={`flex h-full w-full items-center gap-2 rounded-lg border px-1.5 ${
        person.self ? "border-accent/70 bg-accent/[0.08]" : "border-transparent"
      } ${found ? "ring-1 ring-accent" : ""}`}
    >
      <Avatar name={person.name} size="xs" accent={person.self} />
      <span className={`truncate text-[12px] ${person.also.length > 0 ? "shrink-0" : "min-w-0"} ${person.self ? "font-semibold text-prt-text" : "text-text-2"}`}>
        {person.name}
        {person.self && " · you"}
      </span>
      <AlsoTags person={person} />
    </div>
  );
}

// Desktop (board 54c): the tree on a pan and zoom canvas.

type View = { readonly x: number; readonly y: number; readonly k: number };

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2;
const PAD = 48;
/** Room the zoom controls take at the top of the canvas. */
const TOP_ROOM = 72;
const MINIMAP_WIDTH = 184;

const clampZoom = (k: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k));

/** The view that puts `box` in the middle of a `size` canvas at zoom `k`, its top kept clear of the controls. */
function centredOn(box: Box, size: { w: number; h: number }, k: number): View {
  const x = size.w / 2 - (box.x + box.w / 2) * k;
  const middleY = size.h / 2 - (box.y + box.h / 2) * k;
  const topY = TOP_ROOM - box.y * k;
  return { x, y: box.h * k + TOP_ROOM + PAD > size.h ? topY : Math.max(middleY, topY), k };
}

function fitted(layout: TreeLayout, size: { w: number; h: number }): View {
  const k = clampZoom(Math.min((size.w - 2 * PAD) / layout.width, (size.h - TOP_ROOM - PAD) / layout.height, 1));
  return {
    x: (size.w - layout.width * k) / 2,
    y: TOP_ROOM + (size.h - TOP_ROOM - PAD - layout.height * k) / 2,
    k,
  };
}

function TreeCanvas({ tree, found, target }: { tree: TeamTree; found: number | null; target: Target | null }) {
  const layout = useMemo(() => layoutTeamTree(tree), [tree]);
  const frame = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [glide, setGlide] = useState(false);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const el = frame.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) setSize({ w: width, h: height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Open on the viewer's department, or on the whole tree when they have no place in it.
  useLayoutEffect(() => {
    if (!size || view) return;
    setView(layout.focus ? centredOn(layout.focus, size, 1) : fitted(layout, size));
  }, [size, view, layout]);

  const moveTo = useCallback((next: (current: View) => View) => {
    setGlide(true);
    setView((current) => (current ? next(current) : current));
  }, []);

  // Each request moves the view once; a resize later does not pull it back.
  const handled = useRef<Target | null>(null);
  useEffect(() => {
    if (!target || !size || handled.current === target) return;
    handled.current = target;
    const box = boxOf(layout, target.personId);
    if (box) moveTo((current) => centredOn(box, size, current.k));
  }, [target, size, layout, moveTo]);

  const zoomAt = useCallback((k: number, at: { x: number; y: number }) => {
    setView((current) => {
      if (!current) return current;
      const next = clampZoom(k);
      return { k: next, x: at.x - (at.x - current.x) * (next / current.k), y: at.y - (at.y - current.y) * (next / current.k) };
    });
  }, []);

  // Wheel pans; a pinch (or ctrl + wheel) zooms at the pointer. Bound by hand
  // because React's wheel listener is passive and cannot keep the page still.
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setGlide(false);
      if (event.ctrlKey) {
        const rect = el.getBoundingClientRect();
        setView((current) => {
          if (!current) return current;
          const next = clampZoom(current.k * Math.exp(-event.deltaY * 0.01));
          const at = { x: event.clientX - rect.left, y: event.clientY - rect.top };
          return { k: next, x: at.x - (at.x - current.x) * (next / current.k), y: at.y - (at.y - current.y) * (next / current.k) };
        });
      } else {
        setView((current) => (current ? { ...current, x: current.x - event.deltaX, y: current.y - event.deltaY } : current));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const step = (direction: 1 | -1) => {
    if (!view || !size) return;
    setGlide(true);
    zoomAt(Math.round((view.k + direction * 0.1) * 10) / 10, { x: size.w / 2, y: size.h / 2 });
  };

  const fit = () => {
    if (size) moveTo(() => fitted(layout, size));
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const pan: Record<string, [number, number]> = { ArrowLeft: [64, 0], ArrowRight: [-64, 0], ArrowUp: [0, 64], ArrowDown: [0, -64] };
    if (pan[event.key]) {
      event.preventDefault();
      const [dx, dy] = pan[event.key];
      moveTo((current) => ({ ...current, x: current.x + dx, y: current.y + dy }));
    } else if (event.key === "+" || event.key === "=") step(1);
    else if (event.key === "-") step(-1);
    else if (event.key === "0") fit();
  };

  return (
    <section
      ref={frame}
      aria-label="Team tree canvas. Drag or use the arrow keys to move, plus and minus to zoom."
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        if (event.button !== 0 || (event.target as Element).closest("[data-canvas-control]")) return;
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
        setGlide(false);
      }}
      onPointerMove={(event) => {
        const from = drag.current;
        if (!from || from.id !== event.pointerId) return;
        drag.current = { id: from.id, x: event.clientX, y: event.clientY };
        setView((current) => (current ? { ...current, x: current.x + event.clientX - from.x, y: current.y + event.clientY - from.y } : current));
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      className={`relative h-[calc(100svh-176px)] min-h-[520px] cursor-grab touch-none select-none overflow-hidden rounded-xl border border-hairline active:cursor-grabbing ${FOCUS}`}
    >
      <div
        className={`absolute left-0 top-0 origin-top-left ${glide ? "motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out" : ""} ${
          view ? "" : "invisible"
        }`}
        style={{
          width: layout.width,
          height: layout.height,
          transform: view ? `translate(${view.x}px, ${view.y}px) scale(${view.k})` : undefined,
        }}
      >
        <TreeLines layout={layout} />
        {layout.nodes.map((node) => (
          <div key={node.key} className="absolute" style={{ left: node.x, top: node.y, width: node.w, height: node.h }}>
            {node.kind === "card" ? (
              <TreeCard person={node.person} title={node.title} subtitle={node.subtitle} onPath={node.onPath} found={node.person?.id === found} />
            ) : (
              <MemberRow person={node.person} found={node.person.id === found} />
            )}
          </div>
        ))}
      </div>

      <div data-canvas-control className="absolute left-4 top-4 flex h-9 items-center rounded-lg border border-hairline bg-panel px-1 text-[12px]">
        <button type="button" aria-label="Zoom out" onClick={() => step(-1)} className={`flex h-7 w-7 items-center justify-center rounded-md text-prt-muted transition-colors duration-300 ease-out hover:text-prt-text ${FOCUS}`}>
          <Minus aria-hidden className="h-3.5 w-3.5" />
        </button>
        <output aria-live="polite" className="w-11 text-center font-mono text-[11px] text-prt-text">
          {Math.round((view?.k ?? 1) * 100)}%
        </output>
        <button type="button" aria-label="Zoom in" onClick={() => step(1)} className={`flex h-7 w-7 items-center justify-center rounded-md text-prt-muted transition-colors duration-300 ease-out hover:text-prt-text ${FOCUS}`}>
          <Plus aria-hidden className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={fit} className={`ml-1 flex h-7 items-center gap-1.5 rounded-md px-2 text-prt-muted transition-colors duration-300 ease-out hover:text-prt-text ${FOCUS}`}>
          <Maximize2 aria-hidden className="h-3.5 w-3.5" />
          Fit
        </button>
      </div>

      {layout.links.length > 0 && <AlsoLegend />}
      {view && size && <Minimap layout={layout} view={view} size={size} onCentre={(at) => moveTo((current) => ({ ...current, x: size.w / 2 - at.x * current.k, y: size.h / 2 - at.y * current.k }))} />}
    </section>
  );
}

/** What the dashed blue line means (board 54e), shown only while the tree draws one. */
function AlsoLegend() {
  return (
    <p data-canvas-control className="absolute bottom-4 left-4 flex h-8 items-center gap-2.5 rounded-lg border border-hairline bg-panel px-3 text-[11px] text-prt-muted">
      <svg aria-hidden width="24" height="2" className="overflow-visible">
        <line x1="0" y1="1" x2="24" y2="1" className="stroke-info" strokeWidth={1.5} strokeDasharray="4 3" />
      </svg>
      Also in another division · shown once
    </p>
  );
}

/**
 * The connectors, grey first, then the dashed blue lines to people drawn under
 * another division, then the viewer's path over them in accent, at 1px
 * whatever the zoom.
 */
function TreeLines({ layout }: { layout: TreeLayout }) {
  const line = (points: readonly (readonly [number, number])[]) => points.map(([x, y]) => `${x},${y}`).join(" ");
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 overflow-visible" width={layout.width} height={layout.height}>
      {layout.edges
        .filter((e) => !e.onPath)
        .map((e, i) => (
          <polyline key={`g${i}`} points={line(e.points)} fill="none" className="stroke-border-strong" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
      {layout.links.map((link) => (
        <polyline
          key={link.key}
          points={line(link.points)}
          fill="none"
          className="stroke-info"
          strokeWidth={1}
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {layout.edges
        .filter((e) => e.onPath)
        .map((e, i) => (
          <polyline key={`a${i}`} points={line(e.points)} fill="none" className="stroke-accent" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
    </svg>
  );
}

/** The whole tree in small, with the part in view outlined; a click centres the canvas there. */
function Minimap({
  layout,
  view,
  size,
  onCentre,
}: {
  layout: TreeLayout;
  view: View;
  size: { w: number; h: number };
  onCentre: (at: { x: number; y: number }) => void;
}) {
  const scale = MINIMAP_WIDTH / layout.width;
  const height = Math.max(24, layout.height * scale);
  // The part of the tree in view, cut to the tree's own edges.
  const left = Math.max(0, -view.x / view.k);
  const top = Math.max(0, -view.y / view.k);
  const right = Math.min(layout.width, (size.w - view.x) / view.k);
  const bottom = Math.min(layout.height, (size.h - view.y) / view.k);
  const seen = { x: left, y: top, w: Math.max(0, right - left), h: Math.max(0, bottom - top) };
  const cards = layout.nodes.filter((n): n is Extract<TreeNode, { kind: "card" }> => n.kind === "card");
  return (
    <div data-canvas-control className="absolute bottom-4 right-4 rounded-lg border border-hairline bg-panel p-2">
      <svg
        role="img"
        aria-label="Minimap"
        width={MINIMAP_WIDTH}
        height={height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        preserveAspectRatio="none"
        className="block cursor-pointer overflow-visible"
        onPointerDown={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          onCentre({ x: ((event.clientX - rect.left) / rect.width) * layout.width, y: ((event.clientY - rect.top) / rect.height) * layout.height });
        }}
      >
        {cards.map((n) => (
          <rect key={n.key} x={n.x} y={n.y} width={n.w} height={n.h} rx={8} className={n.onPath ? "fill-accent/70" : "fill-white-10"} />
        ))}
        <rect
          x={seen.x}
          y={seen.y}
          width={seen.w}
          height={seen.h}
          rx={8}
          fill="none"
          className="stroke-accent"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

// Phone (board 54c-m): the tree top-down and indented, the heads on one spine.

/** Where each nested list's rail sits, under the avatar of the card above it. */
const RAIL = "ml-[23px]";
const TICK = 18;

/**
 * Items hung on one vertical rail, each joined to it by a short tick at its
 * card's middle. The rail stops at the last item; the part down to the item
 * on the viewer's path is in accent.
 */
function Rail({ items, middle, gap }: { items: { key: string | number; onPath: boolean; node: ReactNode }[]; middle: number; gap: number }) {
  const pathIndex = items.findIndex((item) => item.onPath);
  return (
    <ul className="flex flex-col">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        const tickTop = gap + middle;
        const before = pathIndex > i;
        return (
          <li key={item.key} className="relative" style={{ paddingTop: gap, paddingLeft: TICK }}>
            <span aria-hidden className={`absolute left-0 top-0 border-l ${before ? "border-accent" : "border-border-strong"}`} style={last ? { height: tickTop } : { bottom: 0 }} />
            {item.onPath && <span aria-hidden className="absolute left-0 top-0 border-l border-accent" style={{ height: tickTop }} />}
            <span aria-hidden className={`absolute left-0 border-t ${item.onPath ? "border-accent" : "border-border-strong"}`} style={{ top: tickTop, width: TICK }} />
            {item.node}
          </li>
        );
      })}
    </ul>
  );
}

type Opened = { readonly departments: ReadonlySet<number>; readonly divisions: ReadonlySet<number> };

function openedOnPath(tree: TeamTree): Opened {
  return {
    departments: new Set(tree.path ? [tree.path.departmentId] : []),
    divisions: new Set(tree.path?.divisionId != null ? [tree.path.divisionId] : []),
  };
}

function toggled(set: ReadonlySet<number>, id: number): Set<number> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <ChevronDown
      aria-hidden
      className={`h-4 w-4 shrink-0 text-prt-muted motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out ${open ? "rotate-180" : ""}`}
    />
  );
}

function PhoneTree({ tree, found, target }: { tree: TeamTree; found: number | null; target: Target | null }) {
  const [opened, setOpened] = useState<Opened>(() => openedOnPath(tree));
  const nodes = useRef(new Map<number, HTMLElement>());
  const path = tree.path;
  const aboveDepartments = tree.leader?.self === true || tree.board.some((b) => b.person.self);
  const trunkOnPath = path !== null;

  // "Find someone" opens the branch the person is on and scrolls to them.
  useEffect(() => {
    if (!target) return;
    for (const department of tree.departments) {
      const division = department.divisions.find((v) => v.lead?.id === target.personId || v.members.some((m) => m.id === target.personId));
      if (department.head?.id === target.personId || division) {
        setOpened((o) => ({
          departments: new Set([...o.departments, department.id]),
          divisions: division && division.lead?.id !== target.personId ? new Set([...o.divisions, division.id]) : o.divisions,
        }));
      }
    }
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scroll = () => nodes.current.get(target.personId)?.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" });
    requestAnimationFrame(scroll);
  }, [target, tree]);

  const keep = (id: number | undefined) => (el: HTMLElement | null) => {
    if (id === undefined) return;
    if (el) nodes.current.set(id, el);
    else nodes.current.delete(id);
  };

  const line = (accent: boolean) => (accent ? "border-accent" : "border-border-strong");

  return (
    <div>
      {tree.leader && (
        <div ref={keep(tree.leader.id)} className="mx-auto h-[52px] w-[200px]">
          <TreeCard person={tree.leader} title={tree.leader.name} subtitle="Team Leader" onPath={trunkOnPath || aboveDepartments} found={found === tree.leader.id} />
        </div>
      )}

      {tree.board.length > 0 && (
        <div className="relative">
          {tree.leader && <span aria-hidden className={`mx-auto block h-3 w-0 border-l ${line(trunkOnPath || aboveDepartments)}`} />}
          {/* The bus to the two seats, and the trunk running down between them to the heads. */}
          <span aria-hidden className={`absolute left-[25%] right-[25%] border-t border-border-strong ${tree.leader ? "top-3" : "top-0"}`} />
          <span aria-hidden className={`absolute bottom-0 left-1/2 border-l ${line(trunkOnPath)} ${tree.leader ? "top-3" : "top-0"}`} />
          <div className="grid grid-cols-2 gap-3 pt-3">
            {tree.board.map(({ seat, person }, i) => (
              <div key={person.id} ref={keep(person.id)} className="relative h-[52px]">
                <span aria-hidden className={`absolute -top-3 left-1/2 h-3 border-l ${line(person.self)}`} />
                {person.self && (
                  <span aria-hidden className={`absolute -top-3 border-t border-accent ${i === 0 ? "left-1/2 -right-1.5" : "-left-1.5 right-1/2"}`} />
                )}
                <TreeCard person={person} title={person.name} subtitle={BOARD_SEAT_TITLES[seat]} onPath={person.self} found={found === person.id} />
              </div>
            ))}
          </div>
        </div>
      )}

      {tree.departments.length > 0 && (
        <>
          {/* From the trunk to the spine on the left, as on board 54c-m. */}
          <div aria-hidden className="relative h-5">
            <span className={`absolute left-1/2 top-0 h-2.5 border-l ${line(trunkOnPath)}`} />
            <span className={`absolute left-0 right-1/2 top-2.5 border-t ${line(trunkOnPath)}`} />
            <span className={`absolute bottom-0 left-0 top-2.5 border-l ${line(trunkOnPath)}`} />
          </div>
          <Rail
            middle={26}
            gap={12}
            items={tree.departments.map((department) => {
              const onDepartment = path?.departmentId === department.id;
              const isOpen = opened.departments.has(department.id);
              return {
                key: department.id,
                onPath: onDepartment,
                node: (
                  <div>
                    <button
                      ref={keep(department.head?.id)}
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpened((o) => ({ ...o, departments: toggled(o.departments, department.id) }))}
                      className={`block h-[52px] w-full rounded-xl ${FOCUS}`}
                    >
                      <TreeCard
                        person={department.head}
                        title={department.head?.name ?? department.name}
                        subtitle={department.head ? `Head of ${department.name}` : null}
                        onPath={onDepartment}
                        found={found !== null && department.head?.id === found}
                        trailing={<Chevron open={isOpen} />}
                      />
                    </button>
                    {isOpen && department.divisions.length > 0 && (
                      <div className={RAIL}>
                        <Rail
                          middle={26}
                          gap={8}
                          items={department.divisions.map((division) => {
                            const onDivision = onDepartment && path?.divisionId === division.id;
                            const divisionOpen = opened.divisions.has(division.id);
                            const label = divisionLabel(division.name);
                            return {
                              key: division.id,
                              onPath: onDivision,
                              node: (
                                <div>
                                  <button
                                    ref={keep(division.lead?.id)}
                                    type="button"
                                    aria-expanded={divisionOpen}
                                    onClick={() => setOpened((o) => ({ ...o, divisions: toggled(o.divisions, division.id) }))}
                                    className={`block h-[52px] w-full rounded-xl ${FOCUS}`}
                                  >
                                    <TreeCard
                                      person={division.lead}
                                      title={division.lead?.name ?? label}
                                      subtitle={division.lead ? `${label} · lead` : null}
                                      onPath={onDivision}
                                      found={found !== null && division.lead?.id === found}
                                      trailing={division.members.length > 0 ? <Chevron open={divisionOpen} /> : undefined}
                                    />
                                  </button>
                                  {divisionOpen && division.members.length > 0 && (
                                    <div className={RAIL}>
                                      <Rail
                                        middle={16}
                                        gap={4}
                                        items={division.members.map((person) => ({
                                          key: person.id,
                                          onPath: person.self,
                                          node: (
                                            <div ref={keep(person.id)} className="h-8">
                                              <MemberRow person={person} found={person.id === found} />
                                            </div>
                                          ),
                                        }))}
                                      />
                                    </div>
                                  )}
                                </div>
                              ),
                            };
                          })}
                        />
                      </div>
                    )}
                  </div>
                ),
              };
            })}
          />
        </>
      )}
    </div>
  );
}
