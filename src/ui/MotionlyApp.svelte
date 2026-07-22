<script lang="ts">
  import { onMount } from 'svelte';
  import { CircleHelp, Download, FileText, FolderOpen, Save, Star } from 'lucide-svelte';
  import { appUrl } from '../app/routing';
  import MotionEditor from './components/MotionEditor.svelte';

  const logoUrl = appUrl('logo.svg');
  const githubIconUrl = appUrl('github.svg');

  type MotionFileHandle = {
    name: string;
    getFile(): Promise<File>;
    createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
  };

  type FilePickerWindow = Window & {
    showOpenFilePicker?: (options: object) => Promise<MotionFileHandle[]>;
    showSaveFilePicker?: (options: object) => Promise<MotionFileHandle>;
  };

  type MotionEditorHandle = {
    exportMp4(filename?: string, onProgress?: (progress: number) => void): Promise<void>;
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

  let motionCode = fallbackMotion;

  let currentFile = 'untitled.motion';
  let fileInput: HTMLInputElement;
  let fileHandle: MotionFileHandle | null = null;
  let serverBacked = false;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let writeQueue = Promise.resolve();
  let editor: MotionEditorHandle | undefined;
  let isExporting = false;
  let exportProgress = 0;
  let starCount: number | null = null;

  onMount(() => {
    void loadInitialProject();
    void loadStarCount();
    return () => {
      if (saveTimer) clearTimeout(saveTimer);
    };
  });

  $: if (fileHandle) scheduleAutoSave(motionCode);

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
    
    // Start with simple fallback motion
    motionCode = fallbackMotion;
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
      const response = await fetch('/api/motion-project', {
        method: 'PUT',
        headers: { 'content-type': 'text/plain;charset=utf-8' },
        body: motionCode,
      });
      if (!response.ok) throw new Error(`Could not save ${currentFile} (${response.status})`);
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
    if (!fileHandle) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const handle = fileHandle;
      if (!handle) return;
      writeQueue = writeQueue.then(() => writeFile(handle, source)).catch(console.error);
    }, 250);
  }

  async function writeFile(handle: MotionFileHandle, source: string) {
    const writable = await handle.createWritable();
    await writable.write(source);
    await writable.close();
  }

  async function handleExport() {
    if (!editor || isExporting) return;
    isExporting = true;
    exportProgress = 0;
    try {
      const filename = currentFile.replace(/\.motion$/i, '') || 'motionly';
      await editor.exportMp4(`${filename}.mp4`, (progress) => (exportProgress = progress));
    } finally {
      isExporting = false;
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
        href="https://www.producthunt.com/products/motionly?embed=true&amp;utm_source=badge-featured&amp;utm_medium=badge&amp;utm_campaign=badge-motionly"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="View Motionly on Product Hunt"
      >
        <img
          alt="Motionly - Motionly is an AI-native motion graphics editor. | Product Hunt"
          width="250"
          height="54"
          src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1197499&amp;theme=dark&amp;t=1784188075155"
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
      <button on:click={handleExport} class="btn export-action" disabled={isExporting} title="Export MP4">
        <Download size={18} />
        <span class="action-label">{isExporting ? `Exporting ${Math.round(exportProgress * 100)}%` : 'Export MP4'}</span>
      </button>
      <a class="btn welcome-btn" href={`${appUrl()}?welcome=1`} title="View welcome guide" aria-label="View welcome guide">
        <CircleHelp size={18} />
      </a>
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
  <MotionEditor bind:this={editor} bind:code={motionCode} onSave={handleSave} />
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

  .welcome-btn {
    width: 36px;
    justify-content: center;
    padding: 0;
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
  .product-hunt-badge { opacity: .48; filter: grayscale(1); transition: opacity .16s ease; }
  .product-hunt-badge:hover { opacity: .78; }


  /* Subtly illuminated buttons with the Motionly logo palette. */
  .btn {
    border-color: rgba(255,255,255,.1);
    background: linear-gradient(180deg, #242428 0%, #19191c 100%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.075), 0 1px 2px rgba(0,0,0,.3);
    font-weight: 520;
  }
  .btn:hover {
    border-color: rgba(255,255,255,.16);
    background: linear-gradient(180deg, #2d2d32 0%, #202024 100%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.1), 0 1px 2px rgba(0,0,0,.35);
  }
  .btn:active {
    background: #171719;
    box-shadow: inset 0 1px 2px rgba(0,0,0,.5);
    transform: translateY(1px);
  }
  .btn-primary,
  .btn-primary:hover {
    border-color: rgba(255,255,255,.16);
    background: linear-gradient(135deg, #5f8fe8 0%, #4eb392 100%);
    color: #fff;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.22), 0 1px 3px rgba(0,0,0,.38);
  }
  .btn-primary:hover { background: linear-gradient(135deg, #6d9bf0, #59bd9c); }

</style>
