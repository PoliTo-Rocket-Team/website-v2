---
id: 0006
title: "A pitch is approved by Huey's yes in chat, recorded on the issue, never by an approval comment he types"
status: accepted
date: 2026-10-09
tags: [process, agents, pitch]
---

# 0006 — A pitch is approved by Huey's yes in chat, recorded on the issue, never by an approval comment he types

**What this decides:** Agents ask Huey whether to take on new work in chat. His answer there is the decision. An agent records that decision on the issue as a short, dated, neutral owner-decision statement, never as a quote of his chat text. The issue then gets agent-ready acceptance criteria, and an operator builds it. Huey never types an approval comment himself.

## Context

Fabrika wants a recorded founder yes before new work is built. Agents kept stopping to ask Huey to type an approval comment on GitHub. That is slow, and the yes he gives in chat already says the same thing.

Huey approved this route in chat on 2026-10-09; the approval is recorded at https://github.com/PoliTo-Rocket-Team/website-v2/issues/137#issuecomment-6081238745.

The flow below follows the owner correction at https://github.com/PoliTo-Rocket-Team/website-v2/issues/137#issuecomment-6081315238. The installed fabrika CLI has no special marker for a chat decision, and the sibling repo uses none for this, so the record is the owner-decision comment itself.

The repository is public. The owner decided on 2026-10-22 that his chat text is never quoted in the repository and that decisions are recorded as neutral owner-decision statements; that decision is recorded at https://github.com/PoliTo-Rocket-Team/website-v2/issues/566#issuecomment-6340657149 and is the authority for the amendment below.

## Decision

**Huey's yes in chat is the founder decision on a pitch; an agent records it on the issue as a neutral, dated owner-decision statement, the issue gets agent-ready acceptance criteria, and an operator builds it.**

1. **Huey says yes in chat.** The agent asks the pitch question as one yes/no question with its recommendation. Huey's chat answer is the founder decision.
2. **The agent records the decision as a comment on the issue**, in this shape:

   ```
   **Owner decision (<date>):** <neutral statement of what was decided>
   ```

   The statement says what was decided, in the agent's own neutral words. The date and the statement are the whole record.
3. **The issue gets agent-ready acceptance criteria.** Triage writes the criteria the decision calls for and marks the issue ready for an agent.
4. **An operator builds it.** One operator drives the issue through build, review and ship.

**Binding constraints.**
- Never ask Huey to type an approval comment. Ask in chat, then record his decision.
- Never quote his chat text, never paraphrase it as speech, and never attribute it with "Huey said" or similar. Record only what was decided.
- Never record a yes he did not give.
- Every recorded decision is a comment on the issue in the owner-decision shape, dated. A decision that lives only in chat is not recorded.
- An agent adds no other approval marker or comment on Huey's behalf. The owner-decision comment is the whole record.

## Consequences

- Pitches move at chat speed. Huey answers one question and the agent does the GitHub work.
- The record is still on the issue, dated, so later readers can check what was decided and when.
- Huey's chat text never reaches the public repository, and no lane waits for exact wording to post.
- Every agent posts as `hueypov`, so the board cannot tell Huey's own comments from an agent's. The record carries no proof of authorship beyond the agent's honesty, which is why an agent never records a yes he did not give.

## Amendments

- **#566 — Owner decisions are recorded as neutral, dated owner-decision statements; the quote template and the instruction to quote chat text are removed, on the owner decision at https://github.com/PoliTo-Rocket-Team/website-v2/issues/566#issuecomment-6340657149 (2026-10-22).**

## Records

no vocabulary impact
