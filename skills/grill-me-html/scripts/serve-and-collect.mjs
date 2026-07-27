#!/usr/bin/env node
/**
 * Serve one grill-me-html round and collect the submitted answers.
 *
 * Usage:
 *   node serve-and-collect.mjs --html round-01.html --out answers-01.json
 *   node serve-and-collect.mjs --html round-01.html --out answers-01.json --port 8765 --no-open
 *
 * Behavior:
 *   1. Serve the HTML at http://127.0.0.1:<port>/
 *   2. Inject handoff.submitUrl into the page so Submit posts here
 *   3. Accept POST /submit with JSON body
 *   4. Write answers to --out
 *   5. Exit 0
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function usage(code = 0) {
  const text = `Usage:
  node serve-and-collect.mjs --html <file.html> --out <answers.json> [--port <n>] [--no-open] [--timeout-ms <n>]
`;
  if (code === 0) process.stdout.write(text);
  else process.stderr.write(text);
  process.exit(code);
}

function parseArgs(argv) {
  const args = {
    html: null,
    out: null,
    port: 0,
    open: true,
    timeoutMs: 0,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") usage(0);
    if (a === "--html") args.html = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--port") args.port = Number(argv[++i] || 0);
    else if (a === "--no-open") args.open = false;
    else if (a === "--timeout-ms") args.timeoutMs = Number(argv[++i] || 0);
    else {
      process.stderr.write(`Unknown arg: ${a}\n`);
      usage(1);
    }
  }
  if (!args.html || !args.out) usage(1);
  return args;
}

function openBrowser(url) {
  const platform = process.platform;
  if (platform === "darwin") spawn("open", [url], { stdio: "ignore", detached: true }).unref();
  else if (platform === "win32")
    spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true }).unref();
  else spawn("xdg-open", [url], { stdio: "ignore", detached: true }).unref();
}

function injectHandoff(html, submitUrl, answersHint) {
  // Separate global so the page can read handoff even if config was cloned at boot.
  const patch = `
<script>
window.GRILL_ME_HTML_HANDOFF = {
  mode: "server",
  submitUrl: ${JSON.stringify(submitUrl)},
  answersHint: ${JSON.stringify(answersHint)}
};
if (window.QUESTIONNAIRE_CONFIG && typeof window.QUESTIONNAIRE_CONFIG === "object") {
  window.QUESTIONNAIRE_CONFIG.handoff = window.GRILL_ME_HTML_HANDOFF;
}
</script>`;

  if (html.includes("</body>")) {
    return html.replace("</body>", `${patch}\n</body>`);
  }
  return html + patch;
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

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const htmlPath = path.resolve(args.html);
  const outPath = path.resolve(args.out);

  if (!fs.existsSync(htmlPath)) {
    process.stderr.write(`HTML not found: ${htmlPath}\n`);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const rawHtml = fs.readFileSync(htmlPath, "utf8");
  let pageHtml = rawHtml;
  let submitted = false;
  let origin = "http://127.0.0.1";

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
      sendJson(res, 200, { ok: true, submitted });
      return;
    }

    if (req.method === "POST" && url.pathname === "/submit") {
      if (submitted) {
        sendJson(res, 409, { ok: false, error: "already_submitted" });
        return;
      }
      try {
        const text = await readBody(req);
        const payload = JSON.parse(text || "{}");
        fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
        submitted = true;
        process.stdout.write(`SUBMITTED ${outPath}\n`);
        sendJson(res, 200, {
          ok: true,
          out: outPath,
          message: "Answers received. You can close this tab.",
        });
        setTimeout(() => {
          server.close(() => process.exit(0));
        }, 150);
      } catch (err) {
        sendJson(res, 400, {
          ok: false,
          error: "invalid_json",
          message: String(err && err.message ? err.message : err),
        });
      }
      return;
    }

    sendJson(res, 404, { ok: false, error: "not_found" });
  });

  await new Promise((resolve) => {
    server.listen(args.port, "127.0.0.1", resolve);
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : args.port;
  origin = `http://127.0.0.1:${port}`;
  const submitUrl = `${origin}/submit`;
  pageHtml = injectHandoff(rawHtml, submitUrl, outPath);

  process.stdout.write(`SERVING ${origin}/\n`);
  process.stdout.write(`HTML ${htmlPath}\n`);
  process.stdout.write(`OUT ${outPath}\n`);
  process.stdout.write(`SUBMIT ${submitUrl}\n`);
  process.stdout.write(`Waiting for browser submit…\n`);

  if (args.open) openBrowser(`${origin}/`);

  if (args.timeoutMs > 0) {
    setTimeout(() => {
      process.stderr.write(`Timed out after ${args.timeoutMs}ms waiting for submit\n`);
      server.close(() => process.exit(2));
    }, args.timeoutMs);
  }
}

main().catch((err) => {
  process.stderr.write(String(err && err.stack ? err.stack : err) + "\n");
  process.exit(1);
});
