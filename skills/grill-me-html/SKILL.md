---
name: grill-me-html
description: >
  Run a relentless design interview as adaptive HTML questionnaires.
  Map the plan as a design tree, ask only the current frontier each round,
  generate a browser questionnaire with soft branching, recommended answers,
  preview-pane visual options (wireframes / architecture sketches),
  review, and one-click Submit that writes answers back for the next round.
  When the frontier is empty, generate an offline shared-understanding.html
  decision page and wait for confirmation before implementing.
  Use when the user says "grill me html", "html grill", "grill-me-html",
  "grill me in a questionnaire", "ask me in the browser",
  "HTML questionnaire interview", "adaptive grill",
  or wants design decisions collected like a form instead of chat/terminal Q&A.
  Prefer type "preview" when options should be seen (UI layout, IA, architecture).
  Reach shared understanding first; do not implement until the user confirms.
license: MIT
---

# Grill Me HTML

Interview the user about a plan until you share the same design.

Present every round as a **self-contained HTML questionnaire** in the browser.
Do not run the interview as a long terminal question list.

Default UX:

1. User answers in the browser
2. Visual decisions use `preview` questions (see the mock, then choose)
3. User clicks **Submit round**
4. You automatically continue to the next round

No paste step by default.

## Product job

1. Build a design tree of decisions and dependencies.
2. Each round, ask only the **frontier**.
3. Render that frontier as HTML — use real previews when the decision is visual
   (UI wireframes or architecture diagrams as `type: "preview"`).
4. Block on the local waiter until Submit writes answers.
5. Read answers, recompute the tree, open the next round.
6. Stop when the frontier is empty. Build `shared-understanding.html`, open it,
   and wait for confirmation before acting.

## Core model

### Design tree

- roots = upstream decisions
- branches = downstream decisions
- edges = dependencies

### Frontier

Every decision you can ask **now** without guessing at unanswered parents.

Rules:

1. Ask the whole frontier in one round.
2. If B hard-depends on A and A is unsettled, keep B out of this round.
3. After answers arrive, recompute settled nodes and the next frontier.
4. Empty frontier ⇒ interview can end.

### Soft branching vs hard dependency

| Kind | Meaning | Where |
|---|---|---|
| Hard dependency | B must wait for A | Across rounds |
| Soft branching | A is already in this round; B visibility/options may change | Same page via `visibleWhen` |

When unsure, use a hard dependency.

## Auto-continue (read this)

Browser clicks cannot wake an idle agent by themselves.

“Submit → next step” works only through a **foreground wait contract**. Full write-up:

`references/auto-continue.md`

In short:

```text
you run run-round.mjs in the FOREGROUND (long timeout)
user clicks Submit
process exits 0 and prints RESULT {...}
you immediately read answers and continue
```

This is portable across coding agents (Pi, Claude Code, Cursor, Codex, …).
It does **not** depend on a platform-specific event bus.

### Canonical command

Resolve `SKILL_DIR` as the directory that contains this `SKILL.md`.

```bash
node "$SKILL_DIR/scripts/run-round.mjs" \
  --round 1 \
  --config .grill-me-html/config-01.json
```

Effects:

- injects config into the template
- writes `.grill-me-html/round-01.html`
- opens browser / serves localhost
- blocks until Submit
- writes `.grill-me-html/answers-01.json`
- prints `RESULT {"ok":true,"answers":"...","next":"read_answers_and_continue"}`
- exits 0

Then you:

1. read the answers file
2. update Settled / Frontier
3. write `config-02.json` and run `--round 2`
4. or finish if frontier is empty

### Hard rules

- Foreground only. Never background the waiter.
- Long timeout (30–60+ minutes is fine).
- Exit 0 ⇒ continue immediately. Do not ask “are you done?” / “提交了吗”.
- Prefer `run-round.mjs` over hand-rolled open/copy/paste.
- Workdir is agent-agnostic: `.grill-me-html/`.

Fallback only if the waiter cannot run:

- open the HTML file
- user clicks **Copy JSON** and pastes into chat

## Workflow

