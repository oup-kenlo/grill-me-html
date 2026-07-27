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
  type: "single" | "multi";
  required?: boolean;         // default true; hidden questions are not required
  recommended?: {
    value?: string;           // single recommendation
    values?: string[];        // multi recommendation set
    reason?: string;
  };
  options: Option[];
  visibleWhen?: Condition;    // hide whole question until condition holds
};
```

## Option

```ts
type Option = {
  value: string;
  label: string;
  description?: string;
  visibleWhen?: Condition;    // hide this option until condition holds
};
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
