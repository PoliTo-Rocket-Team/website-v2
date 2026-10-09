---
id: 0006
title: "A pitch is approved by Huey's yes in chat, recorded on the issue, never by an approval comment he types"
status: accepted
date: 2026-10-09
tags: [process, agents, pitch]
---

# 0006 — A pitch is approved by Huey's yes in chat, recorded on the issue, never by an approval comment he types

**What this decides:** Agents ask Huey whether to take on new work in chat. His answer there is the ruling. An agent writes that answer onto the issue, word for word, with the question it answered. The issue then gets agent-ready acceptance criteria, and an operator builds it. Huey never types an approval comment himself.

## Context

Fabrika wants a recorded founder yes before new work is built. Agents kept stopping to ask Huey to type an approval comment on GitHub. That is slow, and the yes he gives in chat already says the same thing.

Huey ruled on this route on 2026-10-09 in chat: "okay so you can use all these". The ruling is quoted verbatim, with the question it answered, at https://github.com/PoliTo-Rocket-Team/website-v2/issues/137#issuecomment-6081238745.

The flow below follows the owner correction at https://github.com/PoliTo-Rocket-Team/website-v2/issues/137#issuecomment-6081315238. The installed fabrika CLI has no special marker for a chat ruling, and the sibling repo uses none for this, so the record is the quoted comment itself.

## Decision

**Huey's yes in chat is the founder ruling on a pitch; an agent posts it on the issue verbatim, the issue gets agent-ready acceptance criteria, and an operator builds it.**

1. **Huey says yes in chat.** The agent asks the pitch question as one yes/no question with its recommendation. Huey's chat answer is the founder ruling.
2. **The agent posts his words verbatim on the issue, with the question asked**, in this shape:

   ```
   **Huey's ruling, <date> (in chat), quoted verbatim:**
   > <his words>

   Question asked: <the question>
   ```

3. **The issue gets agent-ready acceptance criteria.** Triage writes the criteria the ruling calls for and marks the issue ready for an agent.
4. **An operator builds it.** One operator drives the issue through build, review and ship.

**Binding constraints.**
- Never ask Huey to type an approval comment. Ask in chat, then record his answer.
- Quote the ruling verbatim. Never paraphrase it, and never record a yes he did not give.
- Every recorded ruling is a comment on the issue, quoted and dated. A ruling that lives only in chat is not recorded.
- An agent adds no other approval marker or comment on Huey's behalf. The quoted comment is the whole record.

## Consequences

- Pitches move at chat speed. Huey answers one question and the agent does the GitHub work.
- The record is still on the issue, quoted and dated, so later readers can check it.
- Every agent posts as `hueypov`, so the board cannot tell Huey's own comments from an agent's. The verbatim quote and the date are what tie a ruling back to him.

## Records

no vocabulary impact
