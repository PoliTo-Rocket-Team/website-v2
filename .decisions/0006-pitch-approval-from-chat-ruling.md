---
id: 0006
title: "A pitch is approved by Huey's yes in chat, recorded on the issue, never by an approval comment he types"
status: accepted
date: 2026-10-09
tags: [process, agents, pitch]
---

# 0006 — A pitch is approved by Huey's yes in chat, recorded on the issue, never by an approval comment he types

**What this decides:** Agents ask Huey whether to take on new work in chat. His answer there is the ruling. An agent writes that answer onto the issue, word for word, so the gates can read it. Huey never types an approval comment himself.

## Context

Fabrika's pitch gate wants a recorded founder yes before new work is built. Agents kept stopping to ask Huey to type a `pitch-approved` comment on GitHub. That is slow, and the yes he gives in chat already says the same thing.

Huey ruled on this route on 2026-10-09 in chat: "okay so you can use all these". The ruling is quoted verbatim, with the question it answered, at https://github.com/PoliTo-Rocket-Team/website-v2/issues/137#issuecomment-6081238745.

## Decision

**Huey's yes in chat is the founder ruling on a pitch; an agent records it on the issue, and Huey is never asked to type an approval comment.**

1. **Ask in chat.** The agent asks the pitch question as one yes/no question with its recommendation. Huey's chat answer is the founder ruling.
2. **Post the ruling on the issue.** The agent posts a comment that quotes the answer verbatim, with the question, in this shape:

   ```
   **Huey's ruling, <date> (in chat), quoted verbatim:**
   > <his words>

   Question asked: <the question>
   ```

3. **A parentless `type:feature` is recorded by the triager** (triage step 6), in two parts:
   - a `decision-ruled:` marker that cites the ruling comment, written with `fabrika decision rule <n> --cites <comment URL>`;
   - a comment whose first line is `pitch-ruled: #<n> · ruling:<comment URL>` (`fabrika wire emit --format pitch-ruling` prints it).

   `fabrika guard pitch-guard check` then passes the issue by its ruling route. No `pitch-approved` comment is posted.
4. **An epic still needs `pitch-approved: appetite <S|M|L>` or a bet.** After Huey says yes in chat, the comment is posted for him from the `hueypov` account, with no agent stamp on it.

**Binding constraints.**
- Never ask Huey to type an approval comment. Ask in chat, then record his answer.
- Quote the ruling verbatim. Never paraphrase it, and never record a yes he did not give.
- Every recorded ruling cites its comment URL. A ruling that lives only in chat is not recorded.
- An agent never posts `pitch-approved` on its own judgement; it posts it for an epic only after Huey's yes in chat.

## Consequences

- Pitches move at chat speed. Huey answers one question and the agent does the GitHub work.
- The record is still on the issue, quoted and dated, so the gates and later readers can check it.
- Every agent posts as `hueypov`, so the board cannot tell Huey's own comments from an agent's. The verbatim quote and the date are what tie a ruling back to him.

## Records

no vocabulary impact
