## Work flows through fabrika

report → triage → plan → build → review → ship. Every unit of work is a GitHub issue moving
through those stages; the fabrika skills run them, and the `fabrika` CLI's verbs are the ground
truth at every step.

**The default unit of work is a lane, and the operator drives it.** To get an issue built,
reviewed and shipped, spawn ONE **operator** on it (`operate` skill) — it runs the builder,
reviewer and shipper shells itself, feeds every outcome back to the lane ledger, and parks to a
human only when a gate genuinely needs one. Do not hand-dispatch the per-stage shells for normal
work, and never route around them with an ad-hoc general-purpose subagent — an off-pipeline run
skips the gates.

| Work intent | Skill | Agent |
|---|---|---|
| Get one issue built → reviewed → shipped | `operate` | **operator** |
| Capture an observation / bug / idea | `report` | — |
| Classify + prioritize the backlog | `triage` | **triager** |
| Decompose a triaged epic into children | `plan-epic`, then `check-epic-plan` | — |
| Record a decision | `adr` | — |
| Record how the code is shaped | `write-pattern` | — |

The per-stage shells are surgical — resume a half-dead lane, re-run one gate, repair one PR —
never the normal entry point: `build` (**builder**), `review` (**reviewer**), `ship`
(**shipper**), and `heal-ci` for a PR that is green but going nowhere.
