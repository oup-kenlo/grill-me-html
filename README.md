# grill-me-html

**Grill your design decisions in the browser — round by round.**

`grill-me-html` is an Agent Skill that turns plan/design interviews into adaptive HTML questionnaires.

- Design tree + **frontier** rounds (only ask what is unblocked now)
- Soft branching inside a round (`visibleWhen`)
- Recommended answers on every question
- One-click **Submit round** (no paste by default)
- Portable **auto-continue**: agent blocks on a local waiter, then continues when Submit exits 0

Inspired by the “grill me / batch grill” idea of relentless design interviews — implemented as a real questionnaire surface instead of a terminal wall of questions.

## Screenshots

### Question round

![Question round UI](docs/media/round-question.png)

Frontier sidebar, recommended options, single/multi select, notes for the agent.

### Selected state

![Selected option](docs/media/option-selected.png)

Clear selected feedback before auto-advancing or reviewing.

### Review + submit

![Review page](docs/media/review.png)

Check answers, then **Submit round** (local waiter) or fall back to **Copy JSON**.

## Install

With the [`skills`](https://www.npmjs.com/package/skills) CLI:

```bash
# project-level (recommended)
npx skills add wuyuxiangX/grill-me-html --skill grill-me-html -y

# global
npx skills add wuyuxiangX/grill-me-html --skill grill-me-html -g -y

# from a local checkout
npx skills add ./grill-me-html --skill grill-me-html -y
```

## Requirements

- Node.js 18+ (for the local waiter scripts)
- A coding agent that can run a long foreground shell command (Pi, Claude Code, Cursor, Codex, …)
- Browser on localhost (default handoff)

## Quick start (for agents)

1. User describes a plan / feature / design.
2. Agent builds a design tree and authors `.grill-me-html/config-01.json`.
3. Agent runs (foreground, long timeout):

```bash
node "$SKILL_DIR/scripts/run-round.mjs" \
  --round 1 \
  --config .grill-me-html/config-01.json
```

4. User answers in the browser and clicks **Submit round**.
5. Process exits 0 and prints `RESULT {...}`.
6. Agent reads `.grill-me-html/answers-01.json`, updates the tree, opens round 2 — or finishes with a shared-understanding summary.

Full contract: [`skills/grill-me-html/references/auto-continue.md`](./skills/grill-me-html/references/auto-continue.md)

## Repo layout

```text
grill-me-html/
├── README.md
├── LICENSE
├── .gitignore
├── docs/media/                 # README screenshots
└── skills/
    └── grill-me-html/
        ├── SKILL.md
        ├── scripts/
        │   ├── run-round.mjs          # primary entry
        │   └── serve-and-collect.mjs  # localhost waiter
        ├── templates/
        │   └── questionnaire.html
        └── references/
            ├── auto-continue.md
            └── config-schema.md
```

This layout matches the common Agent Skills install shape:

```bash
npx skills add <owner>/<repo> --skill grill-me-html
```

## Manual smoke test

```bash
mkdir -p /tmp/grill-demo/.grill-me-html
cat > /tmp/grill-demo/.grill-me-html/config-01.json <<'EOF'
{
  "skill": "grill-me-html",
  "round": 1,
  "title": "Smoke · Round 1",
  "questions": [
    {
      "id": "ship",
      "label": "Ship",
      "prompt": "Ship this skill as a standalone repo?",
      "type": "single",
      "recommended": { "value": "yes", "reason": "It is already portable." },
      "options": [
        { "value": "yes", "label": "Yes" },
        { "value": "no", "label": "Not yet" }
      ]
    }
  ]
}
EOF

cd /tmp/grill-demo
node /path/to/grill-me-html/skills/grill-me-html/scripts/run-round.mjs \
  --round 1 \
  --config .grill-me-html/config-01.json
```

Answer in the browser → Submit → check `.grill-me-html/answers-01.json`.

## What this is / isn’t

| Is | Isn’t |
|---|---|
| A design-interview skill with HTML UX | A hosted survey SaaS |
| Local-first, agent-driven | A cloud form backend |
| Portable across coding agents | Pi-only / Claude-only |
| Submit → continue via blocking waiter | Magic remote wake of idle agents |

## Config sketch

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

See [`skills/grill-me-html/references/config-schema.md`](./skills/grill-me-html/references/config-schema.md).

## License

MIT

## Credits

- Interview rhythm inspired by public “grill me / batch grill” agent-skill patterns
- Built as a standalone skill so any agent can install it without a blog monorepo
