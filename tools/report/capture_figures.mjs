// Screenshots of the running app for the project report (BUILD_MAP T11.2).
//
//   node tools/report/capture_figures.mjs <output folder> [path of Edge or Chrome]
//
// The backend (port 8000) and the frontend (port 5173) must be running. A Chromium browser that
// is already on the machine is started without a window and driven over the DevTools protocol,
// so the 3D heart is drawn by a real WebGL context. Needs Node 22 (global WebSocket and fetch)
// and installs nothing. tools/report/build_report.py --captures <output folder> then builds the
// report's figures from these files.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const APP_URL = "http://localhost:5173/";
const PORT = 9338;
const BROWSERS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

const out = process.argv[2];
const browser = process.argv[3] ?? BROWSERS.find((path) => existsSync(path));
if (!out || !browser) {
  console.error("usage: node tools/report/capture_figures.mjs <output folder> [path of Edge or Chrome]");
  process.exit(1);
}
mkdirSync(out, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), "cardiolens-capture-"));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const child = spawn(
  browser,
  ["--headless=new", `--remote-debugging-port=${PORT}`, "--window-size=1366,768", "--hide-scrollbars", `--user-data-dir=${profile}`, "about:blank"],
  { stdio: "ignore" },
);

let targets;
for (let attempt = 0; attempt < 50 && !targets; attempt += 1) {
  try {
    targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  } catch {
    await sleep(200);
  }
}
if (!targets) {
  console.error("the browser did not start");
  child.kill();
  process.exit(1);
}

const socket = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
let lastId = 0;
const waiting = new Map();
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && waiting.has(message.id)) {
    waiting.get(message.id)(message);
    waiting.delete(message.id);
  }
};
await new Promise((resolve) => {
  socket.onopen = resolve;
});
const send = (method, params = {}) =>
  new Promise((resolve) => {
    lastId += 1;
    waiting.set(lastId, resolve);
    socket.send(JSON.stringify({ id: lastId, method, params }));
  });
const evaluate = async (expression) =>
  (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;

let failed = false;
const until = async (expression, label, tries = 60) => {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    if (await evaluate(expression)) return;
    await sleep(250);
  }
  console.error("timed out waiting for:", label);
  failed = true;
};
const save = (name, result) => {
  writeFileSync(join(out, name), Buffer.from(result.result.data, "base64"));
  console.log("wrote", name);
};
const shoot = async (name) => save(name, await send("Page.captureScreenshot", { format: "png" }));
/** Screenshot of one element (a JS expression), down to the bottom of `bottomOf` if given, wherever it is on the page. */
const shootElement = async (name, expression, bottomOf = null, margin = 6) => {
  const end = bottomOf ? `(${bottomOf}).getBoundingClientRect().bottom` : "r.bottom";
  const box = await evaluate(
    `(() => { const r = (${expression}).getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: ${end} - r.top }; })()`,
  );
  const clip = { x: box.x - margin, y: box.y - margin, width: box.width + 2 * margin, height: box.height + 2 * margin, scale: 1 };
  save(name, await send("Page.captureScreenshot", { format: "png", clip, captureBeyondViewport: true }));
};
const click = (expression) => evaluate(`(${expression}).click()`);
const button = (text) => `Array.from(document.querySelectorAll('button')).find((b) => b.textContent.startsWith(${JSON.stringify(text)}))`;
const row = (id) => `document.querySelector('[data-risk-bar="${id}"]').closest('button')`;

const VIEWER = "document.querySelector('canvas').closest('section')";
const RESULTS = `${row("cad")}.closest('section')`;
const TRUTH_TOGGLE = "document.getElementById('ground-truth-toggle')";
const TRUTH_BOX = `${TRUTH_TOGGLE}.closest('div')`;
const EXPLANATION = "Array.from(document.querySelectorAll('h3')).find((h) => h.textContent.startsWith('Why this estimate')).closest('section')";
const HEART_DRAWN = "Array.from(document.querySelectorAll('[data-label]')).some((l) => l.style.opacity === '1')";

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1366, height: 768, deviceScaleFactor: 2, mobile: false });
await send("Page.navigate", { url: APP_URL });
await until("!!document.querySelector('[data-risk-bar]')", "the first estimates");
await until(HEART_DRAWN, "the 3D heart");
await sleep(900);
await shoot("app_overview.png");

// What-if on Sample A: typical chest pain switched off.
await click("document.getElementById('quick-typical_chest_pain')");
await until("!!document.querySelector('[data-delta]')", "the what-if differences");
await sleep(1000);
await shoot("app_what_if.png");
await click(button("Reset to original"));
await sleep(300);

// Sample D with the dataset labels: the model is wrong for two vessels. The LAD is selected.
await click(button("Sample D"));
await until("document.querySelector('button[aria-pressed=true]').textContent.startsWith('Sample D') && !document.querySelector('.opacity-60')", "Sample D");
await sleep(600);
await click(TRUTH_TOGGLE);
await until("document.querySelectorAll('[data-truth]').length === 4", "the dataset labels");
await click(row("lad"));
await sleep(1500);
await shootElement("viewer_sample_d_lad.png", VIEWER);
await shootElement("ground_truth_sample_d_lad.png", RESULTS, TRUTH_BOX);
await shootElement("explanation_sample_d_lad.png", EXPLANATION);

socket.close();
child.kill();
await sleep(500);
try {
  rmSync(profile, { recursive: true, force: true });
} catch {
  // The browser may still hold its profile for a moment; it is a temporary folder either way.
}
process.exit(failed ? 1 : 0);
