#!/usr/bin/env node
/**
 * Write a completed session's shared understanding into the current repo.
 *
 * Usage:
 *   node render-markdown.mjs --session aim-in-one-job-queue --out docs/plans/2026-10-02-job-queue.md
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { findSession } from "./session-store.mjs";

function usage(code = 0) {
  const text = `Usage:
  node render-markdown.mjs --session <slug> --out <project-relative.md>
`;
  if (code === 0) process.stdout.write(text);
  else process.stderr.write(text);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { session: null, out: null };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") usage(0);
    else if (arg === "--session") args.session = argv[++i];
    else if (arg === "--out") args.out = argv[++i];
    else {
      process.stderr.write(`Unknown arg: ${arg}\n`);
      usage(1);
    }
  }
  if (!args.session || !args.out) usage(1);
  return args;
}

export function projectOutPath(cwd, relativePath) {
  if (path.isAbsolute(relativePath)) {
    throw new Error("Output path must be relative to the current repo");
  }
  const resolved = path.resolve(cwd, relativePath);
  const relative = path.relative(cwd, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Output path must stay inside the current repo");
  }
  return resolved;
}

function bulletList(items) {
  if (!Array.isArray(items) || items.length === 0) return "_None._\n";
  return items.map((item) => `- ${item}`).join("\n") + "\n";
}

export function renderSummaryMarkdown(summary) {
  const lines = [`# ${summary.title || "Shared understanding"}`, ""];
  if (summary.subtitle) {
    lines.push(summary.subtitle, "");
  }
  if (summary.summary) {
    lines.push(summary.summary, "");
  }
  lines.push("## Decisions", "");
  const decisions = Array.isArray(summary.decisions) ? summary.decisions : [];
  if (decisions.length === 0) lines.push("_None._", "");
  for (const decision of decisions) {
    lines.push(`### ${decision.label || decision.id}`, "");
    lines.push(decision.decision || "—", "");
    if (decision.reason) lines.push(decision.reason, "");
    if (Array.isArray(decision.implications) && decision.implications.length) {
      lines.push(bulletList(decision.implications));
    }
  }
  lines.push("## Open questions", "");
  lines.push(bulletList(summary.openQuestions));
  lines.push("## Next steps", "");
  lines.push(bulletList(summary.nextSteps));
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n")}\n`;
}

function main() {
  const args = parseArgs(process.argv);
  const found = findSession(args.session);
  if (!found) {
    process.stderr.write(`Session not found: ${args.session}\n`);
    process.exit(1);
  }
  const summaryPath = path.join(found.dir, "summary.json");
  if (!fs.existsSync(summaryPath)) {
    process.stderr.write(`summary.json not found in ${found.dir}\n`);
    process.exit(1);
  }
  const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
  const outPath = projectOutPath(process.cwd(), args.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, renderSummaryMarkdown(summary), "utf8");
  process.stdout.write(`WROTE ${outPath}\n`);
  process.stdout.write(
    `RESULT ${JSON.stringify({
      ok: true,
      out: outPath,
      session: args.session,
      next: "project_copy_written",
    })}\n`
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error && error.stack ? error.stack : error}\n`);
    process.exit(1);
  }
}
