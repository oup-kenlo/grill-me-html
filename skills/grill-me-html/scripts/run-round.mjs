#!/usr/bin/env node
/**
 * Single entrypoint for one grill-me-html round.
 *
 * Any coding agent (Pi, Claude Code, Cursor, Codex, …) should run this in the
 * FOREGROUND and treat exit 0 as "user submitted — continue immediately".
 *
 * Usage:
 *   node run-round.mjs --round 1 --config config-01.json
 *   node run-round.mjs --round 1 --config config-01.json --dir .grill-me-html
 *   node run-round.mjs --html already.html --out answers.json
 *
 * What it does:
 *   1. Optionally injects --config into the questionnaire template
 *   2. Writes round HTML under --dir
 *   3. Serves it and blocks until browser Submit
 *   4. Writes answers JSON under --dir
 *   5. Prints a machine-readable RESULT line and exits 0
 *
 * Exit codes:
 *   0  answers collected
 *   1  bad args / missing files
 *   2  timeout waiting for submit
 *   3  collector/runtime error
 */

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(__dirname, "..");
const DEFAULT_TEMPLATE = path.join(SKILL_ROOT, "templates", "questionnaire.html");
const COLLECTOR = path.join(__dirname, "serve-and-collect.mjs");

function usage(code = 0) {
  const text = `Usage:
  node run-round.mjs --round <n> --config <config.json> [--dir <workdir>] [--template <html>] [--port <n>] [--no-open] [--timeout-ms <n>]
  node run-round.mjs --html <file.html> --out <answers.json> [--port <n>] [--no-open] [--timeout-ms <n>]
`;
  if (code === 0) process.stdout.write(text);
  else process.stderr.write(text);
  process.exit(code);
}

function parseArgs(argv) {
  const args = {
    round: null,
    config: null,
    dir: null,
    template: DEFAULT_TEMPLATE,
    html: null,
    out: null,
    port: 0,
    open: true,
    timeoutMs: 0,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") usage(0);
    else if (a === "--round") args.round = Number(argv[++i]);
    else if (a === "--config") args.config = argv[++i];
    else if (a === "--dir") args.dir = argv[++i];
    else if (a === "--template") args.template = argv[++i];
    else if (a === "--html") args.html = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--port") args.port = Number(argv[++i] || 0);
    else if (a === "--no-open") args.open = false;
    else if (a === "--timeout-ms") args.timeoutMs = Number(argv[++i] || 0);
    else {
      process.stderr.write(`Unknown arg: ${a}\n`);
      usage(1);
    }
  }
  return args;
}

function padRound(n) {
  return String(n).padStart(2, "0");
}

function defaultWorkDir() {
  // Agent-agnostic local workspace. Prefer project tmp if present.
  const candidates = [
    path.resolve(process.cwd(), ".grill-me-html"),
    path.resolve(process.cwd(), ".pi/tmp/grill-me-html"),
    path.resolve(process.cwd(), ".tmp/grill-me-html"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.dirname(c)) || c.endsWith(".grill-me-html")) {
      return candidates[0];
    }
  }
  return candidates[0];
}

function injectConfig(templateHtml, configObj) {
  const json = JSON.stringify(configObj, null, 2).replace(/</g, "\\u003c");
  const marker = "window.QUESTIONNAIRE_CONFIG = /*__CONFIG__*/ null;";
  const replacement = `window.QUESTIONNAIRE_CONFIG = ${json};`;
  if (!templateHtml.includes(marker)) {
    throw new Error(
      "Template missing config marker: window.QUESTIONNAIRE_CONFIG = /*__CONFIG__*/ null;"
    );
  }
  return templateHtml.replace(marker, replacement);
}

function runCollector({ html, out, port, open, timeoutMs }) {
  return new Promise((resolve) => {
    const args = [COLLECTOR, "--html", html, "--out", out];
    if (port) args.push("--port", String(port));
    if (!open) args.push("--no-open");
    if (timeoutMs) args.push("--timeout-ms", String(timeoutMs));

    const child = spawn(process.execPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (buf) => {
      const s = buf.toString("utf8");
      stdout += s;
      process.stdout.write(s);
    });
    child.stderr.on("data", (buf) => {
      const s = buf.toString("utf8");
      stderr += s;
      process.stderr.write(s);
    });
    child.on("error", (err) => {
      process.stderr.write(String(err) + "\n");
      resolve({ code: 3, stdout, stderr });
    });
    child.on("close", (code) => {
      resolve({ code: code ?? 3, stdout, stderr });
    });
  });
}

async function main() {
  const args = parseArgs(process.argv);

  let htmlPath = args.html ? path.resolve(args.html) : null;
  let outPath = args.out ? path.resolve(args.out) : null;
  let round = Number.isFinite(args.round) ? args.round : null;

  if (!htmlPath) {
    if (!args.config || !round) usage(1);
    const workDir = path.resolve(args.dir || defaultWorkDir());
    fs.mkdirSync(workDir, { recursive: true });

    const configPath = path.resolve(args.config);
    if (!fs.existsSync(configPath)) {
      process.stderr.write(`Config not found: ${configPath}\n`);
      process.exit(1);
    }
    if (!fs.existsSync(args.template)) {
      process.stderr.write(`Template not found: ${args.template}\n`);
      process.exit(1);
    }

    const configObj = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (!configObj.round) configObj.round = round;
    if (!configObj.skill) configObj.skill = "grill-me-html";

    const templateHtml = fs.readFileSync(path.resolve(args.template), "utf8");
    const pageHtml = injectConfig(templateHtml, configObj);

    const tag = padRound(round);
    htmlPath = path.join(workDir, `round-${tag}.html`);
    outPath = path.join(workDir, `answers-${tag}.json`);
    fs.writeFileSync(htmlPath, pageHtml, "utf8");
    // Remove stale answers so agent cannot accidentally read previous round.
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);

    process.stdout.write(`ROUND ${round}\n`);
    process.stdout.write(`HTML ${htmlPath}\n`);
    process.stdout.write(`OUT ${outPath}\n`);
  } else {
    if (!outPath) usage(1);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    if (!fs.existsSync(htmlPath)) {
      process.stderr.write(`HTML not found: ${htmlPath}\n`);
      process.exit(1);
    }
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
    process.stdout.write(`HTML ${htmlPath}\n`);
    process.stdout.write(`OUT ${outPath}\n`);
  }

  process.stdout.write(
    "WAITING for browser Submit (blocking). Do not background this process.\n"
  );

  const result = await runCollector({
    html: htmlPath,
    out: outPath,
    port: args.port,
    open: args.open,
    timeoutMs: args.timeoutMs,
  });

  if (result.code === 0 && fs.existsSync(outPath)) {
    // Machine-readable trailer for any agent runtime.
    process.stdout.write(
      `RESULT ${JSON.stringify({
        ok: true,
        round,
        html: htmlPath,
        answers: outPath,
        next: "read_answers_and_continue",
      })}\n`
    );
    process.exit(0);
  }

  if (result.code === 2) {
    process.stderr.write("Timed out waiting for submit.\n");
    process.exit(2);
  }

  process.stderr.write(`Collector failed with code ${result.code}\n`);
  process.exit(result.code || 3);
}

main().catch((err) => {
  process.stderr.write(String(err && err.stack ? err.stack : err) + "\n");
  process.exit(3);
});
