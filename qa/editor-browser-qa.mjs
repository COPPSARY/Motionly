import { spawn } from "node:child_process";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

const wait = (milliseconds) =>
  new Promise((done) => setTimeout(done, milliseconds));
const workspace = process.cwd();
const output = resolve(workspace, "artifacts/code-first-qa");
if (!output.startsWith(`${resolve(workspace)}${sep}`))
  throw new Error("Invalid QA output path.");

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
      // Try the next standard location.
    }
  }
  throw new Error("Chrome not found; set MOTIONLY_CHROME.");
}

async function startPreview(port) {
  const vite = join(workspace, "node_modules", "vite", "bin", "vite.js");
  const child = spawn(
    process.execPath,
    [vite, "preview", "--host", "127.0.0.1", "--port", String(port)],
    {
      cwd: workspace,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let diagnostics = "";
  child.stdout?.on("data", (chunk) => (diagnostics += String(chunk)));
  child.stderr?.on("data", (chunk) => (diagnostics += String(chunk)));
  const url = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      if ((await fetch(url)).ok) return { child, url };
    } catch {
      // Vite is starting.
    }
    if (child.exitCode !== null) break;
    await wait(100);
  }
  child.kill();
  throw new Error(`Preview did not start. ${diagnostics.trim()}`);
}

