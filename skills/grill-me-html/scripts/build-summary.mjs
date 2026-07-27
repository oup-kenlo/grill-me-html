#!/usr/bin/env node
/**
 * Build the final shared-understanding HTML page.
 *
 * Usage:
 *   node build-summary.mjs --config summary.json
 *   node build-summary.mjs --config summary.json --out .grill-me-html/shared-understanding.html
 *   node build-summary.mjs --config summary.json --open
 *
 * Exit codes:
 *   0  wrote HTML
 *   1  bad args / missing files
 *   3  runtime error
 */

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(__dirname, "..");
const DEFAULT_TEMPLATE = path.join(
  SKILL_ROOT,
  "templates",
  "shared-understanding.html"
);

function usage(code = 0) {
  const text = `Usage:
  node build-summary.mjs --config <summary.json> [--out <file.html>] [--template <html>] [--open]
`;
  if (code === 0) process.stdout.write(text);
  else process.stderr.write(text);
  process.exit(code);
}

function parseArgs(argv) {
  const args = {
    config: null,
    out: null,
    template: DEFAULT_TEMPLATE,
    open: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") usage(0);
    else if (a === "--config") args.config = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--template") args.template = argv[++i];
    else if (a === "--open") args.open = true;
    else {
      process.stderr.write(`Unknown arg: ${a}\n`);
      usage(1);
    }
  }
  return args;
}

function defaultOutPath() {
  return path.resolve(process.cwd(), ".grill-me-html", "shared-understanding.html");
}

function injectConfig(templateHtml, configObj) {
  const json = JSON.stringify(configObj, null, 2).replace(/</g, "\\u003c");
  const marker = "window.SUMMARY_CONFIG = /*__SUMMARY_CONFIG__*/ null;";
  const replacement = `window.SUMMARY_CONFIG = ${json};`;
  if (!templateHtml.includes(marker)) {
    throw new Error(
      "Template missing config marker: window.SUMMARY_CONFIG = /*__SUMMARY_CONFIG__*/ null;"
    );
  }
  return templateHtml.replace(marker, replacement);
}

function openFile(filePath) {
  const platform = process.platform;
  let cmd;
  let args;
  if (platform === "darwin") {
    cmd = "open";
    args = [filePath];
  } else if (platform === "win32") {
    cmd = "cmd";
    args = ["/c", "start", "", filePath];
  } else {
    cmd = "xdg-open";
    args = [filePath];
  }
  const child = spawn(cmd, args, { stdio: "ignore", detached: true });
  child.unref();
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.config) usage(1);

  const configPath = path.resolve(args.config);
  const templatePath = path.resolve(args.template);
  const outPath = path.resolve(args.out || defaultOutPath());

  if (!fs.existsSync(configPath)) {
    process.stderr.write(`Config not found: ${configPath}\n`);
    process.exit(1);
  }
  if (!fs.existsSync(templatePath)) {
    process.stderr.write(`Template not found: ${templatePath}\n`);
    process.exit(1);
  }

  const configObj = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (!configObj.skill) configObj.skill = "grill-me-html";
  if (!configObj.generatedAt) configObj.generatedAt = new Date().toISOString();
  if (!configObj.status) configObj.status = "ready";
  if (!Array.isArray(configObj.decisions)) configObj.decisions = [];

  const templateHtml = fs.readFileSync(templatePath, "utf8");
  const pageHtml = injectConfig(templateHtml, configObj);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, pageHtml, "utf8");

  process.stdout.write(`SUMMARY ${outPath}\n`);
  process.stdout.write(
    `RESULT ${JSON.stringify({
      ok: true,
      html: outPath,
      next: "open_shared_understanding_and_wait_for_confirm",
    })}\n`
  );

  if (args.open) openFile(outPath);
  process.exit(0);
}

try {
  main();
} catch (err) {
  process.stderr.write(String(err && err.stack ? err.stack : err) + "\n");
  process.exit(3);
}
