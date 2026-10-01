#!/usr/bin/env node
/**
 * Move a grill session between in-progress and archived.
 *
 * Usage:
 *   node move-session.mjs --session aim-in-one-job-queue --to archived
 *   node move-session.mjs --session aim-in-one-job-queue --to in-progress
 */

import path from "node:path";

import { moveSession } from "./session-store.mjs";

function usage(code = 0) {
  const text = `Usage:
  node move-session.mjs --session <slug> --to <in-progress|archived>
`;
  if (code === 0) process.stdout.write(text);
  else process.stderr.write(text);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { session: null, to: null };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") usage(0);
    else if (arg === "--session") args.session = argv[++i];
    else if (arg === "--to") args.to = argv[++i];
    else {
      process.stderr.write(`Unknown arg: ${arg}\n`);
      usage(1);
    }
  }
  if (!args.session || !args.to) usage(1);
  return args;
}

function main() {
  const args = parseArgs(process.argv);
  const moved = moveSession(args.session, args.to);
  const next =
    moved.status === "archived"
      ? "ask_project_save_location"
      : "resume_interview";
  process.stdout.write(
    `RESULT ${JSON.stringify({
      ok: true,
      session: args.session,
      status: moved.status,
      dir: moved.dir,
      html: path.join(moved.dir, "shared-understanding.html"),
      next,
    })}\n`
  );
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error && error.stack ? error.stack : error}\n`);
  process.exit(1);
}