async function launchBrowser(url) {
  const executable = await chromePath();
  const port = 9400 + Math.floor(Math.random() * 400);
  const profile = join(tmpdir(), `motionly-code-first-${Date.now()}`);
  const child = spawn(
    executable,
    [
      "--headless=new",
      "--no-first-run",
      "--disable-extensions",
      "--hide-scrollbars",
      "--force-color-profile=srgb",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "--window-size=1920,1080",
      url,
    ],
    { stdio: "ignore", windowsHide: true },
  );
  let target;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(
        (response) => response.json(),
      );
      target = targets.find((candidate) => candidate.type === "page");
      if (target) break;
    } catch {
      // Chrome is starting.
    }
    await wait(100);
  }
  if (!target) throw new Error("Chrome DevTools target unavailable.");
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((done, reject) => {
    socket.addEventListener("open", done, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  const errors = [];
  const warnings = [];
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
    if (message.method === "Runtime.exceptionThrown") {
      errors.push(
        message.params.exceptionDetails.exception?.description ??
          message.params.exceptionDetails.text,
      );
    }
    if (message.method === "Log.entryAdded") {
      if (message.params.entry.level === "error")
        errors.push(message.params.entry.text);
      if (message.params.entry.level === "warning")
        warnings.push(message.params.entry.text);
    }
  });
  const command = (method, params = {}) => {
    const id = ++nextId;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((done) => pending.set(id, done));
  };
  const evaluate = async (expression) => {
    const response = await command("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (response.result?.exceptionDetails)
      throw new Error(response.result.exceptionDetails.text);
    return response.result?.result?.value;
  };
  await command("Runtime.enable");
  await command("Log.enable");
  await command("Page.enable");
  await command("Emulation.setDeviceMetricsOverride", {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  });
  return {
    command,
    evaluate,
    errors,
    warnings,
    async close() {
      await command("Browser.close").catch(() => undefined);
      socket.close();
      child.kill();
      await rm(profile, { recursive: true, force: true }).catch(
        () => undefined,
      );
    },
  };
}

let preview;
let browser;
try {
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  preview = await startPreview(5191);
  browser = await launchBrowser(preview.url);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (
      await browser.evaluate(
        "Boolean(document.querySelector('.composition-root') && document.querySelector('.me-timeline-panel'))",
      )
    )
      break;
    if (attempt === 99) throw new Error("Editor did not become ready.");
    await wait(100);
  }

  const motionBeforePlay = await browser.evaluate(`(() => {
    const target = document.querySelector('.manifesto-line span');
    const style = getComputedStyle(target);
    return { transform: style.transform, opacity: style.opacity };
  })()`);
  await browser.evaluate(
    "document.querySelector('button[aria-label=Play]')?.click()",
  );
  await wait(1400);
  const playback = await browser.evaluate(`(() => {
    const target = document.querySelector('.manifesto-line span');
    const style = getComputedStyle(target);
    return {
      time: Number(document.querySelector('input[aria-label="Timeline scrubber"]')?.value ?? 0),
      pauseVisible: Boolean(document.querySelector('button[aria-label="Pause"]')),
      target: { transform: style.transform, opacity: style.opacity },
    };
  })()`);
  const targetChanged =
    motionBeforePlay.transform !== playback.target.transform ||
    motionBeforePlay.opacity !== playback.target.opacity;
  if (!playback.pauseVisible || playback.time < 1.1 || !targetChanged)
    throw new Error(
      `Playback failed: ${JSON.stringify({ playback, errors: browser.errors, warnings: browser.warnings })}`,
    );
  await browser.evaluate(
    "document.querySelector('button[aria-label=Pause]')?.click()",
  );

  const frames = [];
  for (const time of [0.8, 5.6, 8.2, 12.2, 18.4, 24.4]) {
    await browser.evaluate(`(() => {
      const scrubber = document.querySelector('input[aria-label="Timeline scrubber"]');
      scrubber.value = '${time}';
      scrubber.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await wait(250);
    const state = await browser.evaluate(`(() => {
      const shell = document.querySelector('.me-stage');
      const rect = shell.getBoundingClientRect();
      const canvas = document.querySelector('.composition-canvas');
      const canvasRect = canvas.getBoundingClientRect();
      const visibleScenes = [...document.querySelectorAll('.scene')].filter((scene) => {
        const style = getComputedStyle(scene);
        return style.visibility !== 'hidden' && Number(style.opacity) > .01;
      });
      return {
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        canvasRect: { x: canvasRect.x, y: canvasRect.y, width: canvasRect.width, height: canvasRect.height },
        canvasTransform: getComputedStyle(canvas).transform,
        visibleScenes: visibleScenes.map((scene) => scene.dataset['motionlyId']),
        visibleText: visibleScenes[0]?.textContent?.replace(/\\s+/g, ' ').trim().slice(0, 180) ?? '',
        registered: document.querySelectorAll('[data-motionly-id]').length,
      };
    })()`);
    if (state.visibleScenes.length !== 1 || state.registered < 20)
      throw new Error(`Invalid frame ${time}: ${JSON.stringify(state)}`);
    const screenshot = await browser.command("Page.captureScreenshot", {
      format: "png",
      clip: { ...state.rect, scale: 1 },
      captureBeyondViewport: false,
    });
    const filename = `frame-${String(time).replace(".", "-")}.png`;
    await writeFile(
      join(output, filename),
      Buffer.from(screenshot.result.data, "base64"),
    );
    if (time === 12.2) {
      const editorScreenshot = await browser.command("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
      });
      await writeFile(
        join(output, "editor-shell.png"),
        Buffer.from(editorScreenshot.result.data, "base64"),
      );
    }
    frames.push({ time, ...state, screenshot: filename });
  }

  const handoffs = [];
  for (const time of [4.15, 9.55, 15.85, 21.35]) {
    await browser.evaluate(`(() => {
      const scrubber = document.querySelector('input[aria-label="Timeline scrubber"]');
      scrubber.value = '${time}';
      scrubber.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await wait(180);
    const state = await browser.evaluate(`(() => {
      const shell = document.querySelector('.me-stage');
      const rect = shell.getBoundingClientRect();
      const visibleScenes = [...document.querySelectorAll('.scene')]
        .filter((scene) => {
          const style = getComputedStyle(scene);
          return style.visibility !== 'hidden' && Number(style.opacity) > .01;
        })
        .map((scene) => {
          const style = getComputedStyle(scene);
          return {
            id: scene.dataset['motionlyId'],
            transform: style.transform,
            clipPath: style.clipPath,
          };
        });
      return {
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        visibleScenes,
      };
    })()`);
    if (
      state.visibleScenes.length !== 2 ||
      state.visibleScenes.every(
        (scene) => scene.transform === "none" && scene.clipPath === "none",
      )
    )
      throw new Error(`Static scene handoff ${time}: ${JSON.stringify(state)}`);
    const screenshot = await browser.command("Page.captureScreenshot", {
      format: "png",
      clip: { ...state.rect, scale: 1 },
      captureBeyondViewport: false,
    });
    const filename = `handoff-${String(time).replace(".", "-")}.png`;
    await writeFile(
      join(output, filename),
      Buffer.from(screenshot.result.data, "base64"),
    );
    handoffs.push({ time, ...state, screenshot: filename });
  }

  const cameraMotion = [];
  for (const time of [12.2, 13.7, 18.0, 19.5]) {
    await browser.evaluate(`(() => {
      const scrubber = document.querySelector('input[aria-label="Timeline scrubber"]');
      scrubber.value = '${time}';
      scrubber.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await wait(120);
    cameraMotion.push(
      await browser.evaluate(`(() => {
        const target = document.querySelector(${time < 16 ? "'[data-motionly-id=studio-window]'" : "'[data-motionly-id=lab-stage]'"});
        return { time: ${time}, transform: getComputedStyle(target).transform };
      })()`),
    );
  }
  if (
    cameraMotion[0].transform === cameraMotion[1].transform ||
    cameraMotion[2].transform === cameraMotion[3].transform
  )
    throw new Error(`Camera route stayed static: ${JSON.stringify(cameraMotion)}`);

  await browser.evaluate(
    "document.querySelector('[data-motionly-id=final-cta]')?.click()",
  );
  const selected = await browser.evaluate(
    "document.querySelector('.me-selection-summary strong')?.textContent",
  );
  if (selected !== "final-cta")
    throw new Error("Canvas selection did not reach the inspector.");

  await browser.evaluate(
    "document.querySelector('button[aria-label=Restart]')?.click()",
  );
  await wait(120);
  const restarted = Number(
    await browser.evaluate(
      "document.querySelector('input[aria-label=\"Timeline scrubber\"]')?.value ?? -1",
    ),
  );
  if (restarted > 0.35) throw new Error(`Restart failed at ${restarted}.`);

  const exportButton = await browser.evaluate(`(() => {
    const button = document.querySelector('.export-action');
    const state = { found: Boolean(button), disabled: Boolean(button?.disabled), text: button?.textContent?.trim() ?? '' };
    button?.click();
    return state;
  })()`);
  const exportMessages = [];
  for (let attempt = 0; attempt < 240; attempt += 1) {
    const message = await browser.evaluate(
      "document.querySelector('.notice')?.textContent ?? ''",
    );
    if (message && exportMessages.at(-1) !== message)
      exportMessages.push(message);
    if (message.includes("Export successful")) break;
    if (attempt === 239)
      throw new Error(
        `Frame export did not complete: ${JSON.stringify({ exportButton, exportMessages, errors: browser.errors })}`,
      );
    await wait(100);
  }

  const result = {
    playback: { before: motionBeforePlay, ...playback, targetChanged },
    frames,
    handoffs,
    cameraMotion,
    errors: browser.errors,
    warnings: browser.warnings,
  };
  if (result.errors.length || result.warnings.length)
    throw new Error(JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser?.close();
  if (preview?.child.exitCode === null) preview.child.kill();
}
