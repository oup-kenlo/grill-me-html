#!/usr/bin/env node
/**
 * Serve shared-understanding.html and wait for Mark completed / Return.
 *
 * Usage:
 *   node serve-summary.mjs --session aim-in-one-job-queue
 *
 * Exit 0 when the user marks the session completed or returns it to in-progress.
 */

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";

import { findSession, moveSession } from "./session-store.mjs";

function usage(code = 0) {
  const text = `Usage:
  node serve-summary.mjs --session <slug> [--port <n>] [--no-open] [--timeout-ms <n>]
`;
  if (code === 0) process.stdout.write(text);
  else process.stderr.write(text);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { session: null, port: 0, open: true, timeoutMs: 0 };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") usage(0);
    else if (arg === "--session") args.session = argv[++i];
    else if (arg === "--port") args.port = Number(argv[++i] || 0);
    else if (arg === "--no-open") args.open = false;
    else if (arg === "--timeout-ms") args.timeoutMs = Number(argv[++i] || 0);
    else {
      process.stderr.write(`Unknown arg: ${arg}\n`);
      usage(1);
    }
  }
  if (!args.session) usage(1);
  return args;
}

function openBrowser(url) {
  const platform = process.platform;
  if (platform === "darwin") spawn("open", [url], { stdio: "ignore", detached: true }).unref();
  else if (platform === "win32")
    spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true }).unref();
  else spawn("xdg-open", [url], { stdio: "ignore", detached: true }).unref();
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(body);
}

function injectSession(html, payload) {
  const patch = `<script>window.GRILL_ME_HTML_SESSION = ${JSON.stringify(payload)};</script>`;
  const marker = "<body>";
  const index = html.indexOf(marker);
  if (index === -1) return `${patch}\n${html}`;
  return html.slice(0, index + marker.length) + patch + html.slice(index + marker.length);
}

async function main() {
  const args = parseArgs(process.argv);
  const found = findSession(args.session);
  if (!found) {
    process.stderr.write(`Session not found: ${args.session}\n`);
    process.exit(1);
  }
  const htmlPath = path.join(found.dir, "shared-understanding.html");
  if (!fs.existsSync(htmlPath)) {
    process.stderr.write(`Shared understanding not found: ${htmlPath}\n`);
    process.exit(1);
  }

  let pageHtml = fs.readFileSync(htmlPath, "utf8");
  let origin = "http://127.0.0.1";
  let finished = false;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", origin);
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      res.end();
      return;
    }
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(pageHtml);
      return;
    }
    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, { ok: true, finished });
      return;
    }
    if (req.method !== "POST" || finished) {
      sendJson(res, finished ? 409 : 404, { ok: false, error: finished ? "already_finished" : "not_found" });
      return;
    }

    const action =
      url.pathname === "/complete"
        ? "archived"
        : url.pathname === "/reopen"
          ? "in-progress"
          : null;
    if (!action) {
      sendJson(res, 404, { ok: false, error: "not_found" });
      return;
    }
    try {
      const moved = moveSession(args.session, action);
      finished = true;
      const next =
        moved.status === "archived"
          ? "ask_project_save_location"
          : "resume_interview";
      const result = {
        ok: true,
        session: args.session,
        status: moved.status,
        dir: moved.dir,
        html: path.join(moved.dir, "shared-understanding.html"),
        next,
      };
      sendJson(res, 200, {
        ok: true,
        status: moved.status,
        message:
          moved.status === "archived"
            ? "Marked completed. The agent will ask where to save a copy in this repo."
            : "Returned to in-progress.",
      });
      process.stdout.write(`RESULT ${JSON.stringify(result)}\n`);
      setTimeout(() => {
        server.close(() => process.exit(0));
      }, 150);
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        error: "move_failed",
        message: String(error && error.message ? error.message : error),
      });
    }
  });

  await new Promise((resolve) => {
    server.listen(args.port, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : args.port;
  origin = `http://127.0.0.1:${port}`;
  pageHtml = injectSession(fs.readFileSync(htmlPath, "utf8"), {
    slug: args.session,
    status: found.status,
    completeUrl: `${origin}/complete`,
    reopenUrl: `${origin}/reopen`,
  });

  process.stdout.write(`SERVING ${origin}/\n`);
  process.stdout.write(`SESSION ${args.session} ${found.status}\n`);
  process.stdout.write("Waiting for Mark completed or Return to in-progress…\n");
  if (args.open) openBrowser(`${origin}/`);
  if (args.timeoutMs > 0) {
    setTimeout(() => {
      process.stderr.write(`Timed out after ${args.timeoutMs}ms\n`);
      server.close(() => process.exit(2));
    }, args.timeoutMs);
  }
}

main().catch((error) => {
  process.stderr.write(`${error && error.stack ? error.stack : error}\n`);
  process.exit(1);
});
