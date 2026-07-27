# Questionnaire config schema

Inject this JSON into `templates/questionnaire.html` as `window.QUESTIONNAIRE_CONFIG`.

## Root

```ts
type QuestionnaireConfig = {
  skill: "grill-me-html";
  round: number;              // 1-based
  title: string;
  subtitle?: string;
  theme?: "plain" | "yudesk"; // default plain (monochrome shell)
  locale?: "zh" | "en";       // default en for built-in chrome copy
  handoff?: {
    mode?: "server" | "clipboard";
    submitUrl?: string;       // POST target used by Submit round
    answersHint?: string;     // path shown/logged for the agent
  };
  questions: Question[];
};
```

Notes:

- Default handoff is **server mode** via `scripts/serve-and-collect.mjs`
- The collector also sets `window.GRILL_ME_HTML_HANDOFF` so Submit works even if config was cloned at boot
- Clipboard / paste is only a fallback when no `submitUrl` is present


## Question

```ts
type Question = {
  id: string;
  label?: string;
  prompt: string;
  why?: string;
  type: "single" | "multi" | "preview";
  required?: boolean;         // default true; hidden questions are not required
  recommended?: {
    value?: string;           // single / preview recommendation
    values?: string[];        // multi recommendation set
    reason?: string;
  };
  options: Option[];
  visibleWhen?: Condition;    // hide whole question until condition holds
};
```

Question type semantics:

| type | Selection | When to use |
|---|---|---|
| `single` | pick one | mutually exclusive decisions; labels are enough |
| `multi` | pick many | non-exclusive set of capabilities / constraints |
| `preview` | pick one + preview pane | options need visible detail: UI wireframes, layout sketches, architecture snippets, before/after |

Rules for `preview`:

- every **declared** option must include non-empty `preview` text
- option `description` does **not** satisfy the preview requirement
- selection behaves like `single` (one answer)
- hover / focus updates the right-hand preview pane; click commits the choice
- prefer `preview` for visual product or architecture choices; keep `single` for abstract policy choices

## Option

```ts
type Option = {
  value: string;
  label: string;
  description?: string;
  preview?: string;           // required when question.type === "preview"
  previewFormat?: "text" | "html" | "auto"; // default "auto"
  visibleWhen?: Condition;    // hide this option until condition holds
};
```

### `preview` content

- `previewFormat: "text"` — plain / preformatted text in the pane (ASCII diagrams, bullet trade-offs, mermaid-like text)
- `previewFormat: "html"` — offline HTML/CSS fragment rendered in a sandboxed iframe (real wireframes / mini prototypes)
- `previewFormat: "auto"` (default) — if trimmed preview starts with `<`, treat as HTML; otherwise text

HTML preview constraints (offline skill):

- no external scripts, fonts, or CDN assets
- keep fragments self-contained (`<style>` + markup is fine)
- iframe is sandboxed (no script execution) — CSS-only interactive looks are OK; JS demos are not
- escape `</` in JSON strings as `\u003c/` when injecting via the template marker

### Preview example

```json
{
  "id": "nav-pattern",
  "label": "Navigation",
  "prompt": "Which primary navigation pattern for desktop?",
  "why": "Locks shell layout for every downstream screen.",
  "type": "preview",
  "recommended": {
    "value": "sidebar",
    "reason": "Better for multi-section tools with persistent context."
  },
  "options": [
    {
      "value": "sidebar",
      "label": "Left sidebar",
      "description": "Persistent section list + content.",
      "previewFormat": "html",
      "preview": "<div style=\"font:14px system-ui;border:1px solid #e5e5e5;border-radius:8px;overflow:hidden;display:grid;grid-template-columns:120px 1fr;height:160px\"><aside style=\"background:#f5f5f5;padding:10px;border-right:1px solid #e5e5e5\"><div style=\"font-weight:700;margin-bottom:8px\">App</div><div style=\"padding:6px 8px;background:#0a0a0a;color:#fff;border-radius:4px;margin-bottom:4px\">Home</div><div style=\"padding:6px 8px;color:#737373\">Docs</div><div style=\"padding:6px 8px;color:#737373\">Settings</div></aside><main style=\"padding:12px\"><div style=\"height:12px;width:40%;background:#e5e5e5;border-radius:4px;margin-bottom:10px\"></div><div style=\"height:72px;background:#fafafa;border:1px dashed #d4d4d4;border-radius:6px\"></div></main></div>"
    },
    {
      "value": "topnav",
      "label": "Top navigation",
      "description": "Horizontal tabs / links in the header.",
      "previewFormat": "html",
      "preview": "<div style=\"font:14px system-ui;border:1px solid #e5e5e5;border-radius:8px;overflow:hidden;height:160px;display:grid;grid-template-rows:44px 1fr\"><header style=\"display:flex;gap:12px;align-items:center;padding:0 12px;border-bottom:1px solid #e5e5e5;background:#fff\"><strong>App</strong><span style=\"padding:4px 8px;background:#0a0a0a;color:#fff;border-radius:4px\">Home</span><span style=\"color:#737373\">Docs</span><span style=\"color:#737373\">Settings</span></header><main style=\"padding:12px\"><div style=\"height:12px;width:40%;background:#e5e5e5;border-radius:4px;margin-bottom:10px\"></div><div style=\"height:72px;background:#fafafa;border:1px dashed #d4d4d4;border-radius:6px\"></div></main></div>"
    }
  ]
}
```

