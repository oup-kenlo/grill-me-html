#!/usr/bin/env node
/**
 * Browse ~/.grill-me-html and move sessions between in-progress and archived.
 *
 * Stays open so several toggles can happen. Ctrl+C stops it.
 *
 * Usage:
 *   node serve-index.mjs
 */

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { listSessions, moveSession } from "./session-store.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.join(__dirname, "..", "templates", "sessions.html");

function parseArgs(argv) {
  const args = { port: 0, open: true };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--port") args.port = Number(argv[++i] || 0);
    else if (arg === "--no-open") args.open = false;
    else {
      process.stderr.write(`Unknown arg: ${arg}\n`);
      process.exit(1);
    }
  }
  return args;
}

function openBrowser(url) {
  if (process.platform === "darwin") {
    spawn("open", [url], { stdio: "ignore", detached: true }).unref();
  }
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

async function main() {
  const args = parseArgs(process.argv);
  const page = fs.readFileSync(TEMPLATE, "utf8");
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      res.end(page);
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/sessions") {
      sendJson(res, 200, listSessions());
      return;
    }
    const match = url.pathname.match(/^\/api\/sessions\/([^/]+)\/(complete|reopen)$/);
    if (req.method === "POST" && match) {
      const slug = decodeURIComponent(match[1]);
      const to = match[2] === "complete" ? "archived" : "in-progress";
      try {
        const moved = moveSession(slug, to);
        process.stdout.write(
          `MOVED ${JSON.stringify({ slug, status: moved.status, dir: moved.dir })}\n`
        );
        sendJson(res, 200, { ok: true, status: moved.status });
      } catch (error) {
        sendJson(res, 400, {
          ok: false,
          message: String(error && error.message ? error.message : error),
        });
      }
      return;
    }
    sendJson(res, 404, { ok: false, error: "not_found" });
  });

  await new Promise((resolve) => server.listen(args.port, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : args.port;
  const origin = `http://127.0.0.1:${port}/`;
  process.stdout.write(`SERVING ${origin}\n`);
  process.stdout.write("Index stays open. Stop this process when you are done browsing.\n");
  if (args.open) openBrowser(origin);
}

main().catch((error) => {
  process.stderr.write(`${error && error.stack ? error.stack : error}\n`);
  process.exit(1);
});
