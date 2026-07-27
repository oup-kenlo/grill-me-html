# grill-me-html

Adaptive HTML questionnaires for design interviews.

An agent skill that turns plan/design decisions into browser questionnaires:

- Design tree, asked by **frontier** rounds
- Soft branching inside a round (`visibleWhen`)
- Recommended answers on every question
- **Submit round** writes answers locally — no paste by default
- Agent continues after submit via a foreground waiter

## Screenshots

### Question round

![Question round UI](docs/media/round-question.png)

### Selected state

![Selected option](docs/media/option-selected.png)

### Review + submit

![Review page](docs/media/review.png)

## Install

```bash
npx skills add wuyuxiangX/grill-me-html -y
```

Global:

```bash
npx skills add wuyuxiangX/grill-me-html -g -y
```

## Requirements

- Node.js 18+
- A coding agent that can run a long foreground shell command
- Local browser access

## Usage

1. Describe a plan or design.
2. The agent writes `.grill-me-html/config-01.json`.
3. The agent runs (foreground, long timeout):

```bash
node "$SKILL_DIR/scripts/run-round.mjs" \
  --round 1 \
  --config .grill-me-html/config-01.json
```

4. Answer in the browser and click **Submit round**.
5. The process exits `0` and prints `RESULT {...}`.
6. The agent reads `.grill-me-html/answers-01.json` and starts the next round, or finishes with a shared-understanding summary.

Details:

- Auto-continue contract: [`skills/grill-me-html/references/auto-continue.md`](./skills/grill-me-html/references/auto-continue.md)
- Config schema: [`skills/grill-me-html/references/config-schema.md`](./skills/grill-me-html/references/config-schema.md)

## Config example

```json
{
  "skill": "grill-me-html",
  "round": 1,
  "title": "Feature X · Round 1",
  "subtitle": "Upstream product boundaries",
  "questions": [
    {
      "id": "audience",
      "label": "Audience",
      "prompt": "Who is the first user?",
      "type": "single",
      "recommended": {
        "value": "power-users",
        "reason": "Sharper feedback loop for v1."
      },
      "options": [
        { "value": "power-users", "label": "Power users" },
        { "value": "everyone", "label": "Everyone" }
      ]
    }
  ]
}
```

## Layout

```text
grill-me-html/
├── README.md
├── LICENSE
├── docs/media/
└── skills/grill-me-html/
    ├── SKILL.md
    ├── scripts/
    │   ├── run-round.mjs
    │   └── serve-and-collect.mjs
    ├── templates/
    │   └── questionnaire.html
    └── references/
        ├── auto-continue.md
        └── config-schema.md
```

## License

MIT
