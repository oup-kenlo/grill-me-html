import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  ensureSession,
  findSession,
  listSessions,
  moveSession,
  rootDir,
} from "./session-store.mjs";

function withHome(fn) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "grill-me-html-"));
  const previous = process.env.GRILL_ME_HTML_HOME;
  process.env.GRILL_ME_HTML_HOME = home;
  try {
    return fn(home);
  } finally {
    if (previous === undefined) delete process.env.GRILL_ME_HTML_HOME;
    else process.env.GRILL_ME_HTML_HOME = previous;
    fs.rmSync(home, { recursive: true, force: true });
  }
}

test("sessions stay under in-progress until marked completed", () => {
  withHome(() => {
    const created = ensureSession("aim-in-one-job-queue", {
      title: "Job queue",
      repo: "/work/aim-in-one",
    });
    assert.equal(created.status, "in-progress");
    assert.equal(
      created.dir,
      path.join(rootDir(), "in-progress", "aim-in-one-job-queue")
    );
    fs.writeFileSync(path.join(created.dir, "answers-01.json"), "{}\n");

    const archived = moveSession("aim-in-one-job-queue", "archived");
    assert.equal(archived.status, "archived");
    assert.equal(fs.existsSync(path.join(archived.dir, "answers-01.json")), true);
    assert.equal(findSession("aim-in-one-job-queue").status, "archived");

    const reopened = moveSession("aim-in-one-job-queue", "in-progress");
    assert.equal(reopened.status, "in-progress");
    const listed = listSessions();
    assert.equal(listed.inProgress.length, 1);
    assert.equal(listed.archived.length, 0);
    assert.equal(listed.inProgress[0].slug, "aim-in-one-job-queue");
  });
});

test("rejects path-like session names", () => {
  withHome(() => {
    assert.throws(() => ensureSession("../secrets"), /lowercase/);
    assert.throws(() => ensureSession("Aim-In-One"), /lowercase/);
  });
});

test("archived sessions are not reused for a new round", () => {
  withHome(() => {
    ensureSession("aim-in-one-job-queue", { title: "Job queue" });
    moveSession("aim-in-one-job-queue", "archived");
    assert.throws(
      () => ensureSession("aim-in-one-job-queue"),
      (error) => error.code === "archived"
    );
  });
});
