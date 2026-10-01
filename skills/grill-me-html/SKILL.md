---
name: grill-me-html
description: >
  Run a relentless design interview as adaptive HTML questionnaires.
  Map the plan as a design tree, ask only the current frontier each round,
  generate a browser questionnaire with soft branching, recommended answers,
  preview-pane visual options (wireframes / architecture sketches),
  review, and one-click Submit that writes answers back for the next round.
  When the frontier is empty, generate shared-understanding.html and wait
  until the user marks the session completed, then ask where in the current
  repo to save a copy and suggest the filename.
  Use when the user says "grill me html", "html grill", "grill-me-html",
  "grill me in a questionnaire", "ask me in the browser",
  "HTML questionnaire interview", "adaptive grill",
  or wants design decisions collected like a form instead of chat/terminal Q&A.
  Do not use for a chat-only /grill-me.
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
   and wait until the user clicks **Mark completed**.
7. Ask where the current repo should keep a copy, with a suggested path and filename.
   Write nothing into the repo until the user answers.

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
  --session <slug> \
  --config "$HOME/.grill-me-html/in-progress/<slug>/config-01.json"
```

Effects:

- injects config into the dark questionnaire template
- writes `~/.grill-me-html/in-progress/<slug>/round-01.html`
- opens browser / serves localhost
- keeps unsaved answers in `localStorage` for that session and round
- blocks until Submit
- writes `answers-01.json` in that same session folder
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
- Session files live in `~/.grill-me-html/in-progress/<slug>/`, not in the repo.

Fallback only if the waiter cannot run:

- open the HTML file
- user clicks **Copy JSON** and pastes into chat

## Workflow

### 0. Suggest the session folder, then wait

Before writing any round, suggest one folder name and wait for the user to accept or replace it.

- Form: `<repo-folder>-<short-topic>`, lowercase, hyphens only. Example: `aim-in-one-job-queue`.
- Repo folder is the basename of the current working directory.
- Short topic is a few words from what the user wants to grill.
- Put the suggestion in one line and say it will live at `~/.grill-me-html/in-progress/<slug>/`.
- Do not create the folder, and do not start round 1, until the user accepts or gives another name.
- If that slug is already in `in-progress/`, ask whether to continue it.
- If it is only in `archived/`, ask whether to return it to in-progress or pick a new name.
- After acceptance, keep this slug for every round, for `localStorage`, and for archive moves. Do not rename it later.

### 1. Load context

- Read the plan and relevant files.
- Look up facts yourself. Never ask for discoverable facts.

### 2. Maintain tree state

```text
Settled:    decisions already made
Frontier:   askable now
Blocked:    waiting on unsettled parents
Open facts: research in flight
```

### 3. Author the round config

Write `~/.grill-me-html/in-progress/<slug>/config-XX.json`.

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

### 4. Run the round (blocking)

```bash
node "$SKILL_DIR/scripts/run-round.mjs" \
  --round N \
  --session <slug> \
  --config "$HOME/.grill-me-html/in-progress/<slug>/config-NN.json"
```

Chat stays short:

```text
Round N frontier: <layer name> (K questions)
Opened in browser. Click Submit round when done — no paste needed.
```

### 5. Ingest answers

Read `~/.grill-me-html/in-progress/<slug>/answers-NN.json`.

Rules:

1. Prefer `customText` / `note` over bare option labels when they conflict.
2. `skipped` may mean hidden-by-branch (N/A) or unanswered (still open).
3. Never treat a recommendation as chosen unless selected.

### 6. Next round or finish

- Unblock dependents, author next config, run next `run-round.mjs`
- If user reverses an upstream decision, invalidate dependent branches
- If frontier empty:
  1. Write `~/.grill-me-html/in-progress/<slug>/summary.json` from settled decisions.
  2. Build the decision page, then serve it and block:

```bash
node "$SKILL_DIR/scripts/build-summary.mjs" \
  --session <slug> \
  --config "$HOME/.grill-me-html/in-progress/<slug>/summary.json"

node "$SKILL_DIR/scripts/serve-summary.mjs" \
  --session <slug>
```

  3. **Mark completed** moves the whole session folder to `~/.grill-me-html/archived/<slug>/`. Exit 0 with `next: ask_project_save_location`.
  4. **Return to in-progress** moves it back. Exit 0 with `next: resume_interview`, then keep grilling.
  5. On `ask_project_save_location`, run:

```bash
node "$SKILL_DIR/scripts/suggest-save.mjs" --session <slug>
```

     Show the suggested repo path, including the filename, and wait. Example question: save a markdown copy at `docs/plans/2026-10-02-job-queue.md`? The user may change the directory (`docs/plans`, `docs/plan`, `docs/reference`, or another path) and the filename.
  6. Write the copy only after they answer, and only at the path they chose:

```bash
node "$SKILL_DIR/scripts/render-markdown.mjs" \
  --session <slug> \
  --out docs/plans/2026-10-02-job-queue.md
```

     If they say not to copy it into the repo, leave the archived HTML where it is.
  7. Do not write `CONTEXT.md` unless they name that file.
  8. To undo Mark completed later:

```bash
node "$SKILL_DIR/scripts/move-session.mjs" --session <slug> --to in-progress
```

     Or open the session index, which lists both folders and has the same two actions:

```bash
node "$SKILL_DIR/scripts/serve-index.mjs"
```

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
- Final **shared-understanding** page with **Mark completed** and **Return to in-progress**
- Dark theme by default
- Unsaved round answers restored from `localStorage` after refresh

## Files

| Path | Role |
|---|---|
| `templates/questionnaire.html` | Offline questionnaire shell |
| `templates/shared-understanding.html` | Final decision / confirmation page |
| `scripts/run-round.mjs` | **Primary** one-shot: inject → serve → wait → answers |
| `scripts/serve-and-collect.mjs` | Lower-level waiter used by run-round |
| `scripts/build-summary.mjs` | Build shared-understanding.html inside the session folder |
| `scripts/serve-summary.mjs` | Wait for Mark completed or Return to in-progress |
| `scripts/serve-index.mjs` | List in-progress and archived sessions |
| `scripts/move-session.mjs` | Move a session between those two folders |
| `scripts/suggest-save.mjs` | Suggest the repo path and filename |
| `scripts/render-markdown.mjs` | Write the markdown copy into the repo |
| `references/config-schema.md` | Config + export + summary schema |
| `references/auto-continue.md` | Portable submit→continue contract |
| `~/.grill-me-html/in-progress/<slug>/` | Live session: `config-01.json`, `round-01.html`, `answers-01.json`, `shared-understanding.html` |
| `~/.grill-me-html/archived/<slug>/` | Same files after Mark completed |

## Do not

- Generate one giant questionnaire for every future branch
- Ask for discoverable facts
- Treat recommendations as chosen answers
- Implement before the user has marked the session completed and answered the save question
- Write the shared understanding into the repo, or into `CONTEXT.md`, before they choose a path
- Put session files in the repo's `.grill-me-html/` directory
- Background the waiter and hope the browser wakes you
- Require paste-JSON when the waiter can run
- Show two identical Review buttons on the last question
- Tie the skill to one agent platform’s private paths or event bus