### 0. Load context

- Read the plan and relevant files.
- Look up facts yourself. Never ask for discoverable facts.

### 1. Maintain tree state

```text
Settled:    decisions already made
Frontier:   askable now
Blocked:    waiting on unsettled parents
Open facts: research in flight
```

### 2. Author the round config

Write `.grill-me-html/config-XX.json`.

Round config should include:

- `title`, `subtitle`, `round`
- `questions` (the frontier only)

Each question needs:

- `id`, `label`, `prompt`, optional `why`
- `type`: `single` | `multi` | `preview`
- `recommended`: value(s) + reason
- `options`: 2–5 concrete outcomes
- optional `visibleWhen`

Prefer **4–8** questions. One decision per question. Always recommend.


### When to use `preview`

Use `type: "preview"` when the user should **see** the options before choosing:

- UI shell / layout / navigation patterns
- information architecture wireframes
- architecture or data-flow sketches (ASCII or HTML/SVG)
- before/after or competing interaction models

Rules:

1. Every option must include non-empty `preview` text (description alone is not enough).
2. Selection is single-choice; the right-hand pane shows the focused option.
3. Prefer `previewFormat: "html"` for real offline wireframes/prototypes (self-contained HTML/CSS, no CDN, no JS).
4. Prefer plain `preview` text for ASCII diagrams / trade-off cards.
5. Keep abstract policy questions as `single` / `multi` — do not force preview chrome onto pure text decisions.

Schema: `references/config-schema.md`.

### 3. Run the round (blocking)

```bash
node "$SKILL_DIR/scripts/run-round.mjs" \
  --round N \
  --config .grill-me-html/config-NN.json
```

Chat stays short:

```text
Round N frontier: <layer name> (K questions)
Opened in browser. Click Submit round when done — no paste needed.
```

### 4. Ingest answers

Read `.grill-me-html/answers-NN.json`.

Rules:

1. Prefer `customText` / `note` over bare option labels when they conflict.
2. `skipped` may mean hidden-by-branch (N/A) or unanswered (still open).
3. Never treat a recommendation as chosen unless selected.

### 5. Next round or finish

- Unblock dependents, author next config, run next `run-round.mjs`
- If user reverses an upstream decision, invalidate dependent branches
- If frontier empty:
  1. Write `.grill-me-html/summary.json` from settled decisions
  2. Build the decision page:

```bash
node "$SKILL_DIR/scripts/build-summary.mjs" \
  --config .grill-me-html/summary.json \
  --out .grill-me-html/shared-understanding.html \
  --open
```

  3. Ask the user to confirm the shared understanding
  4. Only then implement

## UI already enforced by the template

- Mid-round: secondary **Review** + primary **Next**
- Last question: only **Review answers**
- Review page:
  - with waiter: **Submit round**
  - file-only fallback: **Copy JSON**
- Soft branching via `visibleWhen`
- Strong selected state + toast on choice
- `preview` questions: option list + live preview pane (hover/focus updates; click commits)
- HTML previews render in sandboxed iframes (no scripts)
- Final **shared-understanding** page for confirmation before implementation

## Files

| Path | Role |
|---|---|
| `templates/questionnaire.html` | Offline questionnaire shell |
| `templates/shared-understanding.html` | Final decision / confirmation page |
| `scripts/run-round.mjs` | **Primary** one-shot: inject → serve → wait → answers |
| `scripts/serve-and-collect.mjs` | Lower-level waiter used by run-round |
| `scripts/build-summary.mjs` | Build shared-understanding.html from summary.json |
| `references/config-schema.md` | Config + export + summary schema |
| `references/auto-continue.md` | Portable submit→continue contract |
| `.grill-me-html/` | Runtime workdir in the target project |

## Do not

- Generate one giant questionnaire for every future branch
- Ask for discoverable facts
- Treat recommendations as chosen answers
- Implement before confirmation
- Background the waiter and hope the browser wakes you
- Require paste-JSON when the waiter can run
- Show two identical Review buttons on the last question
- Tie the skill to one agent platform’s private paths or event bus