### Architecture preview example

Use `type: "preview"` with HTML system diagrams when choosing architecture — not a round-level map panel.

```json
{
  "id": "architecture",
  "label": "Architecture",
  "prompt": "Which architecture for comments in v1?",
  "type": "preview",
  "recommended": { "value": "modular-monolith", "reason": "One deploy, clear seams." },
  "options": [
    {
      "value": "monolith",
      "label": "Classic monolith",
      "description": "One app, one DB.",
      "previewFormat": "html",
      "preview": "<div>…system diagram HTML…</div>"
    },
    {
      "value": "modular-monolith",
      "label": "Modular monolith",
      "description": "One process, hard module boundaries.",
      "previewFormat": "html",
      "preview": "<div>…system diagram HTML…</div>"
    },
    {
      "value": "services",
      "label": "Split services",
      "description": "Separate deployables.",
      "previewFormat": "html",
      "preview": "<div>…system diagram HTML…</div>"
    }
  ]
}
```


## Condition

```ts
type Condition =
  | { questionId: string; values: string[]; match?: "any" | "all" }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition };
```

Semantics:

- Simple condition: compare current selected values of `questionId` with `values`
  - `match: "any"` (default): intersection non-empty
  - `match: "all"`: every listed value is selected
- Compose with `all` / `any` / `not`
- If the referenced question has no answer yet, the condition is false

## Export payload

The page **Submit round** (or fallback **Copy JSON**) produces:

```ts
type ExportPayload = {
  skill: "grill-me-html";
  round: number;
  title: string;
  answers: Record<string, {
    values: string[];
    labels: string[];
    customText?: string | null;
    note?: string | null;
  }>;
  skipped: string[];
  meta: {
    completedAt: string;      // ISO
    visibleQuestionIds: string[];
  };
};
```

Rules:

- Only currently visible questions with a choice or custom text go into `answers`
- Visible but unanswered questions go into `skipped`
- Hidden-by-condition questions also go into `skipped`
- `customText` is the free-form answer
- `note` is question-level context for the agent

## Shared understanding page

When the frontier is empty, generate a final offline decision document:

```bash
node "$SKILL_DIR/scripts/build-summary.mjs" \
  --config .grill-me-html/summary.json \
  --out .grill-me-html/shared-understanding.html
```

Injected as `window.SUMMARY_CONFIG` into `templates/shared-understanding.html`.

```ts
type SummaryConfig = {
  skill: "grill-me-html";
  title: string;              // e.g. "Shared understanding · Feature X"
  subtitle?: string;
  generatedAt?: string;       // ISO; default now
  status?: "draft" | "ready"; // default ready
  summary?: string;           // 1–3 paragraph shared understanding
  confirmPrompt?: string;     // what the user should confirm before implementation
  context?: {
    title?: string;
    summary?: string;
    visuals?: Array<{ title?: string; format?: "text" | "html" | "auto"; content: string }>;
    tree?: { title?: string; nodes: Array<{ id: string; label: string; status: string; detail?: string; parentId?: string }> };
  }; // optional final map on the summary page only
  decisions: SummaryDecision[];
  openQuestions?: string[];   // remaining unknowns (should be empty if ready)
  nextSteps?: string[];       // implementation order after confirm
};

type SummaryDecision = {
  id: string;
  label: string;
  decision: string;           // chosen outcome in plain language
  reason?: string;
  implications?: string[];    // downstream effects
  round?: number;
  status?: "settled" | "assumed" | "open";
};
```

Rules:

1. Write the summary from settled answers — do not invent undecided branches as final.
2. Include the final design tree / architecture visual in `context` when it helps confirmation.
3. Open the HTML for the user; wait for explicit confirm before implementing.
4. Offline only: same no-CDN / no-external-asset constraints.

## Soft branching guidance

Use `visibleWhen` when:

- the parent decision is already in this round
- the child is a same-layer strategy that only matters for some parent choices

Do not use page-local branching when:

- the child should wait for research after the parent answer
- the child is a deep downstream design that deserves its own round
- branches explode into many new decisions

## Injection

Template marker:

```js
window.QUESTIONNAIRE_CONFIG = /*__CONFIG__*/ null;
```

Replace with a real object:

```js
window.QUESTIONNAIRE_CONFIG = { /* valid JSON */ };
```

Constraints:

- Valid JSON only
- Escape `</` in strings as `\u003c/`
- Offline-only: no external scripts, fonts, or CDN assets
