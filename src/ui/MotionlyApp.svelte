<script lang="ts">
  import { onMount } from 'svelte';
  import { Download, FileText, FolderOpen, LoaderCircle, Save, Star, X } from 'lucide-svelte';
  import { appUrl } from '../app/routing';
  import MotionEditor from './components/MotionEditor.svelte';
  import type { ExportSupport, VideoExportSettings } from '../types/export';

  const logoUrl = appUrl('logo.svg');
  const githubIconUrl = appUrl('github.svg');
  // ponytail: localStorage is enough for source drafts; move to IndexedDB if projects exceed its quota.
  const autoSaveKey = 'motionly:auto-save';
  const retiredBlueskySignatures = ['as phonePair', 'as phoneHero', 'as feedUi', 'as butterfly'];

  type MotionFileHandle = {
    name: string;
    getFile(): Promise<File>;
    createWritable(): Promise<{ write(data: string | Blob): Promise<void>; close(): Promise<void> }>;
  };

  type FilePickerWindow = Window & {
    showOpenFilePicker?: (options: object) => Promise<MotionFileHandle[]>;
    showSaveFilePicker?: (options: object) => Promise<MotionFileHandle>;
  };

  type MotionEditorHandle = {
    getExportInfo(): { width: number; height: number; fps: number; support: ExportSupport };
    exportProject(
      settings: VideoExportSettings,
      onProgress?: (progress: number) => void,
      signal?: AbortSignal
    ): Promise<Blob | null>;
  };

  const fallbackMotion = `canvas {
  size 1920x1080
  fps 60
  duration 5s
  background #020308
}

text title {
  value "Motion graphics, written."
  center
  size 72
  color #ffffff
  opacity 1
}

animate title {
  from {
    opacity 0
    y 80
    blur 10
  }

  to {
    opacity 1
    y 0
    blur 0
  }

  duration 1.2s
  easing power3.out
}`;

  function loadAutoSave(): { code: string; name: string } | null {
    try {
      const saved = JSON.parse(localStorage.getItem(autoSaveKey) ?? 'null') as {
        code?: unknown;
        name?: unknown;
      } | null;
      if (!saved || typeof saved.code !== 'string' || typeof saved.name !== 'string') return null;
      if (retiredBlueskySignatures.every((signature) => saved.code.includes(signature))) {
        localStorage.removeItem(autoSaveKey);
        return null;
      }
      return { code: saved.code, name: saved.name };
    } catch {
      return null;
    }
  }

  const autoSave = loadAutoSave();
  let motionCode = autoSave?.code ?? fallbackMotion;
  let currentFile = autoSave?.name ?? 'untitled.motion';
  let fileInput: HTMLInputElement;
  let fileHandle: MotionFileHandle | null = null;
  let serverBacked = false;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let writeQueue = Promise.resolve();
  let editor: MotionEditorHandle | undefined;
  let isExporting = false;
  let exportProgress = 0;
  let exportSuccess = '';
  let exportSuccessTimer: ReturnType<typeof setTimeout> | null = null;
  let showExportSettings = false;
  let isCancellingExport = false;
  let exportController: AbortController | null = null;
  let exportInfo = {
    width: 1920,
    height: 1080,
    fps: 60,
    support: { mp4: true, webm: false, gif: true },
  };
  let exportSettings: VideoExportSettings = {
    format: 'mp4',
    height: 1080,
    fps: 60,
    quality: 'high',
    bitrateMbps: 10,
  };
  let starCount: number | null = null;

  onMount(() => {
    void loadInitialProject();
    void loadStarCount();
    return () => {
      if (saveTimer) clearTimeout(saveTimer);
      if (exportSuccessTimer) clearTimeout(exportSuccessTimer);
    };
  });

  $: if (fileHandle || serverBacked) scheduleAutoSave(motionCode);
  $: {
    try {
      localStorage.setItem(autoSaveKey, JSON.stringify({ code: motionCode, name: currentFile }));
    } catch {
      // Keep editing when browser storage is unavailable or full.
    }
  }

  async function loadInitialProject() {
    try {
      let response = await fetch('/api/motion-project', { cache: 'no-store' });
      if (response.ok && response.headers.get('content-type')?.startsWith('text/plain')) {
        motionCode = await response.text();
        currentFile = response.headers.get('x-motionly-project-name') || 'project.motion';
        serverBacked = true;
        return;
      }
    } catch (error) {
      console.warn(error);
    }
  }

  async function handleOpen() {
    const picker = (window as FilePickerWindow).showOpenFilePicker;
    if (!picker) {
      fileInput.click();
      return;
    }
    try {
      const [handle] = await picker.call(window, {
        multiple: false,
        types: [{ description: 'Motionly project', accept: { 'text/plain': ['.motion'] } }],
      });
      if (!handle) return;
      const file = await handle.getFile();
      motionCode = await file.text();
      currentFile = file.name;
      fileHandle = handle;
      serverBacked = false;
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') console.error(error);
    }
  }

  async function handleSave() {
    if (fileHandle) {
      await writeFile(fileHandle, motionCode);
      return;
    }
    if (serverBacked) {
      await writeServerProject(motionCode);
      return;
    }
    const picker = (window as FilePickerWindow).showSaveFilePicker;
    if (picker) {
      try {
        fileHandle = await picker.call(window, {
          suggestedName: currentFile.endsWith('.motion') ? currentFile : `${currentFile}.motion`,
          types: [{ description: 'Motionly project', accept: { 'text/plain': ['.motion'] } }],
        });
        currentFile = fileHandle.name;
        await writeFile(fileHandle, motionCode);
        return;
      } catch (error) {
        if ((error as DOMException).name !== 'AbortError') console.error(error);
        return;
      }
    }
    const blob = new Blob([motionCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = currentFile.endsWith('.motion') ? currentFile : `${currentFile}.motion`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleFileSelected(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    motionCode = await file.text();
    currentFile = file.name;
    fileHandle = null;
    serverBacked = false;
    fileInput.value = '';
  }

  function scheduleAutoSave(source: string) {
    if (!fileHandle && !serverBacked) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const handle = fileHandle;
      if (!handle && !serverBacked) return;
      writeQueue = writeQueue
        .then(() => (handle ? writeFile(handle, source) : writeServerProject(source)))
        .catch(console.error);
    }, 250);
  }

  async function writeFile(handle: MotionFileHandle, source: string) {
    const writable = await handle.createWritable();
    await writable.write(source);
    await writable.close();
  }

  async function writeServerProject(source: string) {
    const response = await fetch('/api/motion-project', {
      method: 'PUT',
      headers: { 'content-type': 'text/plain;charset=utf-8' },
      body: source,
    });
    if (!response.ok) throw new Error(`Could not save ${currentFile} (${response.status})`);
  }

  function openExportSettings() {
    if (!editor || isExporting) return;
    exportInfo = editor.getExportInfo();
    exportSettings = {
      format: 'mp4',
      height: exportInfo.height,
      fps: exportInfo.fps,
      quality: 'high',
      bitrateMbps: defaultBitrate(exportInfo.height, exportInfo.fps),
    };
    showExportSettings = true;
  }

  function closeExportSettings() {
    showExportSettings = false;
  }

  function handleWindowKeydown(event: KeyboardEvent) {
    if (showExportSettings && event.key === 'Escape') {
      event.preventDefault();
      closeExportSettings();
    }
  }

  function defaultBitrate(height: number, fps: number): number {
    const base = height >= 2160 ? 28 : height >= 1440 ? 18 : height >= 1080 ? 10 : 5;
    return Math.max(1, Math.round(base * (fps / 60)));
  }

  function exportWidth(height: number): number {
    return Math.round((height * exportInfo.width) / exportInfo.height);
  }

  function resolutionOptions(): number[] {
    return [...new Set([480, 720, 1080, 1440, 2160, exportInfo.height])].sort((a, b) => a - b);
  }

  function frameRateOptions(): number[] {
    return [...new Set([24, 25, 30, 50, 60, exportInfo.fps])].sort((a, b) => a - b);
  }

  function bitrateOptions(): number[] {
    return [...new Set([2, 5, 10, 20, 30, 50, 100, exportSettings.bitrateMbps])].sort((a, b) => a - b);
  }

  function cancelExport() {
    if (!exportController || isCancellingExport) return;
    isCancellingExport = true;
    exportController.abort();
  }

  function showExportSuccess() {
    if (exportSuccessTimer) clearTimeout(exportSuccessTimer);
    exportSuccess = 'Export successful.';
    exportSuccessTimer = setTimeout(() => (exportSuccess = ''), 1000);
  }

  async function handleExport() {
    if (!editor || isExporting) return;
    const settings = {
      ...exportSettings,
      height: Math.max(144, Math.min(4320, Number(exportSettings.height) || exportInfo.height)),
      fps: Math.max(1, Math.min(120, Number(exportSettings.fps) || exportInfo.fps)),
      bitrateMbps: Math.max(0.5, Math.min(200, Number(exportSettings.bitrateMbps) || 10)),
    };
    showExportSettings = false;
    const project = currentFile.replace(/\.motion$/i, '') || 'project';
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    const format = {
      mp4: { extension: 'mp4', description: 'MP4 video', mime: 'video/mp4' },
      webm: { extension: 'webm', description: 'WebM video', mime: 'video/webm' },
      gif: { extension: 'gif', description: 'Animated GIF', mime: 'image/gif' },
    }[settings.format];
    const filename =
      `${project}_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
      `_${pad(now.getHours())}${pad(now.getMinutes())}.${format.extension}`;
    const picker = (window as FilePickerWindow).showSaveFilePicker;
    let outputHandle: MotionFileHandle | null = null;
    if (picker) {
      try {
        outputHandle = await picker.call(window, {
          suggestedName: filename,
          types: [{ description: format.description, accept: { [format.mime]: [`.${format.extension}`] } }],
        });
      } catch (error) {
        if ((error as DOMException).name !== 'AbortError') console.error(error);
        return;
      }
    }

    exportController = new AbortController();
    isExporting = true;
    isCancellingExport = false;
    exportProgress = 0;
    try {
      const video = await editor.exportProject(
        settings,
        (progress) => (exportProgress = progress),
        exportController.signal
      );
      if (!video || exportController.signal.aborted) return;
      exportProgress = 1;
      if (outputHandle) {
        const writable = await outputHandle.createWritable();
        await writable.write(video);
        await writable.close();
      } else {
        const url = URL.createObjectURL(video);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
      }
      showExportSuccess();
    } finally {
      exportController = null;
      isExporting = false;
      isCancellingExport = false;
    }
  }

  async function loadStarCount() {
    try {
      const response = await fetch('https://api.github.com/repos/COPPSARY/Motionly');
      if (!response.ok) return;
      const data = (await response.json()) as { stargazers_count?: number };
      if (typeof data.stargazers_count === 'number') starCount = data.stargazers_count;
    } catch {
      // The repository link still works if GitHub is unavailable.
    }
  }

  function formatStarCount(value: number): string {
    return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  }
</script>

<svelte:window on:keydown={handleWindowKeydown} />

<div class="app">
  <!-- Top Bar -->
  <div class="top-bar">
    <div class="brand">
      <span class="logo-shell">
        <img src={logoUrl} alt="Motionly" class="logo" />
      </span>
      <h1>Motionly</h1>
      <a
        class="product-hunt-badge"
        href="https://www.producthunt.com/products/motionly?embed=true&amp;utm_source=badge-featured&amp;utm_medium=badge&amp;utm_campaign=badge-motionly-2"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="View Motionly on Product Hunt"
      >
        <img
          alt="Motionly - AI-native motion graphics editor | Product Hunt"
          width="250"
          height="54"
          src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1202670&amp;theme=dark&amp;t=1784818211382"
        />
      </a>
    </div>

    <div class="file-info">
      <FileText size={16} />
      <span>{currentFile}</span>
    </div>

    <div class="actions">
      <input
        bind:this={fileInput}
        class="file-input"
        type="file"
        accept=".motion,text/plain"
        on:change={handleFileSelected}
      />
      <button on:click={handleOpen} class="btn" title="Open .motion file">
        <FolderOpen size={18} />
        <span class="action-label">Open</span>
      </button>
      <button on:click={handleSave} class="btn btn-primary" title="Save changes (Ctrl/Cmd+S)">
        <Save size={18} />
        <span class="action-label">Save</span>
      </button>
      <button on:click={openExportSettings} class="btn export-action" disabled={isExporting || showExportSettings} title="Export">
        {#if isExporting}
          <span class="export-spinner" aria-hidden="true"><LoaderCircle size={18} /></span>
        {:else}
          <Download size={18} />
        {/if}
        <span class="action-label">{isExporting ? `Exporting ${Math.round(exportProgress * 100)}%` : 'Export'}</span>
      </button>
      <a
        class="btn github-btn"
        href="https://github.com/COPPSARY/Motionly"
        target="_blank"
        rel="noreferrer"
        title="Star Motionly on GitHub"
        aria-label={starCount === null ? 'Star Motionly on GitHub' : `Star Motionly on GitHub, ${starCount} stars`}
      >
        <img src={githubIconUrl} alt="" />
        <Star size={14} fill="currentColor" />
        <span class="action-label">Star</span>
        {#if starCount !== null}
          <strong>{formatStarCount(starCount)}</strong>
        {:else}
          <img
            class="star-count"
            src="https://img.shields.io/github/stars/COPPSARY/Motionly?style=flat&label="
            alt="Stars"
          />
        {/if}
      </a>
      <a
        class="btn docs-btn"
        href="https://motionly.mintlify.app/"
        target="_blank"
        rel="noreferrer"
        title="View Documentation"
        aria-label="View Documentation"
      >
        <FileText size={18} />
        <span class="action-label">Documentation</span>
      </a>
    </div>
  </div>

  <!-- Editor -->
  <MotionEditor bind:this={editor} bind:code={motionCode} onSave={handleSave} {serverBacked} />

  {#if showExportSettings}
    <div class="export-settings-overlay">
      <div class="export-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="export-settings-title">
        <div class="export-settings-header">
          <div>
            <h2 id="export-settings-title">Export Settings</h2>
            <p>Choose the output settings before selecting where to save.</p>
          </div>
          <button type="button" on:click={closeExportSettings} aria-label="Close export settings">
            <X size={18} />
          </button>
        </div>

        <div class="export-settings-grid">
          <label>
            <span>Export format</span>
            <select id="export-format" bind:value={exportSettings.format}>
              <option value="mp4">MP4</option>
              <option value="webm" disabled={!exportInfo.support.webm}>WebM</option>
              <option value="gif">GIF</option>
            </select>
          </label>

          <label>
            <span>Resolution</span>
            <select id="export-resolution" bind:value={exportSettings.height}>
              {#each resolutionOptions() as height}
                <option value={height}>{exportWidth(height)} × {height}</option>
              {/each}
            </select>
          </label>

          <label>
            <span>Frame rate</span>
            <select id="export-fps" bind:value={exportSettings.fps}>
              {#each frameRateOptions() as fps}
                <option value={fps}>{fps} FPS</option>
              {/each}
            </select>
          </label>

          <label>
            <span>Video quality</span>
            <select id="export-quality" bind:value={exportSettings.quality} disabled={exportSettings.format !== 'mp4'}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="very-high">Very High</option>
            </select>
          </label>

          <label>
            <span>Bitrate</span>
            <select
              id="export-bitrate"
              bind:value={exportSettings.bitrateMbps}
              disabled={exportSettings.format === 'gif'}
            >
              {#each bitrateOptions() as bitrate}
                <option value={bitrate}>{bitrate} Mbps</option>
              {/each}
            </select>
          </label>
        </div>

        {#if exportSettings.format === 'gif'}
          <p class="export-settings-note">GIF does not use video quality or bitrate.</p>
        {:else if exportSettings.format === 'webm'}
          <p class="export-settings-note">WebM quality is controlled by bitrate.</p>
        {/if}

        <div class="export-settings-footer">
          <button type="button" class="export-settings-cancel" on:click={closeExportSettings}>Cancel</button>
          <button type="button" class="export-settings-confirm" on:click={handleExport}>Choose Save Location</button>
        </div>
      </div>
    </div>
  {/if}

  {#if isExporting}
    <div class="export-progress-overlay">
      <div class="export-progress-card" role="status" aria-live="polite">
        <span class="export-progress-spinner" aria-hidden="true"><LoaderCircle size={30} /></span>
        <h2>Exporting {exportSettings.format.toUpperCase()}</h2>
        <p>{Math.round(exportProgress * 100)}% complete</p>
        <div
          class="export-progress-track"
          role="progressbar"
          aria-label={`${exportSettings.format.toUpperCase()} export progress`}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={Math.round(exportProgress * 100)}
        >
          <span style={`width: ${Math.round(exportProgress * 100)}%`}></span>
        </div>
        <button type="button" class="export-cancel-button" on:click={cancelExport} disabled={isCancellingExport}>
          {isCancellingExport ? 'Cancelling…' : 'Cancel Export'}
        </button>
      </div>
    </div>
  {/if}

  {#if exportSuccess}
    <div class="export-progress-overlay export-success-overlay">
      <div class="export-progress-card export-success-card" role="status" aria-live="polite">
        <h2>{exportSuccess}</h2>
      </div>
    </div>
  {/if}
</div>

<style>
  :global(html),
  :global(body) {
    width: 100%;
    height: 100%;
    margin: 0;
    overflow: hidden;
    background: #0e0e10;
  }

  :global(body) {
    font-family:
      'Inter Variable', Inter, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif;
  }

  .app {
    width: 100%;
    height: 100dvh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #0e0e10;
  }

  .app :global(.motion-editor) {
    flex: 1 1 auto;
    min-height: 0;
  }

  .top-bar {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    padding: 10px 18px;
    background: rgba(20, 20, 23, 0.92);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.03) inset;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .logo-shell {
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border-radius: 9px;
    background: #15171a;
    border: 1px solid #2a2d32;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28);
  }

  .brand .logo {
    width: 24px;
    height: 24px;
    display: block;
    border-radius: 7px;
  }

  .brand h1 {
    margin: 0;
    font-size: 15px;
    font-weight: 650;
    color: #f2f3f5;
    letter-spacing: 0;
  }

  .product-hunt-badge {
    flex: 0 0 auto;
    display: flex;
    margin-left: 4px;
    border-radius: 4px;
    overflow: hidden;
  }

  .product-hunt-badge img {
    width: 125px;
    height: 27px;
    display: block;
  }

  .file-info {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    color: #8e939b;
    font-size: 13px;
  }

  .file-info span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .actions {
    display: flex;
    gap: 8px;
    flex: 0 0 auto;
  }

  .file-input {
    display: none;
  }

  .btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 13px;
    background: #17191c;
    border: 1px solid #2c3035;
    border-radius: 6px;
    color: #e4e6ea;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.16s, border-color 0.16s, color 0.16s;
  }

  .btn:hover {
    background: #202328;
    border-color: #3a3f46;
    color: #fff;
  }

  .btn:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .export-action {
    min-width: 116px;
    justify-content: center;
  }

  .export-spinner {
    display: inline-flex;
    animation: export-spin 0.8s linear infinite;
  }

  .export-settings-overlay {
    position: fixed;
    inset: 0;
    z-index: 1100;
    display: grid;
    place-items: center;
    padding: 20px;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
  }

  .export-settings-dialog {
    width: min(520px, calc(100vw - 40px));
    max-height: calc(100vh - 40px);
    overflow: auto;
    border: 1px solid #2a2d33;
    border-radius: 12px;
    background: #17191c;
    color: #e4e6ea;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
  }

  .export-settings-header,
  .export-settings-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 16px 20px;
  }

  .export-settings-header {
    border-bottom: 1px solid #2a2d33;
  }

  .export-settings-header h2,
  .export-settings-header p {
    margin: 0;
  }

  .export-settings-header h2 {
    font-size: 16px;
  }

  .export-settings-header p {
    margin-top: 5px;
    color: #9ca3af;
    font-size: 12px;
  }

  .export-settings-header button {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: #9ca3af;
    cursor: pointer;
  }

  .export-settings-header button:hover {
    background: #24262a;
    color: #fff;
  }

  .export-settings-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    padding: 20px;
  }

  .export-settings-grid label > span {
    display: block;
    margin-bottom: 7px;
    color: #aeb3bb;
    font-size: 12px;
    font-weight: 600;
  }

  .export-settings-grid select {
    width: 100%;
    height: 38px;
    box-sizing: border-box;
    border: 1px solid #343840;
    border-radius: 6px;
    outline: none;
    background: #111214;
    color: #e4e6ea;
    font: inherit;
  }

  .export-settings-grid select {
    appearance: none;
    padding: 0 36px 0 12px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
  }

  .export-settings-grid select:focus {
    border-color: #0a84ff;
  }

  .export-settings-grid select:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .export-settings-note {
    margin: -4px 20px 16px;
    color: #8e939b;
    font-size: 12px;
  }

  .export-settings-footer {
    justify-content: flex-end;
    border-top: 1px solid #2a2d33;
    background: #111214;
  }

  .export-settings-footer button,
  .export-cancel-button {
    padding: 8px 14px;
    border: 1px solid #343840;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .export-settings-cancel,
  .export-cancel-button {
    background: transparent;
    color: #d8dce2;
  }

  .export-settings-confirm {
    background: #ef4444;
    border-color: #ef4444 !important;
    color: #fff;
  }

  .export-progress-overlay {
    position: fixed;
    inset: 0;
    z-index: 900;
    display: grid;
    place-items: center;
    background: rgba(0, 0, 0, 0.68);
    backdrop-filter: blur(4px);
  }

  .export-success-overlay {
    z-index: 1200;
  }

  .export-success-card {
    padding: 24px;
    border: 1px solid rgba(74, 222, 128, 0.4);
    color: #dcfce7;
    animation: export-toast-in 0.18s ease-out;
  }

  .export-success-card h2 {
    margin: 0;
  }

  .export-progress-card {
    width: min(360px, calc(100vw - 40px));
    box-sizing: border-box;
    padding: 28px;
    border: 1px solid #2a2d33;
    border-radius: 12px;
    background: #17191c;
    color: #e4e6ea;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
  }

  .export-progress-spinner {
    display: inline-flex;
    color: #ef4444;
    animation: export-spin 0.55s linear infinite;
  }

  .export-progress-card h2 {
    margin: 14px 0 5px;
    font-size: 17px;
  }

  .export-progress-card p {
    margin: 0 0 18px;
    color: #9ca3af;
    font-size: 13px;
  }

  .export-progress-track {
    position: relative;
    height: 6px;
    overflow: hidden;
    border-radius: 999px;
    background: #2a2d33;
  }

  .export-progress-track::after {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.24) 50%, transparent 100%);
    content: '';
    transform: translateX(-100%);
    animation: export-shimmer 0.75s ease-in-out infinite;
  }

  .export-progress-track span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: #ef4444;
    transition: width 0.15s ease;
  }

  .export-cancel-button {
    margin-top: 20px;
  }

  .export-cancel-button:disabled {
    cursor: wait;
    opacity: 0.6;
  }

  @keyframes export-spin {
    to { transform: rotate(360deg); }
  }

  @keyframes export-shimmer {
    to { transform: translateX(100%); }
  }

  @keyframes export-toast-in {
    from { opacity: 0; transform: translateY(-6px); }
  }

  @media (prefers-reduced-motion: reduce) {
    .export-progress-spinner,
    .export-progress-track::after,
    .export-success-card {
      animation: none;
    }
  }

  .btn-primary {
    background: #0a84ff;
    border-color: #0a84ff;
    color: #ffffff;
    font-weight: 600;
  }

  .btn-primary:hover {
    background: #2997ff;
    border-color: #2997ff;
    color: #ffffff;
  }

  .github-btn {
    min-width: 92px;
    justify-content: center;
    padding: 8px 10px;
    box-sizing: border-box;
    text-decoration: none;
  }

  .docs-btn {
    justify-content: center;
    padding: 8px 10px;
    box-sizing: border-box;
    text-decoration: none;
  }

  .github-btn img {
    width: 18px;
    height: 18px;
    display: block;
  }

  .github-btn strong {
    padding-left: 7px;
    border-left: 1px solid #34383e;
    color: #ffffff;
    font-size: 12px;
  }

  .github-btn .star-count {
    width: auto;
    height: 18px;
    border-left: 1px solid #34383e;
    padding-left: 7px;
  }

  @media (max-width: 1120px) {
    .product-hunt-badge {
      display: none;
    }
  }

  @media (max-width: 760px) {
    .file-info {
      display: none;
    }
  }

  @media (max-width: 520px) {
    .top-bar {
      gap: 8px;
      padding: 8px;
    }

    .brand h1,
    .action-label {
      display: none;
    }

    .actions {
      gap: 5px;
    }

    .btn,
    .export-action {
      width: 36px;
      min-width: 36px;
      height: 36px;
      justify-content: center;
      padding: 0;
    }

    .github-btn {
      width: auto;
      min-width: 58px;
      padding: 0 8px;
    }

    .export-settings-grid {
      grid-template-columns: 1fr;
    }
  }

  .app { background: linear-gradient(180deg, #111113 0%, #0e0e10 30%, #0e0e10 100%); }
  .top-bar { min-height: 52px; padding: 8px 14px; backdrop-filter: blur(18px); box-shadow: none; }
  .logo-shell, .btn { border-color: rgba(255,255,255,.08); background: rgba(255,255,255,.045); }
  .btn { border-radius: 8px; }
  .btn:hover { border-color: rgba(255,255,255,.14); background: rgba(255,255,255,.08); }
  .btn-primary, .btn-primary:hover { background: #0a84ff; border-color: #0a84ff; color: #fff; }
  .file-info { position: absolute; left: 50%; transform: translateX(-50%); }


  /* Calm native-feeling app chrome. */
  .app { background: linear-gradient(180deg, #101012 0%, #0e0e10 34%, #0d0d0f 100%); }
  .top-bar {
    min-height: 50px;
    padding: 7px 14px;
    background: #141416;
    border-bottom-color: rgba(255,255,255,.08);
    backdrop-filter: none;
    box-shadow: none;
  }
  .logo-shell { border-color: rgba(255,255,255,.08); border-radius: 8px; background: #19191c; box-shadow: none; }
  .btn {
    height: 32px;
    padding: 0 10px;
    border-color: rgba(255,255,255,.08);
    border-radius: 7px;
    background: #1b1b1e;
    color: #b8b8bf;
    box-shadow: none;
  }
  .btn:hover { border-color: rgba(255,255,255,.13); background: #242428; color: #f2f2f4; }
  .btn:active { background: #151517; }
  .btn-primary { border-color: #0a84ff; background: #0a84ff; color: #fff; }
  .btn-primary:hover { border-color: #218df7; background: #218df7; color: #fff; }
  .product-hunt-badge {
    opacity: 1;
    filter: none;
    transition: opacity 0.16s ease;
  }
  .product-hunt-badge img {
    width: 180px;
    height: 39px;
  }
  .product-hunt-badge:hover { opacity: .9; }


  /* Subtly illuminated buttons with the Motionly logo palette. */
  .btn {
    border-color: rgba(255,255,255,.1);
    background: #1b1b1e;
    box-shadow: none;
    font-weight: 520;
  }
  .btn:hover {
    border-color: rgba(255,255,255,.16);
    background: #242428;
    box-shadow: none;
  }
  .btn:active {
    background: #171719;
    box-shadow: none;
    transform: none;
  }
  .btn-primary,
  .btn-primary:hover {
    border-color: rgba(255,255,255,.16);
    background: #0a84ff;
    color: #fff;
    box-shadow: none;
  }
  .btn-primary:hover { background: #2997ff; }

  /* Flat at rest; Motionly logo gradient on interaction and primary actions. */
  .btn:hover {
    border-color: rgba(138, 180, 255, 0.3);
    background: linear-gradient(135deg, rgba(138, 180, 255, 0.16), rgba(124, 247, 197, 0.09));
    color: #f5f8f7;
  }
  .btn-primary,
  .btn-primary:hover {
    border-color: rgba(255, 255, 255, 0.18);
    background: linear-gradient(135deg, #8ab4ff 0%, #7cf7c5 100%);
    color: #fff;
  }

</style>
