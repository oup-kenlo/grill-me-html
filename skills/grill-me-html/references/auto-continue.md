# Auto-continue contract (agent-agnostic)

This skill must work in **any** coding agent that can:

1. write files
2. run a long-lived foreground shell command
3. read the command output / exit code
4. continue the same turn after the command exits

It does **not** depend on Pi-specific hooks, Claude-only hooks, or a cloud webhook.

## The hard limit

A browser page cannot wake an idle agent by itself.

So “Submit → automatically do the next step” is **not** a browser feature.
It is a **wait contract**:

```text
agent starts waiter (foreground, blocking)
user answers in browser and clicks Submit
waiter writes answers.json and exits 0
agent resumes because the tool call finished
agent reads answers.json and opens the next round
```

If the waiter is backgrounded, Submit only writes a file. Nothing resumes the agent.

## Canonical command

Resolve `SKILL_DIR` as the directory containing this skill’s `SKILL.md`.

```bash
node "$SKILL_DIR/scripts/run-round.mjs" \
  --round 1 \
  --config .grill-me-html/config-01.json
```

What happens:

1. inject config into `templates/questionnaire.html`
2. write `.grill-me-html/round-01.html`
3. block on local collector
4. write `.grill-me-html/answers-01.json`
5. print `RESULT {...}`
6. exit 0

Lower-level equivalent:

```bash
node "$SKILL_DIR/scripts/serve-and-collect.mjs" \
  --html .grill-me-html/round-01.html \
  --out  .grill-me-html/answers-01.json
```

## Rules for every agent runtime

### Required

- Run `run-round.mjs` / `serve-and-collect.mjs` in the **foreground**
- Use a **long timeout** (tens of minutes is fine; users think between questions)
- On exit code `0`, immediately:
  1. read the answers file from `RESULT` / `--out`
  2. update the design tree
  3. generate the next round or finish
- Do **not** ask “are you done?” after exit 0

### Forbidden

- `command &`, detached spawn, “start server then poll in chat later”
- assuming a platform event bus will notify the agent
- requiring the user to paste JSON when the waiter is available

### Fallback only

If the waiter cannot run (no node, sandbox blocks localhost, etc.):

1. open the HTML file
2. user clicks **Copy JSON**
3. user pastes into chat
4. continue

## Why not other approaches?

| Approach | Verdict |
|---|---|
| Foreground blocking waiter | **Best default.** Portable across agents. |
| Background server + agent polls file | Works only if the agent keeps a live turn and polls; easy to get wrong; wasteful. |
| Browser webhook to cloud agent | Needs hosted infra + auth; not a local skill. |
| Playwright drives the form for the user | Automates the wrong actor; user must decide. |
| Terminal forms (`ask_user`, etc.) | Different product surface; not HTML questionnaire. |
| Session handoff docs | For agent-to-agent transfer, not browser submit. |

## Machine-readable success

`run-round.mjs` ends with:

```text
RESULT {"ok":true,"round":1,"html":".../round-01.html","answers":".../answers-01.json","next":"read_answers_and_continue"}
```

Agents may parse this line, or simply use the known `--out` path.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | answers collected; continue |
| 1 | bad args / missing files |
| 2 | timeout waiting for submit |
| 3 | runtime/collector error |

## Workdir convention

Default workdir is project-local and agent-agnostic:

```text
.grill-me-html/
  config-01.json
  round-01.html
  answers-01.json
  config-02.json
  round-02.html
  answers-02.json
```

Do not require a platform-private path.
