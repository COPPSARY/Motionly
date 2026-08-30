<script lang="ts">
  import { onMount } from "svelte";
  import {
    Bot,
    Braces,
    Download,
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
  import { downloadBlob, exportPng } from "../composition/exporter";
  import { CompositionRuntime } from "../composition/runtime";
  import type { ElementOverride, RuntimeSnapshot } from "../composition/types";
  import { demoComposition } from "../compositions/demo";
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

  interface SceneTrack {
    id: string;
    label: string;
    kind: "Text" | "Element" | "SVG" | "Camera";
  }

  interface AssistantMessage {
    role: "user" | "assistant";
    text: string;
  }

  const sceneTracks: Record<string, readonly SceneTrack[]> = {
    brand: [
      { id: "brand-index", label: "Scene label", kind: "Text" },
      { id: "manifesto-design", label: "Design", kind: "Text" },
      { id: "manifesto-motion", label: "Motion", kind: "Text" },
      { id: "manifesto-code", label: "In code", kind: "Text" },
      { id: "brand-note", label: "Description", kind: "Text" },
      { id: "brand-orbit", label: "Logo orbit", kind: "Element" },
    ],
    code: [
      { id: "code-index", label: "Scene label", kind: "Text" },
      { id: "code-card", label: "TypeScript card", kind: "Element" },
      { id: "live-card", label: "Live output", kind: "Element" },
      { id: "visual-title", label: "Launch", kind: "Text" },
      { id: "visual-subtitle", label: "With rhythm", kind: "Text" },
      { id: "metric-fps", label: "FPS metric", kind: "Element" },
      { id: "metric-timeline", label: "Timeline metric", kind: "Element" },
      { id: "metric-dom", label: "DOM metric", kind: "Element" },
    ],
    studio: [
      { id: "studio-index", label: "Scene label", kind: "Text" },
      { id: "studio-window", label: "Editor window", kind: "Element" },
      { id: "scene-thumb-1", label: "Manifesto scene", kind: "Element" },
      { id: "scene-thumb-2", label: "Product scene", kind: "Element" },
      { id: "scene-thumb-3", label: "Finish scene", kind: "Element" },
      { id: "artboard-headline", label: "Artboard headline", kind: "Text" },
      { id: "artboard-card", label: "Duration card", kind: "Element" },
      { id: "mini-timeline", label: "Mini timeline", kind: "Element" },
    ],
    lab: [
      { id: "lab-index", label: "Scene label", kind: "Text" },
      { id: "lab-one", label: "One", kind: "Text" },
      { id: "lab-timeline", label: "Timeline", kind: "Text" },
      { id: "signal-path", label: "Motion curve", kind: "SVG" },
      { id: "layer-type", label: "Type layer", kind: "Element" },
      { id: "layer-layout", label: "Layout layer", kind: "Element" },
      { id: "layer-camera", label: "Camera layer", kind: "Camera" },
      { id: "export-dock", label: "Export progress", kind: "Element" },
    ],
    cta: [
      { id: "final-index", label: "Motionly label", kind: "Text" },
      { id: "final-line-one", label: "Make it", kind: "Text" },
      { id: "final-line-two", label: "Move", kind: "Text" },
      { id: "final-subtitle", label: "Product description", kind: "Text" },
      { id: "final-cta-label", label: "CTA label", kind: "Text" },
      { id: "final-product", label: "Product mark", kind: "Element" },
    ],
  };
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
  let timelineDetailsOpen = false;

  onMount(() => {
    runtime = new CompositionRuntime(demoComposition, previewRoot);
    const unsubscribe = runtime.subscribe((value) => {
      snapshot = value;
      selectedSceneId = value.sceneId;
    });
    const observer = new ResizeObserver(fitPreview);
    observer.observe(previewStage);
    fitPreview();
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

  function togglePlayback(): void {
    if (!runtime) return;
    snapshot.playing ? runtime.pause() : runtime.play();
  }

  function selectFromPreview(event: MouseEvent): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-motionly-id]",
    );
    if (target?.dataset["motionlyId"])
      selectedId = target.dataset["motionlyId"];
  }

  function handlePreviewKey(event: KeyboardEvent): void {
    if (event.key === "Escape") selectedId = "";
  }

  function seek(event: Event): void {
    runtime?.seek(Number((event.currentTarget as HTMLInputElement).value));
  }

  function selectedScene() {
    return (
      demoComposition.scenes.find((scene) => scene.id === selectedSceneId) ??
      demoComposition.scenes[0]
    );
  }

  function visibleSceneTracks(): readonly SceneTrack[] {
    return sceneTracks[selectedSceneId] ?? [];
  }

  function scenePlayheadPosition(): number {
    const current = selectedScene();
    if (!current) return 0;
    return Math.max(
      0,
      Math.min(100, ((snapshot.time - current.start) / current.duration) * 100),
    );
  }

  function sceneTicks(): number[] {
    const duration = selectedScene()?.duration ?? 0;
    const step = duration > 6 ? 2 : 1;
    const values = Array.from(
      { length: Math.floor(duration / step) + 1 },
      (_, index) => index * step,
    );
    if (values.at(-1) !== duration) values.push(duration);
    return values;
  }

  function enterScene(scene: (typeof demoComposition.scenes)[number]): void {
    selectedSceneId = scene.id;
    selectedId = "";
    const visibleFrame = Math.min(
      scene.start + scene.duration,
      scene.start + 0.2,
    );
    runtime?.seek(visibleFrame);
  }

  function selectTrack(track: SceneTrack): void {
    selectedId = track.id;
  }

  function currentOverride(): ElementOverride {
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

  function setNumber(property: keyof ElementOverride, event: Event): void {
    if (!runtime || !selectedId) return;
    runtime.setOverride(selectedId, {
      [property]: Number((event.currentTarget as HTMLInputElement).value),
    });
  }

  function setText(event: Event): void {
    if (!runtime || !selectedId) return;
    runtime.setOverride(selectedId, {
      text: (event.currentTarget as HTMLInputElement).value,
    });
  }

  function timecode(time: number): string {
    const minutes = Math.floor(time / 60);
    const seconds = time - minutes * 60;
    return `${minutes}:${seconds.toFixed(1).padStart(4, "0")}`;
  }

  function selectTab(tab: EditorTab): void {
    activeTab = tab;
    if (tab === "media") mediaTab = "assets";
    if (tab === "effects") mediaTab = "presets";
    if (tab === "ai") chatOpen = true;
  }

  function openTimelineSource(): void {
    activeTab = "text";
    timelineDetailsOpen = false;
    showNotice("Opened the TypeScript source for the active GSAP timeline.");
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
        text: "Request captured. Connect a web AI provider to turn it into source edits; generated changes must target TypeScript, semantic HTML/SVG, and the caller-owned GSAP timeline.",
      },
    ];
    assistantDraft = "";
  }

  function saveSource(): void {
    downloadBlob(
      new Blob([demoComposition.sourcePreview], { type: "text/typescript" }),
      "product-demo.ts",
    );
    showNotice("Saved the TypeScript composition source.");
  }

  function handleOpenFile(event: Event): void {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (file)
      showNotice(
        `${file.name} selected. Add it to src/compositions to run it through Vite.`,
      );
    fileInput.value = "";
  }

  async function exportFrame(): Promise<void> {
    if (!runtime || exporting) return;
    exporting = true;
    showNotice("Rendering the current composition frame…", 10000);
    try {
      const blob = await exportPng(runtime, 1);
      downloadBlob(
        blob,
        `motionly-${Math.round(snapshot.time * demoComposition.fps)}.png`,
      );
      showNotice("Export successful.");
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
        class="btn export-action"
        on:click={exportFrame}
        disabled={exporting}
      >
        <Download size={17} /><span>{exporting ? "Rendering…" : "Export"}</span>
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
          </div>
          <div class="me-panel-content">
            {#if activeTab === "text"}
              <h3 class="me-category-title">Composition source</h3>
              <div class="source-heading">
                <Braces size={15} /> src/compositions/demo.ts
              </div>
              <pre class="source-code">{demoComposition.sourcePreview}</pre>
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
                        >{scene.duration}s</small
                      ></span
                    >
                  </button>
                {/each}
              </div>
            {:else if mediaTab === "presets" || activeTab === "effects"}
              <h3 class="me-category-title">Promo video</h3>
              <div class="me-preset-grid">
                <button
                  class="me-preset-card"
                  on:click={() => runtime?.restart()}
                >
                  <span class="me-preset-thumbnail promo-thumbnail"
                    ><img src="/logo.svg" alt="" /></span
                  >
                  <span class="me-preset-info"
                    ><strong class="me-preset-name"
                      >Continuous Product Film</strong
                    ><small>27s · TypeScript + GSAP</small></span
                  >
                </button>
              </div>
              <p class="panel-copy">
                Overlapping scene handoffs, active UI states, shared progress,
                and directed camera movement on one GSAP timeline.
              </p>
            {:else}
              <h3 class="me-category-title">Project assets</h3>
              <div class="me-asset-grid project-asset-grid">
                <div class="me-asset-card-wrap">
                  <button
                    class="me-asset-card"
                    on:click={() => (selectedId = "brand-orbit")}
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
              class="me-canvas-shell composition-canvas"
              style:width={`${demoComposition.width}px`}
              style:height={`${demoComposition.height}px`}
              style:transform={`scale(${fitScale * zoom})`}
              bind:this={previewRoot}
            ></div>
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
                ><strong>{selectedId}</strong><small
                  >DOM composition element</small
                ></span
              >
            </div>
            <div class="me-primary-properties">
              {#if isTextEditable()}
                <div class="me-property-group">
                  <label class="me-property-label" for="property-text"
                    >Text</label
                  >
                  <textarea
                    id="property-text"
                    class="me-text-input"
                    value={currentOverride().text ??
                      runtime?.elements.get(selectedId)?.textContent ??
                      ""}
                    on:input={setText}
                  ></textarea>
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
          <span class="storyboard-strip__title">Storyboard</span><span
            class="storyboard-strip__meta"
            >{demoComposition.scenes.length} scenes · {demoComposition.duration}s</span
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
                  ><span>{scene.duration}s</span><span
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
        style={`--playhead-position:${scenePlayheadPosition()}%`}
      >
        <button class="me-timeline-resizer" aria-label="Resize timeline"
          ><span></span></button
        >
        <div class="me-timeline-toolbar">
          <div class="me-timeline-context">
            <Layers3 size={14} /><span>{selectedScene()?.label}</span>
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
          <div class="me-timeline-actions">
            <button
              class="me-timeline-command"
              aria-expanded={timelineDetailsOpen}
              aria-controls="gsap-timeline-details"
              on:click={() => (timelineDetailsOpen = !timelineDetailsOpen)}
              ><Braces size={13} /> GSAP timeline</button
            >
            {#if timelineDetailsOpen}
              <div class="me-timeline-popover" id="gsap-timeline-details">
                <strong>Master GSAP timeline</strong>
                <span
                  >{demoComposition.duration}s · {demoComposition.fps} FPS</span
                >
                <span>{selectedScene()?.label} · {timecode(snapshot.time)}</span
                >
                <button on:click={openTimelineSource}
                  >Open TypeScript source</button
                >
              </div>
            {/if}
          </div>
        </div>
        <div
          class="me-timeline-scroll"
          style="--timeline-content-width: 1100px;"
        >
          <div class="me-ruler-row">
            <div class="me-track-label me-ruler-label">
              {selectedScene()?.label}
            </div>
            <div class="me-ruler">
              {#each sceneTicks() as tick}<span
                  class="me-ruler-tick"
                  style:left={`${(tick / (selectedScene()?.duration ?? 1)) * 100}%`}
                  >{tick}s</span
                >{/each}
              <span
                class="me-playhead-marker"
                style:left={`${scenePlayheadPosition()}%`}
              ></span>
              <input
                class="me-timeline-scrubber"
                aria-label="Timeline scrubber"
                type="range"
                min={selectedScene()?.start ?? 0}
                max={(selectedScene()?.start ?? 0) +
                  (selectedScene()?.duration ?? demoComposition.duration)}
                step={1 / demoComposition.fps}
                value={snapshot.time}
                on:input={seek}
              />
            </div>
          </div>
          {#each visibleSceneTracks() as track}
            <div
              class="me-timeline-row"
              class:me-selected={selectedId === track.id}
              data-track-id={track.id}
            >
              <button class="me-track-label" on:click={() => selectTrack(track)}
                ><span class="me-track-thumb"><Layers3 size={12} /></span><span
                  class="me-track-copy"
                  ><strong>{track.label}</strong><small
                    >{track.kind} · {track.id}</small
                  ></span
                ></button
              >
              <div class="me-track-lane">
                <button
                  class="me-clip me-element-clip scene-timeline-clip"
                  class:me-selected-clip={selectedId === track.id}
                  style:left="0%"
                  style:width="100%"
                  on:click={() => selectTrack(track)}
                  ><span
                    class="clip-accent"
                    style:background={selectedScene()?.accent}
                  ></span><span class="me-clip-text">{track.label}</span
                  ></button
                >
              </div>
            </div>
          {/each}
        </div>
      </section>
    </div>
  </div>

  {#if notice}<div class="notice" role="status">{notice}</div>{/if}
</div>
