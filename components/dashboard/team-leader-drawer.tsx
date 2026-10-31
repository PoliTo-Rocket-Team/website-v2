"use client";

import { useState, useTransition } from "react";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { addTeamLeader, handOverTeamLeader } from "@/app/dashboard/team-actions";
import type { TeamPick } from "@/lib/dashboard/division-edit";
import { advisorOptionDetail, BECOME_AN_ADVISOR, steppingDown, type HandOverOutcome } from "@/lib/dashboard/hand-over";
import type { StructureLeader } from "@/lib/dashboard/team-structure";
import { AddHolderLink, AddHolderPicker, HolderRows } from "./add-holder";
import { Avatar } from "./avatar";
import { PeoplePicker } from "./division-drawer";
import { PANEL_GHOST_BUTTON, PANEL_PRIMARY_BUTTON, PanelBody, SidePanel } from "./drawer";
import { FullAccessMoves, RadioChoice } from "./hand-over-choice";

// The Team Leader box's panel (board 77i, issue #253). It lists every team
// leader (epic #861), and for the team leader and full access it offers Add
// another holder (issue #869): one more team leader beside the ones the team
// has. A team leader also hands over their own role here ("Hand over your
// role"): they pick who takes over and what they do next, Become an advisor
// or Leave the team, and nothing is picked for them. The server checks every
// rule again (`planTeamLeaderHandOver`, lib/dashboard/hand-over.ts;
// `planTeamLeaderAdd`, lib/dashboard/team-seats.ts).

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const SECTION_LABEL = "text-[13px] text-prt-text";
const PERSON_CARD = "flex w-full items-center gap-3 rounded-xl border border-hairline px-3.5 py-3 text-left";
const TAG = "inline-flex h-[18px] shrink-0 items-center rounded px-1.5 font-mono text-[10px] uppercase tracking-[0.2em]";

export function TeamLeaderDrawer({
  open,
  leader,
  addsHolder,
  onClose,
}: {
  open: boolean;
  leader: StructureLeader;
  /** Add another holder: the team leader and full access (`departmentsEditable`). */
  addsHolder: boolean;
  onClose: () => void;
}) {
  const { holders, handsOver: you } = leader;
  const [adding, setAdding] = useState(false);
  const [next, setNext] = useState<TeamPick | null>(null);
  const [picking, setPicking] = useState(true);
  const [outcome, setOutcome] = useState<HandOverOutcome | null>(null);
  const [pending, startTransition] = useTransition();
  const ready = next !== null && outcome !== null;

  const handOver = () =>
    startTransition(async () => {
      if (next === null || outcome === null) return;
      const result = await handOverTeamLeader({ to: next.id, outcome });
      if (!result.ok) {
        toast.error("Could not hand over the role", { description: result.error });
        return;
      }
      toast.success(`${next.name} is the Team Leader now`);
      onClose();
    });

  return (
    <SidePanel
      open={open}
      onOpenChange={(nextOpen) => !nextOpen && onClose()}
      title={you === null ? "Team Leader" : "Hand over your role"}
      detail="Team Leader · full access"
      footer={
        you === null ? (
          <button type="button" onClick={onClose} className={PANEL_GHOST_BUTTON}>
            Close
          </button>
        ) : (
          <>
            <button type="button" onClick={onClose} className={PANEL_GHOST_BUTTON}>
              Cancel
            </button>
            <button type="button" onClick={handOver} disabled={!ready || pending} className={`${PANEL_PRIMARY_BUTTON} disabled:cursor-not-allowed disabled:opacity-50`}>
              Hand over the role
            </button>
          </>
        )
      }
    >
      <PanelBody>
        <section>
          <h3 className={SECTION_LABEL}>
            {holders.length > 1 ? "Team leaders" : "Team leader"}
            {holders.length > 1 && <span className="ml-1.5 text-prt-muted">{holders.length}</span>}
          </h3>
          <div className="mt-2.5">
            <HolderRows holders={holders} selfId={you?.id ?? null} />
          </div>
          {addsHolder &&
            (adding ? (
              <AddHolderPicker
                mode="leader"
                seat="Team Leader"
                short="the team"
                holders={holders}
                save={(personId) => addTeamLeader({ personId })}
                onCancel={() => setAdding(false)}
                onSaved={onClose}
              />
            ) : (
              <div className="mt-3">
                <AddHolderLink
                  onClick={() => {
                    setAdding(true);
                    // One picker at a time: the hand-over's closes while Add another holder's is open.
                    setPicking(false);
                  }}
                />
              </div>
            ))}
        </section>
        {you !== null && (
          <>
            <section className="mt-6">
              <h3 className={SECTION_LABEL}>Who takes over</h3>
              <div className="mt-2.5 flex flex-col gap-2">
                {next !== null && !picking && (
                  <button
                    type="button"
                    onClick={() => {
                      setPicking(true);
                      setAdding(false);
                    }}
                    aria-label={`${next.name} takes over. Pick someone else`}
                    className={`${PERSON_CARD} transition-colors duration-300 ease-out hover:border-border-strong ${FOCUS}`}
                  >
                    <Avatar size="md" person={next} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] text-prt-text">{next.name}</span>
                      <span className="block truncate text-[12px] text-prt-muted">{next.role} · picked</span>
                    </span>
                    <span className={`${TAG} bg-success-soft text-success`}>New</span>
                  </button>
                )}
                {picking && (
                  <PeoplePicker
                    mode="leader"
                    short="the team"
                    taken={(p) => (p.id === you.id ? "You hold the role now" : null)}
                    onPick={(p) => {
                      setNext(p);
                      setPicking(false);
                    }}
                    onClose={() => setPicking(next === null)}
                  />
                )}
                {next === null && !picking && (
                  <button
                    type="button"
                    onClick={() => {
                      setPicking(true);
                      setAdding(false);
                    }}
                    className={`${PERSON_CARD} text-[13px] text-text-2 transition-colors duration-300 ease-out hover:border-border-strong ${FOCUS}`}
                  >
                    Pick who takes over
                  </button>
                )}
                <div className={PERSON_CARD}>
                  <Avatar size="md" person={you} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] text-prt-text">{you.name}</span>
                    <span className="block truncate text-[12px] text-prt-muted">You · Team Leader now</span>
                  </span>
                  <span className={`${TAG} bg-white-10 text-prt-muted`}>You</span>
                </div>
              </div>
            </section>
            <section className="mt-6">
              <RadioChoice
                name="team-leader-next"
                legend="What you do next"
                layout="cards"
                value={outcome}
                onChange={setOutcome}
                options={[
                  { value: "advisor", title: BECOME_AN_ADVISOR, detail: `${advisorOptionDetail({ kind: "team-leader" }, null, "you")}.` },
                  { value: "leave", title: "Leave the team", detail: "Move to Alumni. Your account stays." },
                ]}
              />
            </section>
            <FullAccessMoves
              className="mt-6"
              seat="team-leader"
              successor={next?.name ?? null}
              from={null}
              step={outcome === null ? null : steppingDown({ kind: "team-leader" }, outcome)}
            />
            <p className="mt-6 flex gap-3 rounded-xl border border-hairline px-4 py-3.5 text-[13px] leading-relaxed text-text-2">
              <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-prt-muted" strokeWidth={1.75} />
              <span>
                Only you can hand over this role. {next?.name ?? "The person you pick"} becomes Team Leader when you save. From then on they approve orders, along
                with anyone they give Approve orders.
              </span>
            </p>
          </>
        )}
      </PanelBody>
    </SidePanel>
  );
}
