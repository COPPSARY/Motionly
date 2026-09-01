<script lang="ts">
  import { onMount } from "svelte";
  import { currentMotionlyUser, motionlyLoginUrl } from "../auth";
  import type { MotionlyUser } from "../auth";
  import {
    ArrowLeft,
    Bot,
    Braces,
    Download,
    Eye,
    EyeOff,
    FileText,
    FolderOpen,
    Headphones,
    Image as ImageIcon,
    Layers3,
    Maximize2,
    Pause,
    Play,
    RefreshCcw,
    Save,
    Send,
    Settings,
    SlidersHorizontal,
    Sparkles,
    Type,
    Upload,
    Wand2,
    X,
  } from "lucide-svelte";
  import {
    downloadBlob,
    exportPng,
    exportVideo,
  } from "../composition/exporter";
  import { CompositionRuntime } from "../composition/runtime";
  import type { ElementOverride, RuntimeSnapshot } from "../composition/types";
  import { motionlyPromoPreset as demoComposition } from "../compositions/presets";
  import {
    deriveSceneTracks,
    formatTimelineSeconds,
    type SceneTrack,
  } from "./timeline-data";
  import AnimationControls from "./AnimationControls.svelte";
  import "./styles/editor-shell.css";
  import "./styles/navigation-rail.css";
  import "./styles/content-panel.css";
  import "./styles/preview-stage.css";
  import "./styles/properties-inspector.css";
  import "./styles/storyboard-strip.css";
  import "./styles/timeline-panel.css";
  import "./styles/editor-theme.css";

  type EditorTab =
    "media" | "audio" | "text" | "effects" | "scenes" | "ai" | "settings";

  type TimelineMode = "project" | "scene";

  interface AssistantMessage {
    role: "user" | "assistant";
    text: string;
  }

  const textElementTags = new Set([
    "B",
    "BUTTON",
    "DIV",
    "EM",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "P",
    "SMALL",
    "SPAN",
    "STRONG",
  ]);

  let previewRoot: HTMLDivElement;
  let previewStage: HTMLDivElement;
  let fileInput: HTMLInputElement;
  let runtime: CompositionRuntime | null = null;
  let snapshot: RuntimeSnapshot = { time: 0, playing: false, sceneId: "brand" };
  let selectedSceneId = "brand";
  let selectedId = "";
  let zoom = 1;
  let fitScale = 0.5;
  let activeTab: EditorTab = "media";
  let mediaTab: "assets" | "presets" = "presets";
  let exporting = false;
  let notice = "";
  let chatOpen = false;
  let assistantDraft = "";
  let assistantMessages: AssistantMessage[] = [];
  let editorRevision = 0;
  let animationSpeed = 1;
  let animationEase = "power3.inOut";
  let currentUser: MotionlyUser | null = null;
  let authChecked = false;
  let timelineMode: TimelineMode = "project";
  let sourceOpen = false;

  interface SelectionRect {
    visible: boolean;
    left: number;
    top: number;
    width: number;
    height: number;
  }

  let selectionRect: SelectionRect = {
    visible: false,
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  };

  onMount(() => {
    void currentMotionlyUser().then((user) => {
      currentUser = user;
      authChecked = true;
    });
    runtime = new CompositionRuntime(demoComposition, previewRoot);
    const unsubscribe = runtime.subscribe((value) => {
      snapshot = value;
      selectedSceneId = value.sceneId;
      updateSelectionRect();
    });
    const observer = new ResizeObserver(() => {
      fitPreview();
      updateSelectionRect();
    });
    observer.observe(previewStage);
    fitPreview();
    updateSelectionRect();
    return () => {
      unsubscribe();
      observer.disconnect();
      runtime?.destroy();
    };
  });

  function fitPreview(): void {
    if (!previewStage) return;
    const width = Math.max(1, previewStage.clientWidth - 72);
    const height = Math.max(1, previewStage.clientHeight - 72);
    fitScale = Math.min(
      width / demoComposition.width,
      height / demoComposition.height,
    );
    zoom = 1;
  }

  function updateSelectionRect(): void {
    if (!runtime || !selectedId || !previewRoot) {
      selectionRect = { visible: false, left: 0, top: 0, width: 0, height: 0 };
      return;
    }
    const element = runtime.elements.get(selectedId);
    if (!element) {
      selectionRect = { visible: false, left: 0, top: 0, width: 0, height: 0 };
      return;
    }
    const style = getComputedStyle(element);
    if (
      style.visibility === "hidden" ||
      style.display === "none" ||
      Number(style.opacity) <= 0.01
    ) {
      selectionRect = { visible: false, left: 0, top: 0, width: 0, height: 0 };
      return;
    }
    const rootRect = previewRoot.getBoundingClientRect();
    const elRect = element.getBoundingClientRect();
    const scale = rootRect.width / demoComposition.width;
    if (scale <= 0 || elRect.width <= 0 || elRect.height <= 0) {
      selectionRect = { visible: false, left: 0, top: 0, width: 0, height: 0 };
      return;
    }
    selectionRect = {
      visible: true,
      left: (elRect.left - rootRect.left) / scale,
      top: (elRect.top - rootRect.top) / scale,
      width: elRect.width / scale,
      height: elRect.height / scale,
    };
  }

  function togglePlayback(): void {
    if (!runtime) return;
    snapshot.playing ? runtime.pause() : runtime.play();
  }

  function selectFromPreview(event: MouseEvent): void {
    const directTarget = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-motionly-id]",
    );
    const pointTargets = runtime
      ? [...runtime.elements.entries()]
          .filter(([, element]) => {
            const bounds = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return (
              bounds.width > 0 &&
              bounds.height > 0 &&
              event.clientX >= bounds.left &&
              event.clientX <= bounds.right &&
              event.clientY >= bounds.top &&
              event.clientY <= bounds.bottom &&
              style.visibility !== "hidden" &&
              style.display !== "none" &&
              Number(style.opacity) > 0.02
            );
          })
          .sort(([, first], [, second]) => {
            const firstBounds = first.getBoundingClientRect();
            const secondBounds = second.getBoundingClientRect();
            return (
              firstBounds.width * firstBounds.height -
              secondBounds.width * secondBounds.height
            );
          })
      : [];
    const hitId =
      pointTargets[0]?.[0] ?? directTarget?.dataset["motionlyId"] ?? "";
    if (!hitId) {
      selectedId = "";
      updateSelectionRect();
      return;
    }
    timelineMode = "scene";
    selectedSceneId = snapshot.sceneId;
    selectedId = hitId;
    syncAnimationControls();
    updateSelectionRect();
  }

  function handlePreviewKey(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      selectedId = "";
      updateSelectionRect();
    }
  }

  function seek(event: Event): void {
    runtime?.seek(Number((event.currentTarget as HTMLInputElement).value));
    updateSelectionRect();
  }

  function selectedScene() {
    return (
      demoComposition.scenes.find((scene) => scene.id === selectedSceneId) ??
      demoComposition.scenes[0]
    );
  }

  function visibleSceneTracks(): readonly SceneTrack[] {
    const scene = selectedScene();
    if (!scene) return [];
    return deriveSceneTracks(scene, runtime?.elements);
  }

  function timelineStart(): number {
    return timelineMode === "project" ? 0 : (selectedScene()?.start ?? 0);
  }

  function timelineDuration(): number {
    return timelineMode === "project"
      ? demoComposition.duration
      : (selectedScene()?.duration ?? demoComposition.duration);
  }

  function timelinePlayheadPosition(): number {
    const start = timelineStart();
    const duration = timelineDuration();
    return Math.max(
      0,
      Math.min(100, ((snapshot.time - start) / duration) * 100),
    );
  }

  function timelineTicks(): number[] {
    const duration = timelineDuration();
    const step = timelineMode === "project" ? 5 : duration > 6 ? 2 : 1;
    const values = Array.from(
      { length: Math.floor(duration / step) + 1 },
      (_, index) => index * step,
    );
    if (values.at(-1) !== duration) values.push(duration);
    return values;
  }

  function enterScene(scene: (typeof demoComposition.scenes)[number]): void {
    const arrivalOffset = scene.id === "brand" ? 0.2 : 1.15;
    const visibleFrame = Math.min(
      scene.start + scene.duration - 1 / demoComposition.fps,
      scene.start + arrivalOffset,
    );
    timelineMode = "scene";
    selectedSceneId = scene.id;
    selectedId = "";
    runtime?.seek(visibleFrame);
  }

  function showProjectTimeline(): void {
    timelineMode = "project";
    selectedId = "";
  }

  function trackLeft(track: SceneTrack): number {
    return Math.max(0, (track.start / timelineDuration()) * 100);
  }

  function trackWidth(track: SceneTrack): number {
    return Math.max(
      0.8,
      ((track.end - track.start) / timelineDuration()) * 100,
    );
  }

  function sceneLeft(scene: (typeof demoComposition.scenes)[number]): number {
    return (scene.start / demoComposition.duration) * 100;
  }

  function sceneWidth(scene: (typeof demoComposition.scenes)[number]): number {
    return (scene.duration / demoComposition.duration) * 100;
  }

  function selectTrack(track: SceneTrack): void {
    const scene = selectedScene();
    if (!runtime || !scene || !runtime.elements.has(track.id)) {
      showNotice(
        `The ${track.label} layer is not registered in this composition.`,
      );
      return;
    }
    const localTime = snapshot.time - scene.start;
    if (localTime < track.start || localTime >= track.end) {
      const previewOffset = Math.min(
        0.15,
        Math.max(0, (track.end - track.start) / 3),
      );
      runtime.seek(
        scene.start +
          Math.min(
            track.end - 1 / demoComposition.fps,
            track.start + previewOffset,
          ),
      );
    }
    selectedId = track.id;
    syncAnimationControls();
    updateSelectionRect();
  }

  function syncAnimationControls(): void {
    if (!runtime || !selectedId) {
      animationSpeed = 1;
      animationEase = "power3.inOut";
      return;
    }
    const settings = runtime.getAnimationOverride(selectedId);
    animationSpeed = settings.speed;
    animationEase = settings.ease;
  }

  function selectedTrack(): SceneTrack | undefined {
    if (!selectedId) return undefined;
    return demoComposition.scenes
      .flatMap((scene) => scene.tracks ?? [])
      .find((track) => track.id === selectedId);
  }

  function currentOverride(): ElementOverride {
    void editorRevision;
    return selectedId && runtime ? runtime.getOverride(selectedId) : {};
  }

  function isTextEditable(): boolean {
    if (!runtime || !selectedId) return false;
    const element = runtime.elements.get(selectedId);
    if (!element) return false;
    if (element.dataset["motionlySplitUnit"]) return true;
    return (
      element.children.length === 0 && textElementTags.has(element.tagName)
    );
  }

  function editableTextValue(): string {
    if (!runtime || !selectedId) return "";
    const override = currentOverride().text;
    if (override !== undefined) return override;
    return (runtime.elements.get(selectedId)?.textContent ?? "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isSvgSelected(): boolean {
    if (!runtime || !selectedId) return false;
    return runtime.elements.get(selectedId) instanceof SVGElement;
  }

  type ColorProperty = "color" | "backgroundColor" | "fill" | "stroke";

  function normalizedColor(value: string, fallback: string): string {
    const hex = /^#([\da-f]{6})$/i.exec(value.trim());
    if (hex) return `#${hex[1]}`;
    const rgb = /^rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)(?:\D+([\d.]+))?\s*\)$/i.exec(
      value,
    );
    if (!rgb || (rgb[4] !== undefined && Number(rgb[4]) === 0)) return fallback;
    return `#${[rgb[1], rgb[2], rgb[3]]
      .map((channel) => Number(channel).toString(16).padStart(2, "0"))
      .join("")}`;
  }

  function colorValue(property: ColorProperty, fallback: string): string {
    const override = currentOverride()[property];
    if (typeof override === "string")
      return normalizedColor(override, fallback);
    const element = selectedId ? runtime?.elements.get(selectedId) : undefined;
    if (!element) return fallback;
    const style = getComputedStyle(element);
    return normalizedColor(style[property], fallback);
  }

  function isBackgroundTransparent(): boolean {
    if (!runtime || !selectedId) return true;
    const override = currentOverride().backgroundColor;
    if (override === "transparent") return true;
    if (typeof override === "string" && override.trim()) {
      return (
        override.trim() === "transparent" ||
        override.trim() === "rgba(0, 0, 0, 0)"
      );
    }
    const element = runtime.elements.get(selectedId);
    if (!element) return true;
    const bg = getComputedStyle(element).backgroundColor;
    if (!bg || bg === "transparent") return true;
    const rgb = /^rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)(?:\D+([\d.]+))?\s*\)$/i.exec(
      bg,
    );
    return rgb !== null && rgb[4] !== undefined && Number(rgb[4]) === 0;
  }

  function effectiveBackgroundColorHex(): string {
    const override = currentOverride().backgroundColor;
    if (override && override !== "transparent") {
      return normalizedColor(override, "#17191c");
    }
    const element = selectedId ? runtime?.elements.get(selectedId) : undefined;
    if (!element) return "#17191c";
    const bg = getComputedStyle(element).backgroundColor;
    return normalizedColor(bg, "#17191c");
  }

  function numericStyleValue(
    property: "fontSize" | "borderRadius",
    fallback: number,
  ): number {
    const override = currentOverride()[property];
    if (typeof override === "number") return override;
    const element = selectedId ? runtime?.elements.get(selectedId) : undefined;
    if (!element) return fallback;
    const parsed = Number.parseFloat(getComputedStyle(element)[property]);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function setNumber(property: keyof ElementOverride, event: Event): void {
    if (!runtime || !selectedId) return;
    runtime.setOverride(selectedId, {
      [property]: Number((event.currentTarget as HTMLInputElement).value),
    });
    editorRevision += 1;
    updateSelectionRect();
  }

  function setText(event: Event): void {
    if (!runtime || !selectedId) return;
    runtime.setOverride(selectedId, {
      text: (event.currentTarget as HTMLInputElement).value,
    });
    editorRevision += 1;
    updateSelectionRect();
  }

  function setColor(property: ColorProperty, event: Event): void {
    if (!runtime || !selectedId) return;
    runtime.setOverride(selectedId, {
      [property]: (event.currentTarget as HTMLInputElement).value,
    });
    editorRevision += 1;
    updateSelectionRect();
  }

  function clearBackground(): void {
    if (!runtime || !selectedId) return;
    runtime.setOverride(selectedId, { backgroundColor: "transparent" });
    editorRevision += 1;
    updateSelectionRect();
  }

  function toggleSelectedLayer(): void {
    if (!runtime || !selectedId) return;
    runtime.setOverride(selectedId, {
      hidden: !currentOverride().hidden,
    });
    editorRevision += 1;
    updateSelectionRect();
  }

  function animationSettings() {
    return selectedId && runtime
      ? runtime.getAnimationOverride(selectedId)
      : { speed: 1, ease: "power3.inOut", tweenCount: 0 };
  }

  function setAnimationSpeed(speed: number): void {
    if (!runtime || !selectedId) return;
    animationSpeed = speed;
    runtime.setAnimationOverride(selectedId, {
      speed: animationSpeed,
    });
  }

  function setAnimationEase(ease: string): void {
    if (!runtime || !selectedId) return;
    animationEase = ease;
    runtime.setAnimationOverride(selectedId, { ease });
  }

  function timecode(time: number): string {
    const minutes = Math.floor(time / 60);
    const seconds = time - minutes * 60;
    return `${minutes}:${seconds.toFixed(1).padStart(4, "0")}`;
  }

  function selectTab(tab: EditorTab): void {
    sourceOpen = false;
    activeTab = tab;
    if (tab === "media") mediaTab = "assets";
    if (tab === "effects") mediaTab = "presets";
    if (tab === "ai") chatOpen = true;
  }

  function openTimelineSource(): void {
    sourceOpen = true;
    activeTab = "text";
    showNotice("Opened the HTML source for the active GSAP composition.");
  }

  function submitAssistant(event: SubmitEvent): void {
    event.preventDefault();
    const prompt = assistantDraft.trim();
    if (!prompt) return;
    assistantMessages = [
      ...assistantMessages,
      { role: "user", text: prompt },
      {
        role: "assistant",
        text: "Request captured. Connect a web AI provider to turn it into source edits; generated changes must target semantic HTML/SVG, CSS, and the caller-owned GSAP timeline.",
      },
    ];
    assistantDraft = "";
  }

  function saveSource(): void {
    downloadBlob(
      new Blob([demoComposition.sourcePreview], { type: "text/html" }),
      "motionly-product-promo.html",
    );
    showNotice("Saved the HTML composition source.");
  }

  function handleOpenFile(event: Event): void {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (file)
      showNotice(
        `${file.name} selected. Add it to src/compositions/presets to preview it.`,
      );
    fileInput.value = "";
  }

  let exportStatus = "";

  async function exportFullVideo(): Promise<void> {
    if (!runtime || exporting) return;
    exporting = true;
    exportStatus = "Initializing video export...";
    showNotice("Rendering full video export (1080p)...", 20000);
    try {
      const blob = await exportVideo(
        runtime,
        (_progress, statusText) => {
          exportStatus = statusText;
        },
        demoComposition.fps,
      );
      downloadBlob(blob, `motionly-launch-ad-${demoComposition.fps}fps.mp4`);
      showNotice("Video export successful! Download started.");
    } catch (error) {
      console.error("Video export failed:", error);
      showNotice(
        error instanceof Error ? error.message : "Video export failed.",
      );
    } finally {
      exporting = false;
      exportStatus = "";
    }
  }

  async function exportFrame(): Promise<void> {
    if (!runtime || exporting) return;
    exporting = true;
    showNotice("Rendering current frame snapshot…", 6000);
    try {
      const blob = await exportPng(runtime, 1);
      downloadBlob(
        blob,
        `motionly-${Math.round(snapshot.time * demoComposition.fps)}.png`,
      );
      showNotice("Frame PNG saved.");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Export failed.");
    } finally {
      exporting = false;
    }
  }

  function showNotice(message: string, duration = 3200): void {
    notice = message;
    window.setTimeout(() => {
      if (notice === message) notice = "";
    }, duration);
  }
</script>

<div class="app">
  <header class="top-bar">
    <div class="brand">
      <span class="logo-shell"
        ><img src="/logo.svg" alt="Motionly" class="logo" /></span
      >
      <h1>Motionly</h1>
    </div>
    <div class="file-info">
      <FileText size={16} /><span>product-demo.ts</span>
    </div>
    <div class="actions">
      {#if authChecked}
        {#if currentUser}
          <span class="account-status" title={currentUser.email}>
            <span class="account-status__dot" aria-hidden="true"></span>
            <span>{currentUser.displayName || currentUser.email}</span>
          </span>
        {:else}
          <a
            class="account-status account-status--signed-out"
            href={motionlyLoginUrl()}
          >
            <span class="account-status__dot" aria-hidden="true"></span>
            <span>Not signed in</span>
          </a>
        {/if}
      {/if}
      <input
        bind:this={fileInput}
        class="file-input"
        type="file"
        accept=".ts,.tsx,text/typescript"
        on:change={handleOpenFile}
      />
      <button class="btn" on:click={() => fileInput.click()}
        ><FolderOpen size={17} /><span>Open</span></button
      >
      <button class="btn btn-primary" on:click={saveSource}
        ><Save size={17} /><span>Save</span></button
      >
      <button
        class="btn"
        title="Export Current Frame as PNG"
        on:click={exportFrame}
        disabled={exporting}
      >
        <ImageIcon size={16} /><span>PNG</span>
      </button>
      <button
        class="btn export-action"
        title="Render and Download 1080p Full Video"
        on:click={exportFullVideo}
        disabled={exporting}
      >
        <Download size={17} /><span
          >{exporting ? exportStatus || "Rendering…" : "Export Video"}</span
        >
      </button>
    </div>
  </header>

  <div class="code-editor-scope">
    <div class="me-motion-editor" style="--timeline-height: 218px;">
      <div class="me-workbench" class:me-chat-open={chatOpen}>
        <nav class="me-nav-rail" aria-label="Editor tools">
          <button
            class="me-nav-item"
            class:me-active={activeTab === "media"}
            data-tooltip="Media"
            on:click={() => selectTab("media")}><FolderOpen size={20} /></button
          >
          <button
            class="me-nav-item"
            class:me-active={activeTab === "audio"}
            data-tooltip="Audio"
            on:click={() => selectTab("audio")}><Headphones size={20} /></button
          >
          <button
            class="me-nav-item"
            class:me-active={activeTab === "text"}
            data-tooltip="Text"
            on:click={() => selectTab("text")}><Type size={20} /></button
          >
          <button
            class="me-nav-item"
            class:me-active={activeTab === "effects"}
            data-tooltip="Effects"
            on:click={() => selectTab("effects")}><Wand2 size={20} /></button
          >
          <button
            class="me-nav-item"
            class:me-active={activeTab === "scenes"}
            data-tooltip="Scenes"
            on:click={() => selectTab("scenes")}><Layers3 size={20} /></button
          >
          <button
            class="me-nav-item"
            class:me-active={activeTab === "ai"}
            data-tooltip="AI"
            on:click={() => selectTab("ai")}><Bot size={20} /></button
          >
          <button
            class="me-nav-item me-nav-settings"
            class:me-active={activeTab === "settings"}
            data-tooltip="Settings"
            on:click={() => selectTab("settings")}
            ><Settings size={20} /></button
          >
        </nav>

        <aside class="me-content-panel">
          <div class="me-panel-header">
            {#if sourceOpen}
              <div class="me-panel-title"><Braces size={15} /> Source</div>
              <button
                class="me-header-icon-btn"
                aria-label="Close composition source"
                on:click={() => (sourceOpen = false)}><X size={15} /></button
              >
            {:else if activeTab === "media"}
              <div class="me-panel-tabs">
                <button
                  class="me-panel-tab"
                  class:me-active={mediaTab === "assets"}
                  on:click={() => (mediaTab = "assets")}>Assets</button
                >
                <button
                  class="me-panel-tab"
                  class:me-active={mediaTab === "presets"}
                  on:click={() => (mediaTab = "presets")}>Presets</button
                >
              </div>
              <button
                class="me-import-header-btn"
                on:click={() => fileInput.click()}
                ><Upload size={14} /> Import</button
              >
            {:else}
              <div class="me-panel-title">
                {#if activeTab === "text"}<Type size={15} /> Text{:else if activeTab === "effects"}<Wand2
                    size={15}
                  /> Motion{:else if activeTab === "scenes"}<Layers3
                    size={15}
                  /> Scenes{:else if activeTab === "audio"}<Headphones
                    size={15}
                  /> Audio{:else if activeTab === "settings"}<Settings
                    size={15}
                  /> Settings{:else}<Bot size={15} /> Assistant{/if}
              </div>
              {#if activeTab === "text"}
                <button
                  class="me-header-icon-btn"
                  aria-label="Open composition HTML source"
                  title="Open composition HTML source"
                  on:click={openTimelineSource}><Braces size={15} /></button
                >
              {/if}
            {/if}
          </div>
          <div class="me-panel-content">
            {#if sourceOpen}
              <h3 class="me-category-title">Composition source</h3>
              <div class="source-heading">
                <Braces size={15} /> presets/motionly-promo/composition.html
              </div>
              <pre class="source-code">{demoComposition.sourcePreview}</pre>
            {:else if activeTab === "text"}
              <h3 class="me-category-title">Text in this scene</h3>
              <p class="me-category-hint">
                Select a text layer to edit it. Its timeline bar shows only when
                it is actually visible.
              </p>
              <div class="me-layer-list">
                {#each visibleSceneTracks().filter((track) => track.kind === "Text") as track}
                  <button
                    class="me-layer-row"
                    class:me-selected={selectedId === track.id}
                    on:click={() => selectTrack(track)}
                  >
                    <span class="me-layer-icon"><Type size={14} /></span>
                    <span class="me-layer-copy"
                      ><strong>{track.label}</strong><small
                        >{formatTimelineSeconds(track.end - track.start)} visible</small
                      ></span
                    >
                  </button>
                {/each}
              </div>
            {:else if activeTab === "scenes"}
              <h3 class="me-category-title">Scenes</h3>
              <div class="me-layer-list">
                {#each demoComposition.scenes as scene}
                  <button
                    class="me-layer-row"
                    class:me-selected={selectedSceneId === scene.id}
                    on:click={() => enterScene(scene)}
                  >
                    <span class="me-layer-icon"><Layers3 size={14} /></span>
                    <span class="me-layer-copy"
                      ><strong>{scene.label}</strong><small
                        >{formatTimelineSeconds(scene.duration)}</small
                      ></span
                    >
                  </button>
                {/each}
              </div>
            {:else if activeTab === "effects"}
              <h3 class="me-category-title">Text animation</h3>
              <p class="me-category-hint">
                Motion presets write directly into the caller-owned GSAP
                timeline.
              </p>
              <div class="me-effects-list">
                <button
                  class="me-effect-item"
                  on:click={() =>
                    showNotice("Word reveal is used in the active promo.")}
                  ><Sparkles size={14} /> Word reveal · power4.out</button
                >
                <button
                  class="me-effect-item"
                  on:click={() =>
                    showNotice("Character cascade is used in the CTA.")}
                  ><Type size={14} /> Character cascade</button
                >
                <button
                  class="me-effect-item"
                  on:click={() =>
                    showNotice("Directional handoffs overlap adjacent scenes.")}
                  ><Layers3 size={14} /> Scene handoff</button
                >
              </div>
            {:else if activeTab === "media" && mediaTab === "presets"}
              <h3 class="me-category-title">Promo video</h3>
              <div class="me-preset-grid">
                <button
                  class="me-preset-card"
                  on:click={() => runtime?.restart()}
                >
                  <span class="me-preset-thumbnail promo-thumbnail">
                    <span class="promo-thumbnail-art"
                      ><small>WRITE / DIRECT / EXPORT</small><strong
                        >MAKE IT<br /><em>MOVE.</em></strong
                      ><i>HTML · CSS · GSAP</i></span
                    >
                  </span>
                  <span class="me-preset-info"
                    ><strong class="me-preset-name">Fast Product Story</strong
                    ><small>20s · HTML/CSS + GSAP</small></span
                  >
                </button>
              </div>
              <p class="panel-copy">
                Fast kinetic type, native product UI, overlapping handoffs, and
                one directed GSAP timeline. No generated media.
              </p>
            {:else if activeTab === "media"}
              <h3 class="me-category-title">Project assets</h3>
              <div class="me-asset-grid project-asset-grid">
                <div class="me-asset-card-wrap">
                  <button
                    class="me-asset-card"
                    on:click={() => (selectedId = "brand-token")}
                  >
                    <span class="me-asset-thumbnail project-asset-thumbnail"
                      ><img src="/logo.svg" alt="Motionly logo" /></span
                    >
                    <span class="me-asset-info"
                      ><strong class="me-asset-name">logo.svg</strong><small
                        >SVG · selectable</small
                      ></span
                    >
                  </button>
                </div>
                <div class="me-asset-card-wrap">
                  <button
                    class="me-asset-card"
                    on:click={() =>
                      showNotice("github.svg is ready in public/.")}
                  >
                    <span class="me-asset-thumbnail project-asset-thumbnail"
                      ><img src="/github.svg" alt="GitHub logo" /></span
                    >
                    <span class="me-asset-info"
                      ><strong class="me-asset-name">github.svg</strong><small
                        >SVG · public</small
                      ></span
                    >
                  </button>
                </div>
              </div>
              <div class="project-import-card">
                <ImageIcon size={22} />
                <div><strong>Add media</strong><span>Images and SVG</span></div>
                <button
                  class="me-import-media-button"
                  on:click={() => fileInput.click()}>Import</button
                >
              </div>
            {:else}
              <div class="me-properties-empty compact-panel-empty">
                <Sparkles size={26} /><strong
                  >{activeTab === "audio"
                    ? "No audio yet"
                    : "Editor settings"}</strong
                ><span
                  >{activeTab === "audio"
                    ? "Import an audio file to add a waveform track."
                    : "The demo uses project defaults for preview and export."}</span
                >
              </div>
            {/if}
          </div>
        </aside>

        <aside class="me-chat-drawer" class:me-collapsed={!chatOpen}>
          {#if chatOpen}
            <section class="ai-chat-panel" aria-label="Motionly Assistant">
              <header class="ai-chat-header">
                <span
                  ><Sparkles size={15} /><strong>Motionly Assistant</strong
                  ></span
                >
                <button
                  class="ai-chat-close"
                  aria-label="Close assistant"
                  on:click={() => (chatOpen = false)}><X size={15} /></button
                >
              </header>
              <div class="ai-chat-messages" aria-live="polite">
                <div class="ai-chat-message assistant">
                  Describe a scene, transition, camera move, or timing change.
                  I’ll keep the composition code-first and GSAP-driven.
                </div>
                {#each assistantMessages as message}
                  <div
                    class:assistant={message.role === "assistant"}
                    class:user={message.role === "user"}
                    class="ai-chat-message"
                  >
                    {message.text}
                  </div>
                {/each}
              </div>
              <form class="ai-chat-composer" on:submit={submitAssistant}>
                <textarea
                  aria-label="Assistant prompt"
                  placeholder="Make the CTA transition feel more cinematic…"
                  bind:value={assistantDraft}
                ></textarea>
                <button
                  aria-label="Send assistant message"
                  disabled={!assistantDraft.trim()}
                  type="submit"><Send size={15} /></button
                >
              </form>
            </section>
          {:else}
            <button
              class="me-assistant-expand"
              aria-label="Open assistant"
              title="Motionly Assistant"
              on:click={() => (chatOpen = true)}><Sparkles size={16} /></button
            >
          {/if}
        </aside>

        <main class="me-preview-container">
          <div class="me-stage-meta">
            <span>{demoComposition.width} x {demoComposition.height}</span>
            <div class="me-stage-actions">
              <button class="me-meta-btn" on:click={fitPreview}>Fit</button>
              <span>{Math.round(fitScale * zoom * 100)}%</span>
              <button
                class="me-icon-btn"
                on:click={() => (zoom = Math.min(1.7, zoom + 0.15))}
                aria-label="Zoom in"><Maximize2 size={15} /></button
              >
            </div>
          </div>
          <!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_no_noninteractive_tabindex -->
          <div
            class="me-stage"
            bind:this={previewStage}
            role="application"
            aria-label="Composition preview"
            tabindex="0"
            on:click={selectFromPreview}
            on:keydown={handlePreviewKey}
          >
            <div
              class="me-canvas-shell"
              style:width={`${demoComposition.width}px`}
              style:height={`${demoComposition.height}px`}
              style:transform={`scale(${fitScale * zoom})`}
            >
              <div
                class="composition-canvas"
                style:width={`${demoComposition.width}px`}
                style:height={`${demoComposition.height}px`}
                bind:this={previewRoot}
              ></div>
              {#if selectionRect.visible && selectedId}
                <div
                  class="me-selection-overlay"
                  style:left={`${selectionRect.left}px`}
                  style:top={`${selectionRect.top}px`}
                  style:width={`${selectionRect.width}px`}
                  style:height={`${selectionRect.height}px`}
                >
                  <div class="me-selection-outline"></div>
                  <div class="me-selection-handle handle-tl"></div>
                  <div class="me-selection-handle handle-tr"></div>
                  <div class="me-selection-handle handle-bl"></div>
                  <div class="me-selection-handle handle-br"></div>
                  <div class="me-selection-badge">
                    <span class="badge-label"
                      >{selectedTrack()?.label ?? selectedId}</span
                    >
                    <span class="badge-dims"
                      >{Math.round(selectionRect.width)} × {Math.round(
                        selectionRect.height,
                      )}</span
                    >
                  </div>
                </div>
              {/if}
            </div>
          </div>
        </main>

        <aside class="me-properties-panel">
          <h2 class="me-panel-title">
            <SlidersHorizontal size={15} /> Properties
          </h2>
          {#if selectedId}
            <div class="me-selection-summary">
              <span class="me-layer-icon"><Sparkles size={14} /></span>
              <span
                ><strong>{selectedTrack()?.label ?? selectedId}</strong><small
                  >{selectedId} · editable layer</small
                ></span
              >
            </div>
            <div class="me-primary-properties">
              {#if isTextEditable()}
                <div class="me-property-group">
                  <label class="me-property-label" for="property-text"
                    >Text</label
                  >
                  <input
                    id="property-text"
                    class="me-text-input"
                    type="text"
                    value={editableTextValue()}
                    on:input={setText}
                  />
                </div>
                <div class="me-property-group">
                  <label class="me-property-label" for="property-font-size"
                    >Font size</label
                  >
                  <div class="me-number-input-wrapper">
                    <input
                      id="property-font-size"
                      class="me-number-input"
                      aria-label="Font size"
                      type="number"
                      min="1"
                      value={numericStyleValue("fontSize", 16)}
                      on:input={(event) => setNumber("fontSize", event)}
                    />
                    <span class="me-input-suffix">px</span>
                  </div>
                </div>
              {/if}
              <div class="me-property-row">
                <label class="me-property-group"
                  ><span class="me-property-label">X</span><input
                    class="me-number-input"
                    aria-label="X position"
                    type="number"
                    value={currentOverride().x ?? 0}
                    on:input={(event) => setNumber("x", event)}
                  /></label
                >
                <label class="me-property-group"
                  ><span class="me-property-label">Y</span><input
                    class="me-number-input"
                    aria-label="Y position"
                    type="number"
                    value={currentOverride().y ?? 0}
                    on:input={(event) => setNumber("y", event)}
                  /></label
                >
              </div>
              <div class="me-property-row">
                <label class="me-property-group"
                  ><span class="me-property-label">Scale</span><input
                    class="me-number-input"
                    aria-label="Scale"
                    type="number"
                    step="0.05"
                    value={currentOverride().scale ?? 1}
                    on:input={(event) => setNumber("scale", event)}
                  /></label
                >
                <label class="me-property-group"
                  ><span class="me-property-label">Rotation</span><input
                    class="me-number-input"
                    aria-label="Rotation"
                    type="number"
                    value={currentOverride().rotation ?? 0}
                    on:input={(event) => setNumber("rotation", event)}
                  /></label
                >
              </div>
              <div class="me-property-group">
                <label class="me-property-label" for="property-opacity"
                  >Opacity</label
                >
                <input
                  id="property-opacity"
                  class="me-custom-slider"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={currentOverride().opacity ?? 1}
                  on:input={(event) => setNumber("opacity", event)}
                />
              </div>
              {#if animationSettings().tweenCount > 0}
                <AnimationControls
                  speed={animationSpeed}
                  ease={animationEase}
                  tweenCount={animationSettings().tweenCount}
                  onSpeed={setAnimationSpeed}
                  onEase={setAnimationEase}
                />
              {/if}
              <div class="me-section-title me-appearance-title">Appearance</div>
              {#if isSvgSelected()}
                <label class="me-property-group">
                  <span class="me-property-label">Stroke color</span>
                  <span class="me-color-control">
                    <input
                      class="me-color-swatch"
                      aria-label="Stroke color"
                      type="color"
                      value={colorValue("stroke", "#5eead4")}
                      on:input={(event) => setColor("stroke", event)}
                    />
                    <output>{colorValue("stroke", "#5eead4")}</output>
                  </span>
                </label>
              {:else}
                <label class="me-property-group">
                  <span class="me-property-label"
                    >{isTextEditable()
                      ? "Text color"
                      : "Foreground color"}</span
                  >
                  <span class="me-color-control">
                    <input
                      class="me-color-swatch"
                      aria-label={isTextEditable()
                        ? "Text color"
                        : "Foreground color"}
                      type="color"
                      value={colorValue("color", "#111318")}
                      on:input={(event) => setColor("color", event)}
                    />
                    <output>{colorValue("color", "#111318")}</output>
                  </span>
                </label>
                <div class="me-property-group">
                  <div class="me-property-label-row">
                    <span class="me-property-label">Background</span>
                    {#if isBackgroundTransparent()}
                      <span class="me-property-pill-transparent"
                        >Transparent</span
                      >
                    {:else}
                      <button
                        class="me-property-action"
                        type="button"
                        on:click={clearBackground}>Clear</button
                      >
                    {/if}
                  </div>
                  <div
                    class="me-color-control"
                    class:me-transparent-bg={isBackgroundTransparent()}
                  >
                    <input
                      class="me-color-swatch"
                      aria-label="Background color"
                      type="color"
                      value={effectiveBackgroundColorHex()}
                      on:input={(event) => setColor("backgroundColor", event)}
                    />
                    <output
                      >{isBackgroundTransparent()
                        ? "transparent"
                        : colorValue("backgroundColor", "#17191c")}</output
                    >
                  </div>
                </div>
                <div class="me-property-group">
                  <label class="me-property-label" for="property-radius"
                    >Corner radius</label
                  >
                  <div class="me-number-input-wrapper">
                    <input
                      id="property-radius"
                      class="me-number-input"
                      aria-label="Corner radius"
                      type="number"
                      min="0"
                      value={numericStyleValue("borderRadius", 0)}
                      on:input={(event) => setNumber("borderRadius", event)}
                    />
                    <span class="me-input-suffix">px</span>
                  </div>
                </div>
              {/if}
              <button
                class="me-layer-visibility"
                class:me-restore={currentOverride().hidden}
                type="button"
                on:click={toggleSelectedLayer}
              >
                {#if currentOverride().hidden}<Eye size={14} /> Restore layer{:else}<EyeOff
                    size={14}
                  /> Remove layer{/if}
              </button>
            </div>
          {:else}
            <div class="me-properties-empty">
              <Sparkles size={30} /><strong>Select an element</strong><span
                >Click an editable object in the preview to change its visual
                properties.</span
              >
            </div>
          {/if}
        </aside>
      </div>

      <section class="storyboard-strip" aria-label="Storyboard">
        <div class="storyboard-strip__head">
          {#if timelineMode === "scene"}
            <button
              class="storyboard-strip__back"
              on:click={showProjectTimeline}
              ><ArrowLeft size={13} /> All scenes</button
            >
          {:else}
            <span class="storyboard-strip__title">Storyboard</span>
          {/if}
          <span class="storyboard-strip__meta"
            >{demoComposition.scenes.length} scenes · {formatTimelineSeconds(
              demoComposition.duration,
            )}</span
          >
        </div>
        <ol class="storyboard-strip__scenes">
          {#each demoComposition.scenes as scene}
            <li>
              <button
                class="storyboard-scene"
                aria-current={selectedSceneId === scene.id}
                data-scene-id={scene.id}
                style={`--storyboard-scene-color:${scene.accent}`}
                on:click={() => enterScene(scene)}
              >
                <span class="storyboard-scene__swatch"></span><span
                  class="storyboard-scene__label">{scene.label}</span
                ><span class="storyboard-scene__facts"
                  ><span>{formatTimelineSeconds(scene.duration)}</span><span
                    class="storyboard-scene__members"
                    ><Layers3 size={11} /> Film</span
                  ></span
                >
              </button>
            </li>
          {/each}
        </ol>
        <span class="source-chip">TS</span>
      </section>

      <section
        class="me-timeline-panel"
        style={`--playhead-position:${timelinePlayheadPosition()}%`}
      >
        <button class="me-timeline-resizer" aria-label="Resize timeline"
          ><span></span></button
        >
        <div class="me-timeline-toolbar">
          <div class="me-timeline-context">
            {#if timelineMode === "scene"}
              <button
                class="me-timeline-back"
                on:click={showProjectTimeline}
                aria-label="Back to all scenes"><ArrowLeft size={14} /></button
              >
              <Layers3 size={14} /><span>{selectedScene()?.label}</span>
            {:else}
              <Layers3 size={14} /><span>All scenes</span><small
                >Master timeline</small
              >
            {/if}
          </div>
          <div class="me-playback-controls">
            <button
              class="me-control-btn"
              aria-label="Restart"
              on:click={() => runtime?.restart()}
              ><RefreshCcw size={15} /></button
            >
            <button
              class="me-control-btn me-play-btn"
              aria-label={snapshot.playing ? "Pause" : "Play"}
              on:click={togglePlayback}
              >{#if snapshot.playing}<Pause size={16} />{:else}<Play
                  size={16}
                />{/if}</button
            >
            <span class="me-timecode">{timecode(snapshot.time)}</span><span
              class="me-framecode"
              >F{Math.round(snapshot.time * demoComposition.fps)}</span
            >
          </div>
          <div class="me-timeline-actions"></div>
        </div>
        <div
          class="me-timeline-scroll"
          style="--timeline-content-width: 1100px;"
        >
          <div class="me-ruler-row">
            <div class="me-track-label me-ruler-label">
              {timelineMode === "project" ? "MASTER" : selectedScene()?.label}
            </div>
            <div class="me-ruler">
              {#each timelineTicks() as tick}<span
                  class="me-ruler-tick"
                  style:left={`${(tick / timelineDuration()) * 100}%`}
                  >{formatTimelineSeconds(tick)}</span
                >{/each}
              <span
                class="me-playhead-marker"
                style:left={`${timelinePlayheadPosition()}%`}
              ></span>
              <input
                class="me-timeline-scrubber"
                aria-label="Timeline scrubber"
                type="range"
                min={timelineStart()}
                max={timelineStart() + timelineDuration()}
                step={1 / demoComposition.fps}
                value={snapshot.time}
                on:input={seek}
              />
            </div>
          </div>
          {#if timelineMode === "project"}
            <div class="me-timeline-row project-timeline-row">
              <button class="me-track-label" on:click={showProjectTimeline}
                ><span class="me-track-thumb"><Layers3 size={12} /></span><span
                  class="me-track-copy"
                  ><strong>Scenes</strong><small>Entire composition</small
                  ></span
                ></button
              >
              <div class="me-track-lane project-scene-lane">
                {#each demoComposition.scenes as scene}
                  <button
                    class="me-clip me-project-scene-clip"
                    style:left={`${sceneLeft(scene)}%`}
                    style:width={`${sceneWidth(scene)}%`}
                    style:--scene-accent={scene.accent}
                    on:click={() => enterScene(scene)}
                  >
                    <span class="clip-accent" style:background={scene.accent}
                    ></span>
                    <span class="me-clip-text">{scene.label}</span>
                    <small>{formatTimelineSeconds(scene.duration)}</small>
                  </button>
                {/each}
              </div>
            </div>
            <div class="me-timeline-row project-timeline-row">
              <div class="me-track-label">
                <span class="me-track-thumb"><Sparkles size={12} /></span><span
                  class="me-track-copy"
                  ><strong>Handoffs</strong><small>0.7s overlaps</small></span
                >
              </div>
              <div class="me-track-lane project-scene-lane">
                {#each demoComposition.scenes.slice(1) as scene}
                  <button
                    class="me-project-handoff"
                    aria-label={`Preview handoff into ${scene.label}`}
                    style:left={`${((scene.start - 0.7) / demoComposition.duration) * 100}%`}
                    style:width={`${(0.7 / demoComposition.duration) * 100}%`}
                    on:click={() => runtime?.seek(scene.start - 0.35)}
                    ><span></span></button
                  >
                {/each}
              </div>
            </div>
          {:else}
            {#each visibleSceneTracks() as track}
              <div
                class="me-timeline-row"
                class:me-selected={selectedId === track.id}
                data-track-id={track.id}
              >
                <button
                  class="me-track-label"
                  on:click={() => selectTrack(track)}
                  ><span class="me-track-thumb"><Layers3 size={12} /></span
                  ><span class="me-track-copy"
                    ><strong>{track.label}</strong><small
                      >{track.kind} · {formatTimelineSeconds(
                        track.start,
                      )}–{formatTimelineSeconds(track.end)}</small
                    ></span
                  ></button
                >
                <div class="me-track-lane">
                  <button
                    class="me-clip me-element-clip scene-timeline-clip"
                    class:me-selected-clip={selectedId === track.id}
                    style:left={`${trackLeft(track)}%`}
                    style:width={`${trackWidth(track)}%`}
                    on:click={() => selectTrack(track)}
                    ><span
                      class="clip-accent"
                      style:background={selectedScene()?.accent}
                    ></span><span class="me-clip-text">{track.label}</span
                    ><small class="me-clip-duration"
                      >{formatTimelineSeconds(track.end - track.start)}</small
                    ></button
                  >
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </section>
    </div>
  </div>

  {#if notice}<div class="notice" role="status">{notice}</div>{/if}
</div>
