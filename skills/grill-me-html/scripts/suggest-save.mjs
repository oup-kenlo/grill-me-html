#!/usr/bin/env node
/**
 * Suggest a project-relative markdown path for a completed grill session.
 *
 * Usage:
 *   node suggest-save.mjs --session aim-in-one-job-queue
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { assertSlug, findSession } from "./session-store.mjs";

function usage(code = 0) {
  const text = `Usage:
  node suggest-save.mjs --session <slug> [--cwd <dir>]
`;
  if (code === 0) process.stdout.write(text);
  else process.stderr.write(text);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { session: null, cwd: process.cwd() };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") usage(0);
    else if (arg === "--session") args.session = argv[++i];
    else if (arg === "--cwd") args.cwd = argv[++i];
    else {
      process.stderr.write(`Unknown arg: ${arg}\n`);
      usage(1);
    }
  }
  if (!args.session) usage(1);
  return args;
}

function localDateStamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function suggestProjectPath({ cwd, slug, now = new Date() }) {
  assertSlug(slug);
  const repoName = path.basename(path.resolve(cwd));
  const prefix = `${repoName}-`;
  const topic = slug.startsWith(prefix) ? slug.slice(prefix.length) : slug;
  const fileName = `${localDateStamp(now)}-${topic}.md`;
  const candidates = ["docs/plans", "docs/plan", "docs/reference"];
  const existing = candidates.find((relative) =>
    fs.existsSync(path.join(cwd, relative))
  );
  const directory = existing || "docs/plans";
  return {
    session: slug,
    suggestedPath: `${directory}/${fileName}`,
    directory,
    fileName,
    reason: existing
      ? `${existing} already exists in this repo`
      : "no docs/plans, docs/plan, or docs/reference directory yet; docs/plans is the default",
  };
}

function main() {
  const args = parseArgs(process.argv);
  const slug = assertSlug(args.session);
  const found = findSession(slug);
  if (!found) {
    process.stderr.write(`Session not found: ${slug}\n`);
    process.exit(1);
  }
  const suggestion = suggestProjectPath({
    cwd: path.resolve(args.cwd),
    slug,
  });
  suggestion.status = found.status;
  suggestion.sharedUnderstanding = path.join(
    found.dir,
    "shared-understanding.html"
  );
  process.stdout.write(`${JSON.stringify(suggestion, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error && error.stack ? error.stack : error}\n`);
    process.exit(1);
  }
}
