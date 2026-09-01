import { spawn } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import puppeteer from "puppeteer-core";

const workspace = process.cwd();
const output = resolve(workspace, "artifacts/timeline-editor-qa");
const port = 5192;
const url = `http://127.0.0.1:${port}`;

async function chromePath() {
  const candidates = [
    process.env["MOTIONLY_CHROME"],
    `${process.env.ProgramFiles ?? "C:\\Program Files"}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)"}\\Google\\Chrome\\Application\\chrome.exe`,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next standard Chrome installation.
    }
  }
  throw new Error("Chrome not found; set MOTIONLY_CHROME.");
}

async function waitForPreview(child) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Vite is still starting.
    }
    if (child.exitCode !== null) break;
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error("Timeline QA preview did not start.");
}

await mkdir(output, { recursive: true });
const preview = spawn(
  process.execPath,
  [
    resolve(workspace, "node_modules/vite/bin/vite.js"),
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  { cwd: workspace, windowsHide: true, stdio: "ignore" },
);

let browser;
try {
  await waitForPreview(preview);
  browser = await puppeteer.launch({
    executablePath: await chromePath(),
    headless: true,
    args: ["--no-first-run", "--disable-extensions", "--hide-scrollbars"],
  });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewport({ width: 1450, height: 760, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: "networkidle0" });
  await page.waitForSelector(".me-project-scene-clip");

  const master = await page.evaluate(() => ({
    hasDebugButton: [...document.querySelectorAll("button")].some((button) =>
      button.textContent?.includes("GSAP timeline"),
    ),
    sceneLabels: [...document.querySelectorAll(".me-project-scene-clip")].map(
      (clip) => clip.textContent?.replace(/\s+/g, " ").trim(),
    ),
  }));
  if (master.hasDebugButton)
    throw new Error("The GSAP timeline debug button is still visible.");
  if (master.sceneLabels.some((label) => /\d+\.\d{3,}s/.test(label ?? "")))
    throw new Error(
      `Raw floating-point duration leaked: ${master.sceneLabels}`,
    );

  await page.click('[data-scene-id="intro"]');
  await page.waitForSelector('[data-track-id="intro-brand-name"]');
  const labels = await page.$$eval(
    ".scene-timeline-clip .me-clip-text",
    (nodes) => nodes.map((node) => node.textContent?.trim()),
  );
  if (!labels.includes("Motionly") || labels.includes("Motionly brand zoom"))
    throw new Error(`Scene tracks are not specific editable layers: ${labels}`);

  await page.click('[data-track-id="intro-brand-name"] .scene-timeline-clip');
  const selected = await page.evaluate(() => ({
    time: Number(
      document.querySelector('input[aria-label="Timeline scrubber"]')?.value,
    ),
    heading: document
      .querySelector(".me-selection-summary strong")
      ?.textContent?.trim(),
    hasPosition: Boolean(
      document.querySelector('input[aria-label="X position"]'),
    ),
    easingPresets: document.querySelectorAll(".me-ease-preset").length,
  }));
  if (
    selected.time < 27 ||
    selected.time > 28 ||
    selected.heading !== "Motionly" ||
    !selected.hasPosition ||
    selected.easingPresets !== 4
  )
    throw new Error(
      `Timeline selection did not reveal its layer: ${JSON.stringify(selected)}`,
    );

  await page.$eval('input[aria-label="X position"]', (input) => {
    input.value = "24";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.click('button[aria-label="Snappy easing"]');
  await new Promise((done) => setTimeout(done, 120));
  const edited = await page.evaluate(() => {
    const button = document.querySelector('button[aria-label="Snappy easing"]');
    const bounds = button?.getBoundingClientRect();
    const hit = bounds
      ? document.elementFromPoint(
          bounds.left + bounds.width / 2,
          bounds.top + bounds.height / 2,
        )
      : null;
    return {
      translate: document.querySelector('[data-motionly-id="intro-brand-name"]')
        ?.style.translate,
      easingActive: button?.classList.contains("me-active"),
      activeEasing: document.querySelector(".me-ease-preset.me-active span")
        ?.textContent,
      bounds: bounds
        ? { top: bounds.top, bottom: bounds.bottom, height: bounds.height }
        : null,
      hit: hit?.closest("button")?.getAttribute("aria-label") ?? hit?.className,
    };
  });
  if (!edited.translate?.startsWith("24px") || !edited.easingActive)
    throw new Error(
      `Layer edit did not apply: ${JSON.stringify({ edited, pageErrors })}`,
    );

  await page.click(".me-layer-visibility");
  const removed = await page.$eval(
    '[data-motionly-id="intro-brand-name"]',
    (element) => getComputedStyle(element).visibility,
  );
  if (removed !== "hidden")
    throw new Error("Remove layer did not hide the layer.");
  await page.click(".me-layer-visibility");
  const restored = await page.$eval(
    '[data-motionly-id="intro-brand-name"]',
    (element) => getComputedStyle(element).visibility,
  );
  if (restored === "hidden")
    throw new Error("Restore layer did not restore the layer.");

  await page.click('[data-scene-id="problem"]');
  await page.waitForSelector('[data-track-id="problem-morph-frame"]');
  await page.click(
    '[data-track-id="editorial-beat-2-text"] .scene-timeline-clip',
  );
  const textValue = await page.$eval("#property-text", (input) => input.value);
  if (textValue !== "But making them is way too hard.")
    throw new Error(`Text editor leaked split-word whitespace: ${textValue}`);

  await page.click(
    '[data-track-id="problem-morph-frame"] .scene-timeline-clip',
  );
  const backgroundSelection = await page.evaluate(() => ({
    heading: document
      .querySelector(".me-selection-summary strong")
      ?.textContent?.trim(),
    hasBackgroundColor: Boolean(
      document.querySelector('input[aria-label="Background color"]'),
    ),
    hasRemove: Boolean(document.querySelector(".me-layer-visibility")),
  }));
  if (
    backgroundSelection.heading !== "Editorial card background" ||
    !backgroundSelection.hasBackgroundColor ||
    !backgroundSelection.hasRemove
  )
    throw new Error(
      `Background is not independently editable: ${JSON.stringify(backgroundSelection)}`,
    );

  await page.click('[data-scene-id="solutions"]');
  await page.waitForSelector('[data-track-id="editorial-seriously-text"]');
  await page.$eval('input[aria-label="Timeline scrubber"]', (input) => {
    input.value = "40.8";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const seriouslyTiming = await page.evaluate(() => {
    const clip = document
      .querySelector(
        '[data-track-id="editorial-seriously-text"] .scene-timeline-clip',
      )
      ?.getBoundingClientRect();
    const marker = document
      .querySelector(".me-playhead-marker")
      ?.getBoundingClientRect();
    const text = document.querySelector(
      '[data-motionly-id="editorial-seriously-text"]',
    );
    const style = text ? getComputedStyle(text) : null;
    return {
      visible:
        style?.visibility !== "hidden" && Number(style?.opacity ?? 0) > 0.02,
      playheadInsideClip: Boolean(
        clip && marker && marker.left >= clip.left && marker.left <= clip.right,
      ),
    };
  });
  if (seriouslyTiming.visible && !seriouslyTiming.playheadInsideClip)
    throw new Error(
      `Seriously is visible outside its timeline clip: ${JSON.stringify(seriouslyTiming)}`,
    );

  await page.screenshot({ path: resolve(output, "timeline-editor.png") });
  console.log(
    JSON.stringify(
      {
        master,
        labels,
        selected,
        edited,
        backgroundSelection,
        seriouslyTiming,
      },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  preview.kill();
}
