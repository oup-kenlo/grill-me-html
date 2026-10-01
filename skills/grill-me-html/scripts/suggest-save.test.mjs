import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { suggestProjectPath } from "./suggest-save.mjs";

test("suggests docs/plans when that directory exists and strips the repo prefix", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "grill-repo-"));
  fs.mkdirSync(path.join(cwd, "docs", "plans"), { recursive: true });
  try {
    const suggestion = suggestProjectPath({
      cwd,
      slug: "aim-in-one-job-queue",
      now: new Date(2026, 9, 2),
    });
    const repoName = path.basename(cwd);
    assert.equal(
      suggestion.suggestedPath,
      `docs/plans/2026-10-02-${`aim-in-one-job-queue`.startsWith(`${repoName}-`) ? "job-queue" : "aim-in-one-job-queue"}.md`
    );
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("strips a matching repo folder prefix from the filename", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "grill-parent-"));
  const cwd = path.join(parent, "aim-in-one");
  fs.mkdirSync(path.join(cwd, "docs", "reference"), { recursive: true });
  try {
    const suggestion = suggestProjectPath({
      cwd,
      slug: "aim-in-one-job-queue",
      now: new Date(2026, 9, 2),
    });
    assert.equal(
      suggestion.suggestedPath,
      "docs/reference/2026-10-02-job-queue.md"
    );
    assert.match(suggestion.reason, /docs\/reference/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
