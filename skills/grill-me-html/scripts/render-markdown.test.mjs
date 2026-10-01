import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { projectOutPath, renderSummaryMarkdown } from "./render-markdown.mjs";

test("renders decisions into markdown", () => {
  const markdown = renderSummaryMarkdown({
    title: "Shared understanding · Job queue",
    summary: "One queue, one worker.",
    decisions: [
      {
        id: "depth",
        label: "Queue depth",
        decision: "Single queue",
        reason: "Enough for v1.",
      },
    ],
    openQuestions: [],
    nextSteps: ["Add the worker"],
  });
  assert.match(markdown, /# Shared understanding · Job queue/);
  assert.match(markdown, /### Queue depth/);
  assert.match(markdown, /Single queue/);
  assert.match(markdown, /- Add the worker/);
});

test("refuses to write outside the repo", () => {
  const cwd = "/work/aim-in-one";
  assert.throws(
    () => projectOutPath(cwd, "../secrets.md"),
    /inside the current repo/
  );
  assert.equal(
    projectOutPath(cwd, "docs/plans/2026-10-02-job-queue.md"),
    path.resolve(cwd, "docs/plans/2026-10-02-job-queue.md")
  );
});
