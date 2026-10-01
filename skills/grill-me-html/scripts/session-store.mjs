import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STATUSES = ["in-progress", "archived"];

export function rootDir() {
  if (process.env.GRILL_ME_HTML_HOME) {
    return path.resolve(process.env.GRILL_ME_HTML_HOME);
  }
  return path.join(os.homedir(), ".grill-me-html");
}

export function assertSlug(slug) {
  if (typeof slug !== "string" || !SLUG_PATTERN.test(slug) || slug.length > 80) {
    throw new Error(
      `Session folder name must be 1-80 chars of lowercase letters, digits, and hyphens: ${slug}`
    );
  }
  return slug;
}

export function assertStatus(status) {
  if (!STATUSES.includes(status)) {
    throw new Error(`Status must be in-progress or archived: ${status}`);
  }
  return status;
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function sessionDir(status, slug) {
  return path.join(rootDir(), assertStatus(status), assertSlug(slug));
}

export function findSession(slug) {
  assertSlug(slug);
  for (const status of STATUSES) {
    const dir = sessionDir(status, slug);
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      return { status, dir };
    }
  }
  return null;
}

export function ensureSession(slug, fields = {}) {
  assertSlug(slug);
  const existing = findSession(slug);
  if (existing && existing.status === "archived") {
    const error = new Error(`Session is archived: ${slug}`);
    error.code = "archived";
    throw error;
  }
  const dir = existing ? existing.dir : sessionDir("in-progress", slug);
  fs.mkdirSync(dir, { recursive: true });
  const metaPath = path.join(dir, "session.json");
  const previous = readJson(metaPath) || {};
  const meta = {
    slug,
    title: fields.title || previous.title || slug,
    repo: fields.repo || previous.repo || "",
    createdAt: previous.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "in-progress",
  };
  writeJson(metaPath, meta);
  return { status: "in-progress", dir, meta };
}

export function moveSession(slug, toStatus) {
  assertSlug(slug);
  assertStatus(toStatus);
  const found = findSession(slug);
  if (!found) {
    throw new Error(`Session not found: ${slug}`);
  }
  if (found.status === toStatus) return found;
  const dest = sessionDir(toStatus, slug);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.renameSync(found.dir, dest);
  const metaPath = path.join(dest, "session.json");
  const meta = readJson(metaPath) || { slug };
  meta.slug = slug;
  meta.status = toStatus;
  meta.updatedAt = new Date().toISOString();
  writeJson(metaPath, meta);
  return { status: toStatus, dir: dest, meta };
}

export function listSessions() {
  const grouped = { inProgress: [], archived: [] };
  for (const status of STATUSES) {
    const base = path.join(rootDir(), status);
    if (!fs.existsSync(base)) continue;
    const key = status === "in-progress" ? "inProgress" : "archived";
    for (const name of fs.readdirSync(base)) {
      const dir = path.join(base, name);
      if (!fs.statSync(dir).isDirectory()) continue;
      if (!SLUG_PATTERN.test(name)) continue;
      const meta = readJson(path.join(dir, "session.json")) || {};
      grouped[key].push({
        slug: name,
        title: meta.title || name,
        repo: meta.repo || "",
        updatedAt: meta.updatedAt || null,
        hasSharedUnderstanding: fs.existsSync(
          path.join(dir, "shared-understanding.html")
        ),
      });
    }
    grouped[key].sort((a, b) =>
      String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))
    );
  }
  return grouped;
}

export function padRound(round) {
  return String(round).padStart(2, "0");
}
