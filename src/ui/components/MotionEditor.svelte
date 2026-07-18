<script lang="ts">
  import { onMount } from 'svelte';
  import { AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd, AlignHorizontalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, AlignVerticalJustifyStart, Bot, Eye, EyeOff, FileImage, Layers3, Magnet, Maximize2, Minus, Music2, Pause, Play, Plus, Redo2, Scissors, Settings, SkipBack, Sparkles, Square, Trash2, Type, Upload, Video, Volume2, VolumeX, Undo2, X, FolderOpen, Headphones, Wand2 } from 'lucide-svelte';
  import { parseMotion } from '../../language/parser';
  import { buildSceneGraph } from '../../scene/scene-graph';
  import { evaluateScene } from '../../animation/evaluator';
  import { loadAssets, isLoadedVideo, pauseVideoAssets, synchronizeVideoAssets } from '../../assets/asset-loader';
  import type { LoadedAsset } from '../../assets/asset-loader';
  import { assetFilename, significantlyDifferentAsset, tagEmbeddedAssetPath } from '../../assets/asset-resolution';
  import type { AssetIdentity } from '../../assets/asset-resolution';
  import { CanvasRenderer, hiddenMaskSourceIds } from '../../render/canvas-renderer';
  import { canExport, exportVideo } from '../../export/exporter';
  import type { AnimationNode, AudioNode, CameraNode, ClipNode, ElementNode, ProgramNode, TrackNode } from '../../types/parser';
  import { serializeProgram } from '../../language/serializer';
  import type { Asset, Clip, Element, EvaluatedElement, EvaluatedScene, Scene, Track } from '../../types/scene';
  import { combinePersistentTrackRows, packClipTrackLanes, packTimelineLanes, type TimelineLane } from '../timeline-lanes';
  import { alignRect, snapRect, type Alignment, type SnapGuides } from '../canvas-geometry';
  import { moveKeyframe, removeKeyframe, seedKeyframes, setKeyframeEasing, upsertKeyframe } from '../keyframe-editing';
  import { splitClip, type ClipTiming } from '../clip-timing';
  import {
    adjacentClipBoundaries,
    applyClipTransition,
    removedClipTransitionProperties,
    type ClipTransitionBoundary,
  } from '../clip-transitions';
  import { elementWindowProperties, moveElementClip, splitElementClip } from '../element-clips';
  import { restoreEmbeddedAssetPaths } from '../../ai/chat';
  import { createEditorHistory, recordEditorSource, redoEditorSource, undoEditorSource } from '../editor-history';
  import { moveClipToTrack, removeClipFromTracks, trimClipOnTrack } from '../timeline-tracks';
  import { anchoredTimelineScroll, clampTimelineZoom, quantizeTimelineTime as quantizeFrameTime } from '../timeline-viewport';
  import { appUrl } from '../../app/routing';
  import AiChatPanel from './AiChatPanel.svelte';
  import AiConfigPanel from './AiConfigPanel.svelte';
  import BrandConfigPanel from './BrandConfigPanel.svelte';

  export let code = '';
  let canvas: HTMLCanvasElement;
  let stage: HTMLDivElement;
  let renderer: CanvasRenderer | null = null;
  let parseError: string | null = null;
  let ast: ProgramNode | null = null;
  let scene: Scene | null = null;
  let currentFrame: EvaluatedScene | null = null;
  let assets = new Map<string, LoadedAsset>();
  let assetsReady = true;
  let assetKey = '';
  let assetLoadId = 0;
  let embeddedAssets: Asset[] = [];
  let assistantAssets: Asset[] = [];
  let isPlaying = false;
  let currentTime = 0;
  let totalDuration = 5;
  let animationFrameId: number | null = null;
  let dragState:
    | { mode: 'move'; id: string; offsetX: number; offsetY: number; startX: number; startY: number }
    | { mode: 'resize'; id: string; centerX: number; centerY: number; startDistance: number; startScale: number }
    | null = null;
  let snapGuides: SnapGuides = { vertical: null, horizontal: null };
  // Live ghost preview for dragging a clip or element layer on the timeline.
  let clipDrag:
    | {
        id: string;
        kind: 'clip' | 'element' | 'audio';
        duration: number;
        grabOffset: number;
        originTrackId: string;
        startClientX: number;
        startClientY: number;
        ghostStart: number;
        ghostTrackId: string;
        valid: boolean;
        moved: boolean;
      }
    | null = null;
  let selectedKeyframeOffset: number | null = null;
  let showCodeEditor = false;
  let selectedElementId = '';
  let zoom = 0.42;
  let isFullscreen = false;
  let audioInput: HTMLInputElement;
  let assetInput: HTMLInputElement;
  let audioElement: HTMLAudioElement;
  let audioUrl = '';
  let audioName = '';
  let audioDuration = 0;
  let timelineHeight = 230;
  let mp4Supported = false;
  let isExporting = false;
  let exportError = '';
  let assetError = '';
  let activeNavTab: 'media' | 'audio' | 'text' | 'effects' | 'scenes' | 'ai' | 'settings' = 'media';
  let showAiChat = false;
  let mediaSubTab: 'assets' | 'presets' = 'assets';
  let showConfirmDialog = false;
  let pendingPresetPath = '';
  let previewAsset: { src: string; width: number; height: number; type: 'image' | 'video' } | null = null;
  let videoRenderId = 0;
  let isDraggingUpload = false;
  let draggingAsset: Asset | null = null;
  let draggingTransition: 'crossfade' | null = null;
  let selectedTransitionIds: { outgoingId: string; incomingId: string } | null = null;
  let dropTargetTime: number | null = null;
  let dropTargetTrack: number | string = '';
  let editorHistory = createEditorHistory(code);
  let timelineScroll: HTMLDivElement;
  let timelineZoom = 1;
  let snapEnabled = false;
  let historyGestureBase: string | null = null;

  interface AnimationPresetDef {
    name: string;
    description: string;
    category: 'text' | 'object' | 'transition' | 'camera';
  }

  const adjustmentControls = [
    { property: 'blur', label: 'Blur', min: 0, max: 40, step: 0.5, fallback: 0 },
    { property: 'brightness', label: 'Brightness', min: 0, max: 3, step: 0.01, fallback: 1 },
    { property: 'contrast', label: 'Contrast', min: 0, max: 3, step: 0.01, fallback: 1 },
    { property: 'saturation', label: 'Saturation', min: 0, max: 3, step: 0.01, fallback: 1 },
    { property: 'hue', label: 'Hue', min: -180, max: 180, step: 1, fallback: 0 },
    { property: 'grayscale', label: 'Grayscale', min: 0, max: 1, step: 0.01, fallback: 0 },
    { property: 'sepia', label: 'Sepia', min: 0, max: 1, step: 0.01, fallback: 0 },
    { property: 'invert', label: 'Invert', min: 0, max: 1, step: 0.01, fallback: 0 },
  ] as const;

  const ANIMATION_PRESETS: AnimationPresetDef[] = [
    // Text presets
    { name: 'splitReveal', description: 'Split character reveal', category: 'text' },
    { name: 'blurReveal', description: 'Blur and fade reveal', category: 'text' },
    { name: 'fadeUp', description: 'Fade up from bottom', category: 'text' },
    { name: 'slideIn', description: 'Slide in from side', category: 'text' },
    { name: 'typewriter', description: 'Typewriter effect', category: 'text' },
    { name: 'keynoteText', description: 'Keynote-style text reveal', category: 'text' },
    { name: 'charReveal', description: 'Character-by-character reveal', category: 'text' },
    { name: 'wordReveal', description: 'Word-by-word reveal', category: 'text' },
    
    // Object presets
    { name: 'heroLogo', description: 'Hero logo entrance', category: 'object' },
    { name: 'softReveal', description: 'Soft fade and scale reveal', category: 'object' },
    { name: 'springIn', description: 'Spring entrance', category: 'object' },
    { name: 'float', description: 'Floating motion', category: 'object' },
    { name: 'pulse', description: 'Pulsing scale', category: 'object' },
    { name: 'drawSVG', description: 'SVG path drawing', category: 'object' },
    { name: 'scaleReveal', description: 'Scale up reveal', category: 'object' },
    
    // Transitions
    { name: 'shapeWipe', description: 'Directional wipe transition', category: 'transition' },
    { name: 'irisWipe', description: 'Circular iris wipe', category: 'transition' },
    { name: 'maskReveal', description: 'Masked reveal transition', category: 'transition' },
    { name: 'dynamicSlide', description: 'Dynamic slide transition', category: 'transition' },
    
    // Camera
    { name: 'slowPush', description: 'Slow camera push', category: 'camera' },
    { name: 'pan', description: 'Camera pan', category: 'camera' },
    { name: 'speedZoom', description: 'Speed zoom punch', category: 'camera' },
  ];
  const availablePresets = [{
    name: 'Motionly',
    path: appUrl('preset/motionly/motionly.motion'),
    gifPath: appUrl('preset/motionly/motionly-preset.gif'),
  }];

  onMount(() => {
    mp4Supported = canExport('mp4');
    if (canvas) {
      renderer = new CanvasRenderer(canvas);
      parseAndRender();
    }
    const observer = new ResizeObserver(fitPreview);
    if (stage) observer.observe(stage);
    requestAnimationFrame(fitPreview);
    
    // Keyboard handler for Escape to clear preview
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const editing = target?.matches('input, textarea, select, [contenteditable="true"]');
      if ((e.ctrlKey || e.metaKey) && !editing && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redoEditor();
        else undoEditor();
        return;
      }
      if (e.key === 'Escape' && previewAsset) clearAssetPreview();
    };
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      observer.disconnect();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      window.removeEventListener('keydown', handleKeyDown);
    };
  });

  function beginHistoryGesture() {
    if (historyGestureBase === null) historyGestureBase = editorHistory.present;
  }

  function endHistoryGesture() {
    if (historyGestureBase === null) return;
    const finalSource = editorHistory.present;
    const baseSource = historyGestureBase;
    historyGestureBase = null;
    editorHistory = recordEditorSource(
      { ...editorHistory, present: baseSource },
      finalSource
    );
  }

  function undoEditor() {
    const previous = undoEditorSource(editorHistory);
    if (previous === editorHistory) return;
    pause();
    editorHistory = previous;
    code = previous.present;
  }

  function redoEditor() {
    const next = redoEditorSource(editorHistory);
    if (next === editorHistory) return;
    pause();
    editorHistory = next;
    code = next.present;
  }

  function requestPresetLoad(presetPath: string) {
    pendingPresetPath = presetPath;
    showConfirmDialog = true;
  }

  async function confirmLoadPreset() {
    if (!pendingPresetPath) return;
    
    try {
      const response = await fetch(pendingPresetPath);
      if (!response.ok) throw new Error('Failed to load preset');
      
      code = await response.text();
      showConfirmDialog = false;
      pendingPresetPath = '';
      selectedElementId = '';
      
      // Reset playback
      currentTime = 0;
      if (isPlaying) pause();
    } catch (error) {
      console.error('Failed to load preset:', error);
      parseError = error instanceof Error ? error.message : 'Failed to load preset';
      showConfirmDialog = false;
    }
  }

  function cancelLoadPreset() {
    showConfirmDialog = false;
    pendingPresetPath = '';
  }

  function loadGeneratedMotion(source: string): string | null {
    try {
      const restoredSource = restoreEmbeddedAssetPaths(source, embeddedAssets);
      const program = parseMotion(restoredSource);
      buildSceneGraph(program);
      if (isPlaying) pause();
      selectedElementId = '';
      currentTime = 0;
      code = restoredSource;
      return null;
    } catch (cause) {
      return cause instanceof Error ? cause.message : 'The generated project is not valid .motion source.';
    }
  }

  $: if (code) {
    if (code !== editorHistory.present) {
      editorHistory = historyGestureBase === null
        ? recordEditorSource(editorHistory, code)
        : { ...editorHistory, present: code, future: [] };
    }
    parseAndRender();
  }

  $: selectedElement =
    scene?.elements.find((element) => element.id === selectedElementId) ?? null;
  $: selectedClip = scene?.clips.find((clip) => clip.id === selectedElementId) ?? null;
  $: selectedAnimation =
    scene?.animations.find((animation) => animation.target === selectedElement?.id) ?? null;
  $: keyframeDragDelta =
    clipDrag?.kind === 'element' && clipDrag.id === selectedElementId
      ? clipDrag.ghostStart - timelineRange(clipDrag.id).start
      : 0;
  $: sourceElements = scene?.elements.filter((element) => !element.id.includes('__')) ?? [];
  $: allTimelineRows = packTimelineLanes(sourceElements, timelineRange);
  $: combinedTimelineRows = combinePersistentTrackRows(
    packClipTrackLanes(scene?.clips ?? [], scene?.tracks ?? []),
    allTimelineRows
  );
  $: timelineRows = combinedTimelineRows.elementLanes;
  $: timelineClipTracks = combinedTimelineRows.clipTracks;
  $: defaultMainTrack = scene?.tracks.find((track) => track.role === 'main')?.id ?? 'main';
  $: projectAudioTrack = scene?.tracks.find((track) => track.role === 'audio') ?? null;
  $: transitionBoundaries = adjacentClipBoundaries(
    scene?.clips ?? [],
    1 / (scene?.canvas.fps ?? 60)
  );
  $: selectedTransition = selectedTransitionIds
    ? transitionBoundaries.find(
        (boundary) =>
          boundary.outgoing.id === selectedTransitionIds?.outgoingId &&
          boundary.incoming.id === selectedTransitionIds?.incomingId &&
          boundary.type !== null
      ) ?? null
    : null;
  $: timelineTicks = Array.from({ length: 7 }, (_, index) => (totalDuration * index) / 6);
  $: displayFrame = Math.round(currentTime * (scene?.canvas.fps ?? 60));
  $: assistantAssets = mergeAssets(scene?.imports ?? [], embeddedAssets);
  $: canvasWidth = scene?.canvas.width ?? 1920;
  $: canvasHeight = scene?.canvas.height ?? 1080;
  $: aiProjectInfo = {
    width: canvasWidth,
    height: canvasHeight,
    fps: scene?.canvas.fps ?? 60,
    duration: totalDuration,
    elementCount: sourceElements.length,
  };
  $: canvasStyle = `width: ${Math.round(canvasWidth * zoom)}px; aspect-ratio: ${canvasWidth} / ${canvasHeight};`;
  $: timelineContentWidth = Math.max(820, 220 + totalDuration * 100 * timelineZoom);

  function parseAndRender() {
    try {
      parseError = null;
      ast = parseMotion(code);
      scene = buildSceneGraph(ast);
      if (audioElement) {
        audioElement.muted = scene.tracks.find((track) => track.role === 'audio')?.muted ?? false;
      }
      rememberEmbeddedAssets(scene.imports);
      totalDuration = scene.canvas.duration;
      currentTime = Math.min(currentTime, totalDuration);
      if (selectedElementId && !scene.elements.some((element) => element.id === selectedElementId) && !scene.clips.some((clip) => clip.id === selectedElementId)) selectedElementId = '';
      
      // Load audio if specified in scene
      if (scene.audio) {
        // Check if we need to load/reload audio
        const currentAudioPath = scene.audio;
        const needsLoad = !audioUrl || !audioName || !currentAudioPath.endsWith(audioName);
        
        if (needsLoad) {
          loadAudioFromPath(currentAudioPath);
        }
      } else if (!scene.audio && audioUrl) {
        // Clear audio if not in scene
        removeAudio();
      }
      
      const nextAssetKey = scene.imports.map((asset) => `${asset.name}:${asset.path}`).join('|');
      if (nextAssetKey !== assetKey) {
        assetKey = nextAssetKey;
        assetsReady = false;
        void refreshAssets(scene);
      }
      renderFrame(currentTime);
    } catch (error) {
      parseError = error instanceof Error ? error.message : String(error);
      console.error('Parse error:', error);
    }
  }

  function renderFrame(time: number, exactVideoSeek = false) {
    if (!renderer || !scene) return;
    const frame = evaluateScene(scene, time);
    currentFrame = frame;
    const renderId = ++videoRenderId;
    const draw = () => {
      if (!renderer || renderId !== videoRenderId) return;
      renderer.render(frame, assets);
      drawSelection();
    };
    if (exactVideoSeek) {
      void synchronizeVideoAssets(frame, assets, { playing: false, exact: true })
        .then(draw)
        .catch((error) => console.warn('Video seek failed:', error));
      return;
    }
    void synchronizeVideoAssets(frame, assets, { playing: isPlaying }).catch((error) =>
      console.warn('Video synchronization failed:', error)
    );
    draw();
  }

  function drawSelection() {
    if (!canvas || !currentFrame || !selectedElementId) return;
    const matches = currentFrame.elements.filter((element) => {
      const props = propertiesOf(element);
      return element.id === selectedElementId || props['textGroup'] === selectedElementId;
    });
    const visible = matches.filter((element) => Number(propertiesOf(element)['opacity'] ?? 1) > 0.001);
    const boxes = (visible.length ? visible : matches).map(elementBounds);
    if (!boxes.length) return;
    const left = Math.min(...boxes.map((box) => box.x));
    const top = Math.min(...boxes.map((box) => box.y));
    const right = Math.max(...boxes.map((box) => box.x + box.width));
    const bottom = Math.max(...boxes.map((box) => box.y + box.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const inset = selectedElement?.kind === 'overlay' || selectedElement?.kind === 'effect' ? 3 / zoom : 0;
    const handleSize = 10 / zoom;
    ctx.save();
    ctx.strokeStyle = '#7cf7c5';
    ctx.lineWidth = 2 / zoom;
    ctx.setLineDash([8 / zoom, 5 / zoom]);
    ctx.strokeRect(left + inset, top + inset, right - left - inset * 2, bottom - top - inset * 2);
    if (selectedElement?.kind === 'asset' || selectedElement?.kind === 'text') {
      ctx.setLineDash([]);
      ctx.fillStyle = '#0d1513';
      const corners: Array<[number, number]> = [[left, top], [right, top], [right, bottom], [left, bottom]];
      for (const [x, y] of corners) {
        ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
        ctx.strokeRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
      }
    }
    ctx.restore();
  }

  async function refreshAssets(nextScene: Scene) {
    const loadId = ++assetLoadId;
    const previousAssets = assets;
    try {
      const loaded = await loadAssets(nextScene);
      if (loadId !== assetLoadId) return;
      for (const asset of nextScene.imports) {
        const previous = previousAssets.get(asset.name);
        if (!loaded.has(asset.name) && previous) loaded.set(asset.name, previous);
      }
      assets = loaded;
      const missing = nextScene.imports.filter((asset) => !loaded.has(asset.name));
      assetError = missing.length ? `Could not load ${missing.map((asset) => asset.name).join(', ')}.` : '';
      assetsReady = true;
      renderFrame(currentTime, true);
    } catch (error) {
      console.warn('Asset load failed:', error);
    }
  }

  function rememberEmbeddedAssets(imports: Asset[]) {
    const remembered = new Map(embeddedAssets.map((asset) => [asset.name, asset]));
    for (const asset of imports) if (asset.path.startsWith('data:')) remembered.set(asset.name, asset);
    embeddedAssets = [...remembered.values()];
  }

  function mergeAssets(current: Asset[], embedded: Asset[]): Asset[] {
    return [...new Map([...current, ...embedded].map((asset) => [asset.name, asset])).values()];
  }

  function play() {
    if (!scene) return;
    isPlaying = true;
    resumeAudioAtCurrentTime();

    const fps = scene.canvas.fps;
    const frameTime = 1000 / fps;
    let lastTime = performance.now();
    
    function animate(now: number) {
      if (!isPlaying) return;

      const delta = now - lastTime;
      if (delta >= frameTime) {
        if (audioUrl && audioElement && !audioElement.paused && !audioElement.ended) {
          currentTime = quantizeTimelineTime((scene?.audioStart ?? 0) + audioElement.currentTime);
        } else {
          currentTime = quantizeTimelineTime(currentTime + delta / 1000);
          resumeAudioAtCurrentTime();
        }
        
        if (currentTime >= totalDuration) {
          currentTime = totalDuration;
          pause();
        }

        renderFrame(currentTime);
        lastTime = now;
      }

      animationFrameId = requestAnimationFrame(animate);
    }

    animationFrameId = requestAnimationFrame(animate);
  }

  function pause() {
    isPlaying = false;
    audioElement?.pause();
    pauseVideoAssets(assets);
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  function reset() {
    pause();
    currentTime = 0;
    syncAudio();
    renderFrame(currentTime, true);
  }

  function quantizeTimelineTime(time: number): number {
    return quantizeFrameTime(time, totalDuration, scene?.canvas.fps ?? 60);
  }

  function seek(event: Event) {
    pause();
    currentTime = quantizeTimelineTime(Number((event.currentTarget as HTMLInputElement).value));
    syncAudio();
    renderFrame(currentTime, true);
  }

  function setTime(time: number) {
    pause();
    currentTime = quantizeTimelineTime(time);
    syncAudio();
    renderFrame(currentTime, true);
  }

  function resizeTimeline(event: PointerEvent) {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = timelineHeight;
    const move = (moveEvent: PointerEvent) => {
      timelineHeight = Math.max(130, Math.min(window.innerHeight * 0.55, startHeight + startY - moveEvent.clientY));
      fitPreview();
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  }

  function resizeTimelineWithKeyboard(event: KeyboardEvent) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    timelineHeight = Math.max(130, Math.min(window.innerHeight * 0.55, timelineHeight + (event.key === 'ArrowUp' ? 24 : -24)));
    requestAnimationFrame(fitPreview);
  }

  function fitPreview() {
    if (!stage || !scene) return;
    const rect = stage.getBoundingClientRect();
    const next = Math.min((rect.width - 72) / canvasWidth, (rect.height - 72) / canvasHeight, 1);
    zoom = Math.max(0.08, Number(next.toFixed(3)));
  }

  function toggleFullscreen() {
    isFullscreen = !isFullscreen;
    requestAnimationFrame(fitPreview);
  }

  function toggleCodeEditor() {
    showCodeEditor = !showCodeEditor;
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function formatPreciseTime(seconds: number): string {
    return `${formatTime(seconds)}.${Math.floor((seconds % 1) * 10)}`;
  }

  function propertiesOf(element: Element | EvaluatedElement): Record<string, unknown> {
    return (('render' in element ? element.render : element.properties) as unknown) as Record<string, unknown>;
  }

  function elementDetail(element: Element): string {
    if (element.asset?.path) return element.asset.path.split('/').pop() ?? 'Asset';
    if (element.kind === 'text') {
      const value = stringProperty(element, 'value', 'Text');
      return value.length > 24 ? `${value.slice(0, 24)}...` : value;
    }
    if (element.kind === 'overlay') return 'Scene color';
    if (element.kind === 'effect') return 'Effect';
    return 'Layer';
  }

  function timelineRange(id: string): { start: number; end: number } {
    if (!scene) return { start: 0, end: totalDuration };
    const targets = new Set(scene.elements
      .filter((element) => element.id === id || propertiesOf(element)['textGroup'] === id)
      .map((element) => element.id));
    const entries: number[] = [];
    const exits: number[] = [];
    const source = scene.elements.find((element) => element.id === id);
    const sourceProperties = source ? propertiesOf(source) : {};
    if (
      typeof sourceProperties['start'] === 'number' &&
      typeof sourceProperties['duration'] === 'number'
    ) {
      const start = Math.max(0, sourceProperties['start']);
      return {
        start,
        end: Math.min(totalDuration, start + Math.max(0, sourceProperties['duration'])),
      };
    }
    if (source && numericProperty(source, 'opacity', 1) > 0) entries.push(0);

    for (const animation of scene.animations.filter((item) => targets.has(item.target))) {
      if (animation.keyframes.length) {
        const visible = animation.keyframes.filter((frame) => Number(frame.properties['opacity'] ?? 0) > 0);
        if (visible[0]) entries.push(animation.delay + visible[0].offset * animation.duration);
        const lastVisible = visible.at(-1);
        const nextHidden = lastVisible && animation.keyframes.find(
          (frame) => frame.offset > lastVisible.offset && Number(frame.properties['opacity'] ?? 1) <= 0
        );
        if (nextHidden) exits.push(animation.delay + nextHidden.offset * animation.duration);
        continue;
      }
      const fromOpacity = Number(animation.from['opacity'] ?? numericProperty(source ?? null, 'opacity', 1));
      const toOpacity = Number(animation.to['opacity'] ?? fromOpacity);
      if (toOpacity > 0) entries.push(animation.delay);
      if (fromOpacity > 0 && toOpacity <= 0) exits.push(animation.delay + animation.duration);
    }

    const start = entries.length ? Math.min(...entries) : 0;
    const end = exits.length ? Math.max(start, ...exits) : totalDuration;
    return { start: Math.max(0, start), end: Math.min(totalDuration, end) };
  }

  function timelinePercent(time: number): number {
    return totalDuration > 0 ? Math.max(0, Math.min(100, (time / totalDuration) * 100)) : 0;
  }

  async function handleAudioSelected(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file || !ast) return;
    if (file.size > 50 * 1024 * 1024) {
      assetError = 'Audio files must be 50 MB or smaller.';
      return;
    }
    const dataUrl = await readFileDataUrl(file);
    if (audioUrl.startsWith('blob:')) URL.revokeObjectURL(audioUrl);
    audioUrl = dataUrl;
    audioName = file.name;
    audioDuration = 0;
    audioElement.src = audioUrl;
    audioElement.muted = projectAudioTrack?.muted ?? false;
    audioElement.load();
    ast.body = ast.body.filter((node) => node.type !== 'Audio');
    const insertAt = ast.body.findIndex(
      (node) => node.type === 'Import' || node.type === 'Track' || node.type === 'Element'
    );
    ast.body.splice(insertAt < 0 ? ast.body.length : insertAt, 0, {
      type: 'Audio',
      path: dataUrl,
      properties: {},
    });
    audioInput.value = '';
    code = serializeProgram(ast);
  }

  async function loadAudioFromPath(path: string) {
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error('Failed to load audio');
      
      const blob = await response.blob();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      audioUrl = URL.createObjectURL(blob);
      audioName = path.startsWith('data:audio/')
        ? 'Embedded audio'
        : path.substring(path.lastIndexOf('/') + 1);
      audioDuration = 0;
      
      if (audioElement) {
        audioElement.src = audioUrl;
        audioElement.load();
      }
    } catch (error) {
      console.error('Failed to load audio:', error);
    }
  }

  function removeAudio() {
    pause();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = '';
    audioName = '';
    audioDuration = 0;
    if (audioElement) audioElement.removeAttribute('src');
    
    // Remove audio from AST
    if (ast) {
      ast.body = ast.body.filter(node => node.type !== 'Audio');
      code = serializeProgram(ast);
    }
  }

  export async function exportMp4(
    filename = 'motionly.mp4',
    onProgress?: (progress: number) => void
  ) {
    if (!scene || isExporting) return;
    if (!mp4Supported) {
      exportError = 'MP4 export is not supported by this browser.';
      return;
    }
    if (!assetsReady) {
      exportError = 'Assets are still loading. Try export again in a moment.';
      return;
    }
    pause();
    isExporting = true;
    exportError = '';
    try {
      const blob = await exportVideo({
        scene,
        assets,
        format: 'mp4',
        height: scene.canvas.height,
        fps: scene.canvas.fps,
        audioUrl: audioUrl || undefined,
        onProgress: (progress) => {
          onProgress?.(progress);
        },
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      exportError = error instanceof Error ? error.message : String(error);
    } finally {
      isExporting = false;
    }
  }

  function deleteSelectedElement() {
    if (!ast || !selectedElementId) return;
    const id = selectedElementId;
    if (selectedClip) {
      deleteClip(id);
      return;
    }
    ast.body = ast.body.filter((node) =>
      !(node.type === 'Element' && node.name === id) &&
      !(node.type === 'Animation' && node.target === id)
    );
    selectedElementId = '';
    code = serializeProgram(ast);
  }

  function trimElement(event: PointerEvent, id: string, edge: 'start' | 'end') {
    event.preventDefault();
    event.stopPropagation();
    const lane = (event.currentTarget as HTMLElement).closest('.track-lane');
    if (!lane) return;
    beginHistoryGesture();
    const rect = lane.getBoundingClientRect();
    const update = (pointer: PointerEvent) => {
      const raw = ((pointer.clientX - rect.left) / rect.width) * totalDuration;
      setClipBoundary(id, edge, snapTimelineTime(raw, rect.width, id));
    };
    const stop = () => {
      endHistoryGesture();
      window.removeEventListener('pointermove', update);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', update);
    window.addEventListener('pointerup', stop);
  }

  function setClipBoundary(id: string, edge: 'start' | 'end', time: number) {
    if (!ast) return;
    const range = timelineRange(id);
    const element = ast.body.find(
      (node): node is ElementNode => node.type === 'Element' && node.name === id
    );
    if (!element) return;
    const minimum = 1 / (scene?.canvas.fps ?? 60);
    const start = edge === 'start' ? Math.min(time, range.end - minimum) : range.start;
    const end = edge === 'end' ? Math.max(time, range.start + minimum) : range.end;
    element.properties = elementWindowProperties(element.properties, start, end, minimum);
    code = serializeProgram(ast);
  }

  function syncAudio() {
    if (!audioUrl || !audioElement) return;
    audioElement.currentTime = Math.min(
      Math.max(0, currentTime - (scene?.audioStart ?? 0)),
      audioDuration || currentTime
    );
  }

  function resumeAudioAtCurrentTime() {
    if (!audioUrl || !audioElement || !scene) return;
    const localTime = currentTime - scene.audioStart;
    if (localTime < 0 || localTime >= (audioDuration || Number.POSITIVE_INFINITY)) return;
    syncAudio();
    if (audioElement.paused) {
      audioElement.play().catch((error) => {
        console.warn('Audio playback failed (this is normal if no user interaction yet):', error.message);
      });
    }
  }

  function numericProperty(element: Element | EvaluatedElement | null, key: string, fallback: number): number {
    if (!element) return fallback;
    const value = propertiesOf(element)[key];
    return typeof value === 'number' ? value : fallback;
  }

  function stringProperty(element: Element | EvaluatedElement | null, key: string, fallback: string): string {
    if (!element) return fallback;
    const value = propertiesOf(element)[key];
    return typeof value === 'string' ? value : fallback;
  }

  function updateElementProperty(key: string, value: string | number | boolean) {
    if (!ast || !selectedElement) return;
    const node = ast.body.find(
      (item): item is ElementNode =>
        item.type === 'Element' && item.name === selectedElement.id
    );
    if (!node) return;
    node.properties = { ...node.properties, [key]: value };
    code = serializeProgram(ast);
  }

  function resetElementSize() {
    if (!ast) return;
    const targetId = selectedElement?.kind === 'asset' ? selectedElement.id : selectedClip?.assetName;
    if (!targetId) return;
    const node = ast.body.find(
      (item): item is ElementNode => item.type === 'Element' && item.name === targetId
    );
    if (!node) return;
    const properties = { ...node.properties };
    delete properties['width'];
    delete properties['height'];
    node.properties = properties;
    code = serializeProgram(ast);
  }

  function updateElementProperties(elementId: string, updates: Record<string, string | number | boolean>) {
    if (!ast) return;
    const node = ast.body.find(
      (item): item is ElementNode => item.type === 'Element' && item.name === elementId
    );
    if (!node) return;
    node.properties = { ...node.properties, ...updates };
    code = serializeProgram(ast);
  }

  function handleCanvasPointerDown(event: PointerEvent) {
    if (!scene || !canvas) return;
    const point = pointerToCanvas(event);
    if (selectedElement && (selectedElement.kind === 'asset' || selectedElement.kind === 'text')) {
      const bounds = selectedBounds();
      if (bounds) {
        const corners: Array<[number, number]> = [
          [bounds.x, bounds.y],
          [bounds.x + bounds.width, bounds.y],
          [bounds.x + bounds.width, bounds.y + bounds.height],
          [bounds.x, bounds.y + bounds.height],
        ];
        const handleRadius = 16 / zoom;
        if (corners.some(([x, y]) => Math.hypot(point.x - x, point.y - y) <= handleRadius)) {
          const centerX = bounds.x + bounds.width / 2;
          const centerY = bounds.y + bounds.height / 2;
          dragState = {
            mode: 'resize',
            id: selectedElement.id,
            centerX,
            centerY,
            startDistance: Math.max(1, Math.hypot(point.x - centerX, point.y - centerY)),
            startScale: numericProperty(selectedElement, 'scale', 1),
          };
          canvas.setPointerCapture(event.pointerId);
          return;
        }
      }
    }
    const element = hitTest(point.x, point.y);
    if (!element) {
      selectedElementId = '';
      renderFrame(currentTime);
      return;
    }

    pause();
    const targetId = stringProperty(element, 'textGroup', element.id);
    selectElement(targetId, false);
    const target = scene.elements.find((item) => item.id === targetId);
    if (!target) return;
    const center = elementCenter(target);
    dragState = {
      mode: 'move',
      id: targetId,
      offsetX: point.x - center.x,
      offsetY: point.y - center.y,
      startX: numericProperty(target, 'x', 0),
      startY: numericProperty(target, 'y', 0),
    };
    canvas.setPointerCapture(event.pointerId);
  }

  function handleCanvasPointerMove(event: PointerEvent) {
    if (!dragState || !scene) return;
    const point = pointerToCanvas(event);
    const element = scene.elements.find((item) => item.id === dragState?.id);
    if (!element) return;
    if (dragState.mode === 'resize') {
      const distance = Math.hypot(point.x - dragState.centerX, point.y - dragState.centerY);
      updateElementProperties(element.id, { scale: Number(Math.max(0.05, dragState.startScale * distance / dragState.startDistance).toFixed(3)) });
      return;
    }
    const centered = isCentered(element);
    let nextX = point.x - dragState.offsetX - (centered ? scene.canvas.width / 2 : 0);
    let nextY = point.y - dragState.offsetY - (centered ? scene.canvas.height / 2 : 0);
    if (event.shiftKey) {
      const deltaX = nextX - dragState.startX;
      const deltaY = nextY - dragState.startY;
      if (Math.abs(deltaX) >= Math.abs(deltaY)) nextY = dragState.startY;
      else nextX = dragState.startX;
    }

    const currentX = numericProperty(element, 'x', 0);
    const currentY = numericProperty(element, 'y', 0);
    const currentBounds = elementBounds(element);
    const proposedBounds = {
      ...currentBounds,
      x: currentBounds.x + nextX - currentX,
      y: currentBounds.y + nextY - currentY,
    };
    const others = scene.elements
      .filter((candidate) => candidate.id !== element.id && !candidate.id.includes('__'))
      .filter((candidate) => candidate.kind === 'asset' || candidate.kind === 'text')
      .map(elementBounds);
    const snapped = event.altKey
      ? { rect: proposedBounds, guides: { vertical: null, horizontal: null } }
      : snapRect(proposedBounds, others, scene.canvas, 6 / Math.max(zoom, 0.01));
    snapGuides = snapped.guides;
    nextX += snapped.rect.x - proposedBounds.x;
    nextY += snapped.rect.y - proposedBounds.y;
    updateElementProperties(element.id, { x: Math.round(nextX), y: Math.round(nextY) });
  }

  function handleCanvasPointerUp(event: PointerEvent) {
    dragState = null;
    snapGuides = { vertical: null, horizontal: null };
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  }

  function alignSelected(alignment: Alignment) {
    if (!scene || !selectedElement) return;
    const bounds = elementBounds(selectedElement);
    const aligned = alignRect(bounds, scene.canvas, alignment);
    updateElementProperties(selectedElement.id, {
      x: Math.round(numericProperty(selectedElement, 'x', 0) + aligned.x - bounds.x),
      y: Math.round(numericProperty(selectedElement, 'y', 0) + aligned.y - bounds.y),
    });
  }

  function pointerToCanvas(event: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvasWidth,
      y: ((event.clientY - rect.top) / rect.height) * canvasHeight,
    };
  }

  function hitTest(x: number, y: number): EvaluatedElement | null {
    if (!currentFrame) return null;
    const hiddenMasks = hiddenMaskSourceIds(currentFrame.elements);
    const editable = currentFrame.elements
      .filter((element) => !hiddenMasks.has(element.id))
      .filter((element) => element.kind === 'text' || element.kind === 'asset')
      .filter((element) => numericProperty(element, 'opacity', 1) > 0)
      .reverse();

    return editable.find((element) => {
      const bounds = elementBounds(element);
      return x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height;
    }) ?? null;
  }

  function selectElement(id: string, seekToElement = true) {
    if (id !== selectedElementId) selectedKeyframeOffset = null;
    selectedTransitionIds = null;
    selectedElementId = id;
    if (seekToElement) setTime(firstVisibleTime(id));
    else renderFrame(currentTime);
  }

  function previewAssetOnly(asset: Asset) {
    const loaded = assets.get(asset.name);
    if (loaded) {
      previewAsset = {
        src: loaded.src,
        width: loaded.width,
        height: loaded.height,
        type: isLoadedVideo(loaded) ? 'video' : 'image',
      };
    }
  }

  function clearAssetPreview() {
    previewAsset = null;
  }

  function handleAssetDragStart(event: DragEvent, asset: Asset) {
    draggingAsset = asset;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('text/plain', asset.name);
    }
  }

  function handleAssetDragEnd() {
    draggingAsset = null;
    dropTargetTime = null;
    dropTargetTrack = '';
  }

  async function handleAssetUpload(event: Event) {
    await importAssetFiles((event.currentTarget as HTMLInputElement).files);
    assetInput.value = '';
  }

  async function handleAssetFileDrop(event: DragEvent) {
    event.preventDefault();
    isDraggingUpload = false;
    await importAssetFiles(event.dataTransfer?.files);
  }

  function handleAssetFileDrag(event: DragEvent) {
    if (event.dataTransfer?.types.includes('Files')) isDraggingUpload = true;
  }

  function handleAssetFileDragLeave(event: DragEvent) {
    if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) {
      isDraggingUpload = false;
    }
  }

  async function importAssetFiles(fileList: FileList | null | undefined) {
    if (!ast) return;
    const program = ast;
    assetError = '';
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    for (const file of files) {
      const lowerName = file.name.toLowerCase();
      const isImage = file.type.startsWith('image/') || lowerName.endsWith('.svg');
      const isVideo = file.type === 'video/mp4' || file.type === 'video/webm' || /\.(mp4|webm|m4v)$/.test(lowerName);
      if (!isImage && !isVideo) {
        assetError = `${file.name} is not a supported image, SVG, MP4, or WebM file.`;
        continue;
      }
      const maximumSize = isVideo ? 100_000_000 : 10_000_000;
      if (file.size > maximumSize) {
        assetError = `${file.name} is larger than ${isVideo ? '100' : '10'} MB.`;
        continue;
      }
      let path = '';
      try {
        path = tagEmbeddedAssetPath(await readFileDataUrl(file), file.name);
      } catch (cause) {
        assetError = cause instanceof Error ? cause.message : `Could not read ${file.name}.`;
        continue;
      }
      const matchingImports = program.body.filter(
        (node) => node.type === 'Import' && assetFilename(node.path) === file.name
      );
      if (matchingImports.length) {
        const existing = matchingImports
          .map((node) => assets.get(node.name))
          .find((asset): asset is LoadedAsset => !!asset);
        let replacement: AssetIdentity;
        try {
          replacement = await readMediaIdentity(file, isVideo);
        } catch (cause) {
          assetError = cause instanceof Error ? cause.message : `Could not inspect ${file.name}.`;
          continue;
        }
        if (
          existing &&
          significantlyDifferentAsset(
            { width: existing.width, height: existing.height, size: existing.motionlySize },
            replacement
          ) &&
          !window.confirm(
            `${file.name} has very different size or dimensions from the current asset. Replace it anyway?`
          )
        ) {
          assetError = `Kept the current ${file.name}.`;
          continue;
        }
        for (const node of matchingImports) node.path = path;
        assetError = `Matched ${file.name} to its existing import by filename.`;
        continue;
      }
      const used = new Set(program.body.flatMap((node) => node.type === 'Import' ? [node.name] : node.type === 'Element' ? [node.name] : []));
      const base = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[^a-zA-Z_]/, 'asset_') || 'asset';
      let name = base;
      let suffix = 2;
      while (used.has(name)) name = `${base}_${suffix++}`;
      program.body.push({ type: 'Import', path, name });
    }
    code = serializeProgram(program);
  }

  async function readMediaIdentity(file: File, isVideo: boolean) {
    const url = URL.createObjectURL(file);
    try {
      if (isVideo) {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.src = url;
        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => resolve();
          video.onerror = () => reject(video.error ?? new Error(`Could not inspect ${file.name}.`));
        });
        return { width: video.videoWidth, height: video.videoHeight, size: file.size };
      }
      const image = new Image();
      image.src = url;
      await image.decode();
      return { width: image.naturalWidth, height: image.naturalHeight, size: file.size };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function readFileDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error(`Could not read ${file.name}.`));
      reader.readAsDataURL(file);
    });
  }

  function handleTimelineDragOver(event: DragEvent) {
    if (!draggingAsset) return;
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }

    const timeline = event.currentTarget as HTMLElement;
    const rect = timeline.querySelector<HTMLElement>('.ruler')?.getBoundingClientRect();
    if (!rect) return;
    dropTargetTime = timelineTimeAt(event.clientX, rect);
    const track = (event.target as HTMLElement).closest<HTMLElement>('[data-track]')?.dataset['track'];
    dropTargetTrack = track && !Number.isNaN(Number(track)) ? Number(track) : (track || 1);
  }

  function handleTimelineDrop(event: DragEvent) {
    event.preventDefault();
    if (!draggingAsset || !ast || dropTargetTime === null) return;
    
    const assetName = draggingAsset.name;
    const frame = 1 / (scene?.canvas.fps ?? 60);
    const loadedAsset = assets.get(assetName);
    const naturalDuration = isLoadedVideo(loadedAsset) && loadedAsset.motionlyDuration > 0
      ? loadedAsset.motionlyDuration
      : 5;
    const duration = Math.min(naturalDuration, Math.max(frame, totalDuration - dropTargetTime));
    const start = Math.min(dropTargetTime, Math.max(0, totalDuration - duration));
    const targetId = String(dropTargetTrack || defaultMainTrack);
    const targetTrack = ensureLayerTrack(targetId);
    const clipNode: ClipNode = {
      type: 'Clip',
      assetName,
      properties: {
        track: targetTrack.id,
        start: `${start.toFixed(3)}s`,
        duration: `${duration.toFixed(3)}s`,
        trimIn: '0s',
        trimOut: '0s',
      },
    };
    ast.body.push(clipNode);
    if (scene) {
      const newId = `clip_${assetName}_${scene.clips.length}`;
      const runtimeClip: Clip = {
        id: newId,
        assetName,
        asset: draggingAsset,
        track: targetTrack.id,
        start,
        duration,
        trimIn: 0,
        trimOut: 0,
        transitionInDuration: 0,
        transitionOutDuration: 0,
        sourceOrder: scene.clips.length,
      };
      const next = moveClipToTrack(
        [...scene.clips, runtimeClip],
        newId,
        targetTrack,
        start,
        totalDuration
      );
      if (next) {
        writeClipLayout(next, false);
        const inserted = next.find((clip) => clip.id === newId);
        if (inserted) {
          clipNode.properties = {
            ...clipNode.properties,
            track: inserted.track,
            start: `${inserted.start.toFixed(3)}s`,
          };
        }
      }
    }
    code = serializeProgram(ast);
    draggingAsset = null;
    dropTargetTime = null;
    dropTargetTrack = '';
  }

  function writeClipLayout(nextClips: Clip[], serialize = true) {
    if (!ast || !scene) return;
    for (const current of scene.clips) {
      const next = nextClips.find((clip) => clip.id === current.id);
      if (!next) continue;
      const node = clipNodeAt(scene.clips.findIndex((clip) => clip.id === current.id));
      if (!node) continue;
      node.properties = {
        ...node.properties,
        track: next.track,
        start: `${next.start.toFixed(3)}s`,
        duration: `${next.duration.toFixed(3)}s`,
        trimIn: `${next.trimIn.toFixed(3)}s`,
        trimOut: `${next.trimOut.toFixed(3)}s`,
      };
    }
    if (serialize) code = serializeProgram(ast);
  }

  function deleteClip(clipId: string) {
    if (!ast || !scene) return;
    const node = clipNodeAt(scene.clips.findIndex((clip) => clip.id === clipId));
    if (!node) return;
    detachClipTransitions(clipId);
    const next = removeClipFromTracks(scene.clips, clipId);
    writeClipLayout(next, false);
    ast.body.splice(ast.body.indexOf(node), 1);
    if (selectedElementId === clipId) selectedElementId = '';
    code = serializeProgram(ast);
  }

  function firstVisibleTime(id: string): number {
    return scene?.clips.find((clip) => clip.id === id)?.start ?? timelineRange(id).start;
  }

  function clipNodeAt(sceneIndex: number): ClipNode | null {
    if (!ast || sceneIndex < 0) return null;
    return ast.body.filter((node): node is ClipNode => node.type === 'Clip')[sceneIndex] ?? null;
  }

  function detachClipTransitions(clipId: string) {
    if (!scene) return;
    const related = transitionBoundaries.filter(
      (boundary) =>
        boundary.type !== null &&
        (boundary.outgoing.id === clipId || boundary.incoming.id === clipId)
    );
    const removed = removedClipTransitionProperties();
    for (const boundary of related) {
      const outgoingNode = clipNodeAt(
        scene.clips.findIndex((clip) => clip.id === boundary.outgoing.id)
      );
      const incomingNode = clipNodeAt(
        scene.clips.findIndex((clip) => clip.id === boundary.incoming.id)
      );
      if (!outgoingNode || !incomingNode) continue;
      const outgoingProperties = { ...outgoingNode.properties };
      const incomingProperties = { ...incomingNode.properties };
      for (const key of removed.outgoing) delete outgoingProperties[key];
      for (const key of removed.incoming) delete incomingProperties[key];
      outgoingNode.properties = outgoingProperties;
      incomingNode.properties = incomingProperties;
    }
    if (related.length > 0) selectedTransitionIds = null;
  }

  function trackNodeFor(track: Track): TrackNode | null {
    if (!ast) return null;
    const existing = ast.body.find(
      (node): node is TrackNode => node.type === 'Track' && node.name === track.id
    );
    if (existing) return existing;
    const node: TrackNode = {
      type: 'Track',
      name: track.id,
      properties: {
        label: track.label,
        role: track.role,
        content: track.content,
        hidden: track.hidden,
        muted: track.muted,
        order: track.order,
      },
    };
    const firstContent = ast.body.findIndex(
      (item) => item.type === 'Element' || item.type === 'Clip' || item.type === 'Animation'
    );
    ast.body.splice(firstContent < 0 ? ast.body.length : firstContent, 0, node);
    return node;
  }

  function ensureLayerTrack(trackId: string): Track {
    const existing = scene?.tracks.find((track) => track.id === trackId);
    if (existing?.declared) return existing;
    const elementRow = allTimelineRows.findIndex((row) => row.trackId === trackId);
    const track: Track = {
      id: trackId,
      label: existing?.label ?? `Layer ${trackId.replace(/^legacy-/, '')}`,
      role: existing?.role ?? 'overlay',
      content: existing?.content ?? 'mixed',
      hidden: existing?.hidden ?? false,
      muted: existing?.muted ?? false,
      order: elementRow < 0
        ? (existing?.order ?? Math.max(0, ...(scene?.tracks.map((item) => item.order) ?? [])) + 1)
        : 9000 + elementRow,
      declared: true,
    };
    trackNodeFor(track);
    return track;
  }

  function materializeTimelineLayers() {
    if (!ast) return;
    for (const row of allTimelineRows) {
      const track = ensureLayerTrack(row.trackId);
      for (const item of row.items) {
        const node = ast.body.find(
          (candidate): candidate is ElementNode =>
            candidate.type === 'Element' && candidate.name === item.element.id
        );
        if (node) node.properties = { ...node.properties, track: track.id };
      }
    }
  }

  function updateTrack(track: Track, updates: { hidden?: boolean; muted?: boolean }) {
    const node = trackNodeFor(track);
    if (!node || !ast) return;
    node.properties = { ...node.properties, ...updates };
    if (track.id === projectAudioTrack?.id && updates.muted !== undefined && audioElement) {
      audioElement.muted = updates.muted;
    }
    code = serializeProgram(ast);
  }

  function updateClip(clipId: string, updates: Record<string, string | number | boolean>) {
    if (!ast || !scene) return;
    const node = clipNodeAt(scene.clips.findIndex((clip) => clip.id === clipId));
    if (!node) return;
    if (['track', 'start', 'duration'].some((key) => key in updates)) {
      detachClipTransitions(clipId);
    }
    node.properties = { ...node.properties, ...updates };
    code = serializeProgram(ast);
  }

  function moveSelectedClipFromInspector(trackId: string, requestedStart: number) {
    if (!scene || !selectedClip) return;
    const targetTrack = ensureLayerTrack(trackId);
    const next = moveClipToTrack(
      scene.clips,
      selectedClip.id,
      targetTrack,
      requestedStart,
      totalDuration
    );
    if (next) writeClipLayout(next);
  }

  function resizeSelectedClipFromInspector(duration: number) {
    if (!scene || !selectedClip) return;
    const requestedEnd = selectedClip.start + Math.max(1 / scene.canvas.fps, duration);
    const next = trimClipOnTrack(
      scene.clips,
      selectedClip.id,
      'end',
      requestedEnd,
      1 / scene.canvas.fps
    );
    writeClipLayout(next);
  }

  function handleTransitionDragStart(event: DragEvent) {
    draggingTransition = 'crossfade';
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('application/x-motionly-transition', 'crossfade');
      event.dataTransfer.setData('text/plain', 'Crossfade');
    }
  }

  function handleTransitionDragEnd() {
    draggingTransition = null;
  }

  function applyTransitionAtBoundary(
    boundary: ClipTransitionBoundary,
    duration = boundary.duration || 0.5
  ) {
    if (!ast || !scene) return;
    const transition = applyClipTransition(
      boundary.outgoing,
      boundary.incoming,
      duration,
      1 / scene.canvas.fps
    );
    if (!transition) return;
    const outgoingNode = clipNodeAt(
      scene.clips.findIndex((clip) => clip.id === boundary.outgoing.id)
    );
    const incomingNode = clipNodeAt(
      scene.clips.findIndex((clip) => clip.id === boundary.incoming.id)
    );
    if (!outgoingNode || !incomingNode) return;
    outgoingNode.properties = {
      ...outgoingNode.properties,
      transitionOut: transition.outgoing.transitionOut,
      transitionOutDuration: `${transition.duration.toFixed(3)}s`,
    };
    incomingNode.properties = {
      ...incomingNode.properties,
      transitionIn: transition.incoming.transitionIn,
      transitionInDuration: `${transition.duration.toFixed(3)}s`,
    };
    selectedElementId = '';
    selectedTransitionIds = {
      outgoingId: boundary.outgoing.id,
      incomingId: boundary.incoming.id,
    };
    code = serializeProgram(ast);
  }

  function dropTransition(event: DragEvent, boundary: ClipTransitionBoundary) {
    event.preventDefault();
    event.stopPropagation();
    if (!draggingTransition) return;
    applyTransitionAtBoundary(boundary);
    draggingTransition = null;
  }

  function selectTransition(boundary: ClipTransitionBoundary) {
    if (!boundary.type) {
      applyTransitionAtBoundary(boundary);
      return;
    }
    selectedElementId = '';
    selectedTransitionIds = {
      outgoingId: boundary.outgoing.id,
      incomingId: boundary.incoming.id,
    };
    setTime(boundary.at);
  }

  function removeSelectedTransition() {
    if (!ast || !scene || !selectedTransition) return;
    const outgoingNode = clipNodeAt(
      scene.clips.findIndex((clip) => clip.id === selectedTransition.outgoing.id)
    );
    const incomingNode = clipNodeAt(
      scene.clips.findIndex((clip) => clip.id === selectedTransition.incoming.id)
    );
    if (!outgoingNode || !incomingNode) return;
    const removed = removedClipTransitionProperties();
    const outgoingProperties = { ...outgoingNode.properties };
    const incomingProperties = { ...incomingNode.properties };
    for (const key of removed.outgoing) delete outgoingProperties[key];
    for (const key of removed.incoming) delete incomingProperties[key];
    outgoingNode.properties = outgoingProperties;
    incomingNode.properties = incomingProperties;
    selectedTransitionIds = null;
    code = serializeProgram(ast);
  }

  function timelineLaneRect(trackId: string): DOMRect | null {
    const lane = document.querySelector<HTMLElement>(
      `.track-lane[data-track="${CSS.escape(trackId)}"]`
    );
    return lane?.getBoundingClientRect() ?? null;
  }

  function laneTrackAtPoint(clientX: number, clientY: number): string | null {
    const hit = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    return hit?.closest<HTMLElement>('.track-lane[data-track]')?.dataset['track'] ?? null;
  }

  function updateClipDrag(pointer: PointerEvent) {
    if (!clipDrag || !scene) return;
    if (
      Math.abs(pointer.clientX - clipDrag.startClientX) > 3 ||
      Math.abs(pointer.clientY - clipDrag.startClientY) > 3
    ) clipDrag.moved = true;
    const targetTrackId = clipDrag.kind === 'audio'
      ? clipDrag.originTrackId
      : laneTrackAtPoint(pointer.clientX, pointer.clientY) ?? clipDrag.originTrackId;
    const rect = timelineLaneRect(targetTrackId);
    if (!rect) return;
    const pointerTime = ((pointer.clientX - rect.left) / rect.width) * totalDuration;
    const rawStart = Math.min(
      totalDuration,
      Math.max(0, snapTimelineTime(pointerTime - clipDrag.grabOffset, rect.width, clipDrag.id))
    );
    clipDrag = { ...clipDrag, ghostStart: rawStart, ghostTrackId: targetTrackId, valid: true };
  }

  function moveTimelineClip(event: PointerEvent, clip: Clip) {
    if (event.button !== 0 || !scene) return;
    event.preventDefault();
    event.stopPropagation();
    selectElement(clip.id, false);
    const rect = timelineLaneRect(String(clip.track));
    if (!rect) return;
    const grabTime = ((event.clientX - rect.left) / rect.width) * totalDuration;
    clipDrag = {
      id: clip.id,
      kind: 'clip',
      duration: clip.duration,
      grabOffset: grabTime - clip.start,
      originTrackId: String(clip.track),
      startClientX: event.clientX,
      startClientY: event.clientY,
      ghostStart: clip.start,
      ghostTrackId: String(clip.track),
      valid: true,
      moved: false,
    };
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      /* pointer capture is best-effort */
    }
    const move = (pointer: PointerEvent) => updateClipDrag(pointer);
    const stop = (pointer: PointerEvent) => {
      updateClipDrag(pointer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      commitClipDrag();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  }

  function commitClipDrag() {
    const drag = clipDrag;
    clipDrag = null;
    if (!drag || !scene || !drag.moved || !drag.valid) return;
    if (drag.kind === 'audio') {
      const node = ast?.body.find((candidate): candidate is AudioNode => candidate.type === 'Audio');
      if (!node || !ast) return;
      node.properties = { ...node.properties, start: `${drag.ghostStart.toFixed(3)}s` };
      code = serializeProgram(ast);
      return;
    }
    materializeTimelineLayers();
    if (drag.kind === 'clip') {
      const targetTrack = ensureLayerTrack(drag.ghostTrackId);
      beginHistoryGesture();
      detachClipTransitions(drag.id);
      const next = moveClipToTrack(
        scene.clips,
        drag.id,
        targetTrack,
        drag.ghostStart,
        totalDuration
      );
      if (next) writeClipLayout(next);
      endHistoryGesture();
      return;
    }
    commitElementDrag(
      drag.id,
      drag.ghostStart,
      drag.ghostStart + drag.duration,
      drag.ghostTrackId
    );
  }

  function commitElementDrag(
    id: string,
    start: number,
    end: number,
    trackId: string
  ) {
    if (!ast || !scene) return;
    const node = ast.body.find(
      (item): item is ElementNode => item.type === 'Element' && item.name === id
    );
    if (!node) return;
    const targetTrack = ensureLayerTrack(trackId);
    beginHistoryGesture();
    const previousStart = timelineRange(id).start;
    if (selectedElement?.id === id) materializeSelectedAnimation();
    moveElementClip(ast, id, start, end, previousStart, 1 / scene.canvas.fps);
    node.properties = {
      ...node.properties,
      track: targetTrack.id,
    };
    code = serializeProgram(ast);
    endHistoryGesture();
  }

  function moveTimelineElement(event: PointerEvent, element: Element) {
    if (event.button !== 0 || !ast || !scene) return;
    event.preventDefault();
    event.stopPropagation();
    selectElement(element.id, false);
    const node = ast.body.find(
      (item): item is ElementNode => item.type === 'Element' && item.name === element.id
    );
    if (!node) return;
    const range = timelineRange(element.id);
    const duration = range.end - range.start;
    // Use the element's actual rendered lane as the drag origin. Never mutate
    // the project here — that mid-gesture re-render would abort the drag.
    const originLane = (event.currentTarget as HTMLElement).closest<HTMLElement>('.track-lane[data-track]');
    const originTrackId =
      originLane?.dataset['track'] ??
      String(node.properties['track'] ?? scene.tracks.find((track) => track.role === 'overlay')?.id ?? defaultMainTrack);
    const rect = originLane?.getBoundingClientRect() ?? timelineLaneRect(originTrackId);
    if (!rect) return;
    const grabTime = ((event.clientX - rect.left) / rect.width) * totalDuration;
    clipDrag = {
      id: element.id,
      kind: 'element',
      duration,
      grabOffset: grabTime - range.start,
      originTrackId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      ghostStart: range.start,
      ghostTrackId: originTrackId,
      valid: true,
      moved: false,
    };
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      /* pointer capture is best-effort */
    }
    const move = (pointer: PointerEvent) => updateClipDrag(pointer);
    const stop = (pointer: PointerEvent) => {
      updateClipDrag(pointer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      commitClipDrag();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  }

  function moveTimelineAudio(event: PointerEvent) {
    if (event.button !== 0 || !scene || !projectAudioTrack) return;
    event.preventDefault();
    event.stopPropagation();
    const lane = (event.currentTarget as HTMLElement).closest<HTMLElement>('.track-lane[data-track]');
    const rect = lane?.getBoundingClientRect();
    if (!rect) return;
    const grabTime = ((event.clientX - rect.left) / rect.width) * totalDuration;
    clipDrag = {
      id: '__audio__',
      kind: 'audio',
      duration: audioDuration || totalDuration,
      grabOffset: grabTime - scene.audioStart,
      originTrackId: projectAudioTrack.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      ghostStart: scene.audioStart,
      ghostTrackId: projectAudioTrack.id,
      valid: true,
      moved: false,
    };
    const move = (pointer: PointerEvent) => updateClipDrag(pointer);
    const stop = (pointer: PointerEvent) => {
      updateClipDrag(pointer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      commitClipDrag();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  }

  function trimTimelineClip(event: PointerEvent, clip: Clip, edge: 'start' | 'end') {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    selectElement(clip.id, false);
    const lane = (event.currentTarget as HTMLElement).closest<HTMLElement>('.track-lane');
    if (!lane) return;
    beginHistoryGesture();
    const rect = lane.getBoundingClientRect();
    const minimum = 1 / (scene?.canvas.fps ?? 60);
    const move = (pointer: PointerEvent) => {
      const raw = ((pointer.clientX - rect.left) / rect.width) * totalDuration;
      const time = snapTimelineTime(raw, rect.width, clip.id);
      if (!scene) return;
      const next = trimClipOnTrack(
        scene.clips,
        clip.id,
        edge,
        time,
        minimum
      );
      writeClipLayout(next);
    };
    const stop = () => {
      endHistoryGesture();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  }

  function splitSelectedClip() {
    if (!ast || !scene) return;
    if (selectedClip) {
      const sceneIndex = scene.clips.findIndex((clip) => clip.id === selectedClip.id);
      const node = clipNodeAt(sceneIndex);
      const result = splitClip(selectedClip as ClipTiming, currentTime, 1 / scene.canvas.fps);
      if (!node || !result) return;
      detachClipTransitions(selectedClip.id);
      const [left, right] = result;
      const originalProperties = { ...node.properties };
      const timingProperties = (timing: ClipTiming) => ({
        start: `${timing.start.toFixed(3)}s`,
        duration: `${timing.duration.toFixed(3)}s`,
        trimIn: `${timing.trimIn.toFixed(3)}s`,
        trimOut: `${timing.trimOut.toFixed(3)}s`,
      });
      node.properties = { ...originalProperties, ...timingProperties(left) };
      const rightNode: ClipNode = {
        type: 'Clip',
        assetName: node.assetName,
        properties: { ...originalProperties, ...timingProperties(right) },
      };
      ast.body.splice(ast.body.indexOf(node) + 1, 0, rightNode);
      code = serializeProgram(ast);
      return;
    }

    if (!selectedElement) return;
    const range = timelineRange(selectedElement.id);
    let rightId = `${selectedElement.id}_split`;
    let suffix = 2;
    const names = new Set(
      ast.body.filter((node): node is ElementNode => node.type === 'Element').map((node) => node.name)
    );
    while (names.has(rightId)) rightId = `${selectedElement.id}_split_${suffix++}`;
    const result = splitElementClip(
      ast,
      selectedElement.id,
      currentTime,
      range,
      rightId,
      1 / scene.canvas.fps
    );
    if (!result) return;
    ast = result.program;
    selectedElementId = result.rightId;
    code = serializeProgram(ast);
  }

  function timelineTimeAt(clientX: number, rect: DOMRect): number {
    const raw = ((clientX - rect.left) / rect.width) * totalDuration;
    return snapTimelineTime(raw, rect.width);
  }

  function snapTimelineTime(raw: number, width: number, excludeClipId = ''): number {
    const clamped = Math.max(0, Math.min(totalDuration, raw));
    const fps = scene?.canvas.fps ?? 60;
    const frameTime = Math.round(clamped * fps) / fps;
    if (!snapEnabled) return frameTime;
    const candidates = [0, totalDuration, currentTime];
    for (const clip of scene?.clips ?? []) {
      if (clip.id === excludeClipId) continue;
      candidates.push(clip.start, clip.start + clip.duration);
    }
    for (const row of allTimelineRows) {
      for (const item of row.items) candidates.push(item.range.start, item.range.end);
    }
    const nearest = candidates.reduce((best, value) =>
      Math.abs(value - clamped) < Math.abs(best - clamped) ? value : best, 0);
    return Math.abs(nearest - clamped) <= (totalDuration * 8) / Math.max(1, width) ? nearest : frameTime;
  }

  function setTimelineZoom(nextZoom: number, anchorViewportX?: number) {
    const oldWidth = timelineScroll?.scrollWidth ?? timelineContentWidth;
    const viewportWidth = timelineScroll?.clientWidth ?? oldWidth;
    const anchor = anchorViewportX ?? viewportWidth / 2;
    const oldScroll = timelineScroll?.scrollLeft ?? 0;
    timelineZoom = clampTimelineZoom(nextZoom);
    requestAnimationFrame(() => {
      if (!timelineScroll) return;
      timelineScroll.scrollLeft = anchoredTimelineScroll(
        oldScroll,
        anchor,
        oldWidth,
        timelineScroll.scrollWidth,
        viewportWidth
      );
    });
  }

  function handleTimelineWheel(event: WheelEvent) {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const rect = timelineScroll.getBoundingClientRect();
    setTimelineZoom(timelineZoom * Math.exp(-event.deltaY * 0.002), event.clientX - rect.left);
  }

  function timelineTrackDisplayOrder(
    track: Track | null | undefined,
    trackId: string
  ): number {
    if (track?.role === 'audio') return 1_000_000;
    if (track) return track.order;
    const elementRow = allTimelineRows.findIndex((row) => row.trackId === trackId);
    return elementRow < 0 ? 9000 : 9000 + elementRow;
  }

  function timelineLaneLabel(row: TimelineLane): string {
    if (row.kind === 'text') return 'Text';
    if (row.kind === 'asset') return 'Images & video';
    if (row.kind === 'overlay') return 'Scenes';
    return 'Effects';
  }

  function elementCenter(element: Element | EvaluatedElement): { x: number; y: number } {
    const centered = isCentered(element);
    return {
      x: (centered ? canvasWidth / 2 : 0) + numericProperty(element, 'x', 0),
      y: (centered ? canvasHeight / 2 : 0) + numericProperty(element, 'y', 0),
    };
  }

  function elementBounds(element: Element | EvaluatedElement): { x: number; y: number; width: number; height: number } {
    if (element.kind === 'overlay' || element.kind === 'effect') {
      return { x: 0, y: 0, width: canvasWidth, height: canvasHeight };
    }
    const center = elementCenter(element);
    const scale = numericProperty(element, 'scale', 1);
    const width = estimateElementWidth(element) * scale;
    const height = estimateElementHeight(element) * scale;
    return {
      x: center.x - width / 2,
      y: center.y - height / 2,
      width,
      height,
    };
  }

  function selectedBounds(): { x: number; y: number; width: number; height: number } | null {
    if (!currentFrame || !selectedElementId) return null;
    const matches = currentFrame.elements.filter((element) => element.id === selectedElementId || propertiesOf(element)['textGroup'] === selectedElementId);
    if (!matches.length) return null;
    const visible = matches.filter((element) => Number(propertiesOf(element)['opacity'] ?? 1) > 0.001);
    const boxes = (visible.length ? visible : matches).map(elementBounds);
    const x = Math.min(...boxes.map((box) => box.x));
    const y = Math.min(...boxes.map((box) => box.y));
    const right = Math.max(...boxes.map((box) => box.x + box.width));
    const bottom = Math.max(...boxes.map((box) => box.y + box.height));
    return { x, y, width: right - x, height: bottom - y };
  }

  function estimateElementWidth(element: Element | EvaluatedElement): number {
    const explicit = numericProperty(element, 'width', 0);
    if (explicit > 0) return explicit;
    if (element.kind === 'text') {
      return Math.max(80, stringProperty(element, 'value', '').length * numericProperty(element, 'size', 64) * 0.52);
    }
    const asset = element.assetName ? assets.get(element.assetName) : null;
    return asset?.width ?? 200;
  }

  function estimateElementHeight(element: Element | EvaluatedElement): number {
    const explicit = numericProperty(element, 'height', 0);
    if (explicit > 0) return explicit;
    if (element.kind === 'text') return numericProperty(element, 'size', 64) * 1.2;
    const width = numericProperty(element, 'width', 0);
    const asset = element.assetName ? assets.get(element.assetName) : null;
    if (asset && width > 0) return asset.height * (width / asset.width);
    return asset?.height ?? 120;
  }

  function isCentered(element: Element | EvaluatedElement): boolean {
    return Boolean(propertiesOf(element)['center']);
  }

  function selectedAnimationAst(): AnimationNode | null {
    if (!ast || !selectedElement) return null;
    return ast.body.find(
      (node): node is AnimationNode => node.type === 'Animation' && node.target === selectedElement.id
    ) ?? null;
  }

  // GSAP easing options offered per keyframe.
  const KEYFRAME_EASINGS = [
    { value: 'linear', label: 'Linear' },
    { value: 'power1.in', label: 'Ease In' },
    { value: 'power1.out', label: 'Ease Out' },
    { value: 'power1.inOut', label: 'Ease In-Out' },
    { value: 'power3.out', label: 'Smooth Out' },
    { value: 'power3.inOut', label: 'Smooth In-Out' },
    { value: 'back.out', label: 'Back Out' },
    { value: 'elastic.out', label: 'Elastic Out' },
  ] as const;

  // Markers shown on the selected element's row. Explicit `animate` blocks show
  // their real keyframes; preset-driven animations (animation/textAnimation)
  // surface their compiled start/end (or keyframes) so every animated element
  // shows editable keyframes.
  function selectedKeyframeMarkers(): { offset: number; easing?: string }[] {
    const node = selectedAnimationAst();
    if (node?.keyframes?.length)
      return node.keyframes.map((frame) => ({ offset: frame.offset, easing: frame.easing }));
    if (node) {
      const animated =
        Object.keys(node.from ?? {}).length > 0 || Object.keys(node.to ?? {}).length > 0;
      if (animated) return [{ offset: 0 }, { offset: 1 }];
    }
    // Preset-driven animation compiled into the scene graph.
    if (selectedAnimation) {
      if (selectedAnimation.keyframes?.length)
        return selectedAnimation.keyframes.map((frame) => ({
          offset: frame.offset,
          easing: frame.easing,
        }));
      return [{ offset: 0 }, { offset: 1 }];
    }
    return [];
  }

  /**
   * Return an editable `animate` AST node for the selected element, converting a
   * preset (animation/textAnimation) into explicit keyframes on first edit so
   * timing and easing changes persist. Conversion is intentionally best-effort.
   */
  function materializeSelectedAnimation(): AnimationNode | null {
    if (!ast || !selectedElement) return null;
    const existing = selectedAnimationAst();
    if (existing) return existing;
    const compiled = selectedAnimation;
    if (!compiled) return null;
    const created: AnimationNode = {
      type: 'Animation',
      target: selectedElement.id,
      from: { ...(compiled.from ?? {}) },
      to: { ...(compiled.to ?? {}) },
      keyframes: (compiled.keyframes ?? []).map((frame) => ({
        offset: frame.offset,
        properties: { ...frame.properties },
        ...(frame.easing ? { easing: frame.easing } : {}),
      })),
      delay: compiled.delay ?? 0,
      duration: compiled.duration ?? 1,
      easing: compiled.easing ?? 'power3.out',
    };
    const elementNode = ast.body.find(
      (candidate): candidate is ElementNode =>
        candidate.type === 'Element' && candidate.name === selectedElement!.id
    );
    if (elementNode) {
      const props = { ...elementNode.properties };
      delete props['animation'];
      delete props['textAnimation'];
      elementNode.properties = props;
    }
    ast.body.push(created);
    return created;
  }

  /** Convert a from/to animation into explicit keyframes so edits persist. */
  function ensureSeededKeyframes(node: AnimationNode): void {
    if (!node.keyframes?.length) node.keyframes = seedKeyframes(node.keyframes, node.from, node.to);
  }

  function keyframeEasingAt(offset: number | null): string {
    if (offset === null) return '';
    const frame = selectedAnimationAst()?.keyframes?.find(
      (candidate) => Math.abs(candidate.offset - offset) < 1e-6
    );
    return frame?.easing ?? '';
  }

  function setSelectedKeyframeEasing(value: string) {
    const node = materializeSelectedAnimation();
    if (!ast || !node || selectedKeyframeOffset === null) return;
    ensureSeededKeyframes(node);
    node.keyframes = setKeyframeEasing(node.keyframes ?? [], selectedKeyframeOffset, value);
    code = serializeProgram(ast);
  }

  function deleteKeyframeAt(event: Event, offset: number) {
    event.preventDefault();
    event.stopPropagation();
    const node = selectedAnimationAst();
    if (!ast || !node?.keyframes?.length) return;
    node.keyframes = removeKeyframe(node.keyframes, offset);
    if (selectedKeyframeOffset !== null && Math.abs(selectedKeyframeOffset - offset) < 1e-6)
      selectedKeyframeOffset = null;
    code = serializeProgram(ast);
  }

  $: selectedKeyframeEasingValue =
    code && selectedKeyframeOffset !== null ? keyframeEasingAt(selectedKeyframeOffset) : '';

  function keyframeTime(offset: number): number {
    return (selectedAnimation?.delay ?? 0) + offset * (selectedAnimation?.duration ?? 1);
  }

  function capturedKeyframeProperties(keys?: string[]): Record<string, unknown> {
    const evaluated = currentFrame?.elements.find((element) => element.id === selectedElement?.id);
    const source = evaluated ? propertiesOf(evaluated) : selectedElement ? propertiesOf(selectedElement) : {};
    const defaults = ['x', 'y', 'scale', 'rotation', 'opacity', 'blur'];
    const names = keys?.length ? keys : defaults;
    return Object.fromEntries(
      names
        .filter((key) => typeof source[key] === 'number' || typeof source[key] === 'string')
        .map((key) => [key, source[key]])
    );
  }

  function addKeyframeAtPlayhead() {
    if (!ast || !selectedElement) return;
    let node = materializeSelectedAnimation();
    if (!node) {
      const base = capturedKeyframeProperties();
      node = {
        type: 'Animation',
        target: selectedElement.id,
        from: {},
        to: {},
        keyframes: [
          { offset: 0, properties: { ...base } },
          { offset: 1, properties: { ...base } },
        ],
        delay: 0,
        duration: totalDuration,
        easing: 'power3.out',
      };
      ast.body.push(node);
    } else {
      node.keyframes = seedKeyframes(node.keyframes, node.from, node.to);
    }
    const delay = selectedAnimation?.delay ?? Number(node.delay ?? 0);
    const duration = selectedAnimation?.duration ?? (Number(node.duration ?? totalDuration) || totalDuration);
    const offset = Math.min(1, Math.max(0, (currentTime - delay) / Math.max(duration, 1e-6)));
    const propertyKeys = Array.from(
      new Set((node.keyframes ?? []).flatMap((frame) => Object.keys(frame.properties)))
    );
    node.keyframes = upsertKeyframe(
      node.keyframes ?? [],
      offset,
      capturedKeyframeProperties(propertyKeys)
    );
    node.from = {};
    node.to = {};
    selectedKeyframeOffset = offset;
    code = serializeProgram(ast);
  }

  function deleteSelectedKeyframe() {
    const node = selectedAnimationAst();
    if (!node || selectedKeyframeOffset === null) return;
    node.keyframes = removeKeyframe(node.keyframes ?? [], selectedKeyframeOffset);
    selectedKeyframeOffset = null;
    code = serializeProgram(ast!);
  }

  function dragKeyframeMarker(event: PointerEvent, offset: number) {
    if (event.button !== 0 || !selectedAnimation) return;
    event.preventDefault();
    event.stopPropagation();
    const lane = (event.currentTarget as HTMLElement).closest<HTMLElement>('.track-lane');
    if (!lane) return;
    // Materialize preset/from-to animations into real keyframes before editing.
    const seedNode = materializeSelectedAnimation();
    if (seedNode && !seedNode.keyframes?.length) {
      ensureSeededKeyframes(seedNode);
    }
    code = serializeProgram(ast!);
    const rect = lane.getBoundingClientRect();
    const animationDelay = selectedAnimation.delay;
    const animationDuration = selectedAnimation.duration;
    let previousOffset = offset;
    selectedKeyframeOffset = offset;
    setTime(keyframeTime(offset));
    const move = (pointer: PointerEvent) => {
      const raw = ((pointer.clientX - rect.left) / rect.width) * totalDuration;
      const snappedTime = snapTimelineTime(raw, rect.width);
      const nextOffset = Math.min(
        1,
        Math.max(0, (snappedTime - animationDelay) / Math.max(animationDuration, 1e-6))
      );
      const node = selectedAnimationAst();
      if (!node) return;
      node.keyframes = moveKeyframe(node.keyframes ?? [], previousOffset, nextOffset);
      previousOffset = nextOffset;
      selectedKeyframeOffset = nextOffset;
      code = serializeProgram(ast!);
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  }

  function updateAnimationProperty(key: keyof AnimationNode, value: string | number) {
    if (!ast || !selectedElement) return;
    const node = ensureAnimationNode(ast, selectedElement.id);
    (node as unknown as Record<string, unknown>)[key] = value;
    code = serializeProgram(ast);
  }

  function addTextElement() {
    if (!ast) return;
    const name = nextElementName('text');
    ast.body.push({
      type: 'Element',
      kind: 'text',
      name,
      properties: {
        value: 'New text',
        center: true,
        y: (scene?.elements.length ?? 0) * 80,
        size: 64,
        color: '#ffffff',
        opacity: 1,
        start: '0s',
        duration: `${totalDuration.toFixed(3)}s`,
        track: defaultMainTrack,
      },
    });
    selectedElementId = name;
    code = serializeProgram(ast);
  }

  function applyPreset(preset: string) {
    if (!ast || !selectedElement) return;
    ast.body = ast.body.filter(
      (item) => !(item.type === 'Animation' && item.target === selectedElement!.id)
    );
    if (preset !== 'none') {
      const node = ensureAnimationNode(ast, selectedElement.id);
      if (preset === 'fade') {
        node.from = { opacity: 0 };
        node.to = { opacity: numericProperty(selectedElement, 'opacity', 1) };
      }
      if (preset === 'rise') {
        node.from = { opacity: 0, y: numericProperty(selectedElement, 'y', 0) + 80 };
        node.to = { opacity: numericProperty(selectedElement, 'opacity', 1), y: numericProperty(selectedElement, 'y', 0) };
      }
      if (preset === 'scale') {
        node.from = { opacity: 0, scale: 0.85 };
        node.to = { opacity: numericProperty(selectedElement, 'opacity', 1), scale: numericProperty(selectedElement, 'scale', 1) };
      }
      if (preset === 'blur') {
        node.from = { opacity: 0, blur: 12, y: numericProperty(selectedElement, 'y', 0) + 24 };
        node.to = { opacity: numericProperty(selectedElement, 'opacity', 1), blur: 0, y: numericProperty(selectedElement, 'y', 0) };
      }
      if (preset === 'drift') {
        node.from = { opacity: 0, x: numericProperty(selectedElement, 'x', 0) - 90 };
        node.to = { opacity: numericProperty(selectedElement, 'opacity', 1), x: numericProperty(selectedElement, 'x', 0) };
      }
      node.duration = selectedAnimation?.duration ?? 1;
      node.delay = selectedAnimation?.delay ?? 0;
      node.easing = selectedAnimation?.easing ?? 'power3.out';
    }
    code = serializeProgram(ast);
  }

  function isBasicPreset(preset: string): boolean {
    const from = selectedAnimation?.from;
    if (!from) return false;
    if (preset === 'fade') return from['opacity'] === 0 && from['y'] === undefined && from['scale'] === undefined && from['blur'] === undefined && from['x'] === undefined;
    if (preset === 'rise') return from['opacity'] === 0 && typeof from['y'] === 'number';
    if (preset === 'scale') return from['opacity'] === 0 && from['scale'] === 0.85;
    if (preset === 'blur') return typeof from['blur'] === 'number' && from['blur'] > 0;
    if (preset === 'drift') return typeof from['x'] === 'number';
    return false;
  }

  function canApplyLibraryPreset(preset: AnimationPresetDef): boolean {
    if (preset.category === 'camera') return true;
    if (!selectedElement) return false;
    if (preset.category === 'text') return selectedElement.kind === 'text';
    if (preset.category === 'object') return selectedElement.kind === 'asset';
    return selectedElement.kind === 'asset' || selectedElement.kind === 'overlay';
  }

  function applyLibraryPreset(preset: AnimationPresetDef) {
    if (!ast || !canApplyLibraryPreset(preset)) return;
    if (preset.category === 'camera') {
      let camera = ast.body.find((node): node is CameraNode => node.type === 'Camera');
      if (!camera) {
        camera = { type: 'Camera', properties: {} };
        ast.body.push(camera);
      }
      camera.properties = { ...camera.properties, cameraAnimation: `${preset.name}(duration 1s ease power3.out)` };
    } else if (selectedElement) {
      const node = ast.body.find((item): item is ElementNode => item.type === 'Element' && item.name === selectedElement.id);
      if (!node) return;
      const key = preset.category === 'text' ? 'textAnimation' : 'animation';
      node.properties = { ...node.properties, [key]: `${preset.name}(duration 800ms ease power3.out)` };
    }
    code = serializeProgram(ast);
  }

  function ensureAnimationNode(program: ProgramNode, target: string): AnimationNode {
    const existing = program.body.find(
      (item): item is AnimationNode => item.type === 'Animation' && item.target === target
    );
    if (existing) return existing;
    const node: AnimationNode = {
      type: 'Animation',
      target,
      from: { opacity: 0 },
      to: { opacity: 1 },
      keyframes: [],
      delay: 0,
      duration: 1,
      easing: 'soft',
    };
    program.body.push(node);
    return node;
  }

  function nextElementName(prefix: string): string {
    const names = new Set(scene?.elements.map((element) => element.id) ?? []);
    let index = names.size + 1;
    let name = `${prefix}${index}`;
    while (names.has(name)) {
      index += 1;
      name = `${prefix}${index}`;
    }
    return name;
  }

</script>

<div class="motion-editor" class:fullscreen={isFullscreen} style={`--timeline-height: ${timelineHeight}px`}>
  <div class="workbench" class:chat-open={showAiChat}>
    <!-- Navigation Rail -->
    <nav class="nav-rail">
      <button 
        type="button" 
        class="nav-item" 
        class:active={activeNavTab === 'media'}
        on:click={() => activeNavTab = 'media'}
        title="Media / Assets"
      >
        <FolderOpen size={20} />
      </button>
      <button 
        type="button" 
        class="nav-item" 
        class:active={activeNavTab === 'audio'}
        on:click={() => activeNavTab = 'audio'}
        title="Audio"
      >
        <Headphones size={20} />
      </button>
      <button 
        type="button" 
        class="nav-item" 
        class:active={activeNavTab === 'text'}
        on:click={() => activeNavTab = 'text'}
        title="Text"
      >
        <Type size={20} />
      </button>
      <button 
        type="button" 
        class="nav-item" 
        class:active={activeNavTab === 'effects'}
        on:click={() => activeNavTab = 'effects'}
        title="Effects"
      >
        <Wand2 size={20} />
      </button>
      <button 
        type="button" 
        class="nav-item" 
        class:active={activeNavTab === 'scenes'}
        on:click={() => activeNavTab = 'scenes'}
        title="Scenes"
      >
        <Layers3 size={20} />
      </button>
      <button 
        type="button" 
        class="nav-item" 
        class:active={activeNavTab === 'ai'}
        on:click={() => activeNavTab = 'ai'}
        title="AI Config"
      >
        <Bot size={20} />
      </button>
      <button 
        type="button" 
        class="nav-item" 
        class:active={activeNavTab === 'settings'}
        on:click={() => activeNavTab = 'settings'}
        title="Settings"
      >
        <Settings size={20} />
      </button>
    </nav>

    <!-- Assets/Content Panel -->
    <aside class="content-panel">
      {#if activeNavTab === 'media'}
        <div class="panel-header">
          <div class="panel-tabs">
            <button 
              type="button" 
              class="panel-tab" 
              class:active={mediaSubTab === 'assets'}
              on:click={() => mediaSubTab = 'assets'}
            >
              Assets
            </button>
            <button 
              type="button" 
              class="panel-tab" 
              class:active={mediaSubTab === 'presets'}
              on:click={() => mediaSubTab = 'presets'}
            >
              Presets
            </button>
          </div>
          {#if mediaSubTab === 'assets'}
            <div class="panel-header-actions">
              <input bind:this={assetInput} class="file-input" type="file" accept="image/*,video/mp4,video/webm,.svg,.mp4,.webm,.m4v" multiple on:change={handleAssetUpload} />
            </div>
          {/if}
        </div>
        <div class="panel-content">
          {#if mediaSubTab === 'assets'}
            <div
              class="media-dropzone"
              class:drag-active={isDraggingUpload}
              role="region"
              aria-label="Import media by dropping files"
              on:dragenter={handleAssetFileDrag}
              on:dragover|preventDefault={handleAssetFileDrag}
              on:dragleave={handleAssetFileDragLeave}
              on:drop={handleAssetFileDrop}
            >
              {#if assetError}<p class="asset-error">{assetError}</p>{/if}
              <div class="media-drop-prompt">
                <button type="button" class="import-media-button" on:click={() => assetInput.click()}>
                  <Upload size={15} />
                  Import media
                </button>
                <span>or drag & drop from your device</span>
                <small>Images, SVG, MP4, and WebM</small>
              </div>
            <!-- Audio Section -->
            {#if scene?.audio}
              <div class="asset-folder">
                <div class="folder-header">
                  <Music2 size={14} />
                  <span class="folder-title">Audio</span>
                </div>
                <div class="folder-content">
                  <div class="asset-item">
                    <div class="asset-item-icon">
                      <Music2 size={16} />
                    </div>
                    <div class="asset-item-info">
                      <div class="asset-item-name">{scene.audio.substring(scene.audio.lastIndexOf('/') + 1)}</div>
                      <div class="asset-item-path">{scene.audio}</div>
                    </div>
                  </div>
                </div>
              </div>
            {/if}

            <!-- Visual Assets Section -->
            {#if scene && scene.imports.length > 0}
              <div class="asset-folder">
                <div class="folder-header">
                  <FileImage size={14} />
                  <span class="folder-title">Media</span>
                  <span class="folder-count">{scene.imports.length}</span>
                </div>
                <div class="asset-grid">
                  {#each scene.imports as asset}
                    <button
                      type="button"
                      class="asset-card"
                      draggable="true"
                      on:click={() => previewAssetOnly(asset)}
                      on:dragstart={(e) => handleAssetDragStart(e, asset)}
                      on:dragend={handleAssetDragEnd}
                    >
                      <div class="asset-thumbnail">
                        {#if asset.type === 'video'}
                          <video src={assets.get(asset.name)?.src ?? asset.path} muted playsinline preload="metadata"></video>
                        {:else if asset.path}
                          <img src={assets.get(asset.name)?.src ?? asset.path} alt={asset.name} />
                        {:else}
                          <FileImage size={24} />
                        {/if}
                      </div>
                      <div class="asset-info">
                        <div class="asset-name">{asset.name}</div>
                      </div>
                    </button>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Empty State -->
            {#if !scene?.audio && scene?.imports.length === 0}
              <p class="empty-state">Imported media will stay here until you drag it onto the timeline.</p>
            {/if}
            </div>
          {:else if mediaSubTab === 'presets'}
            <div class="preset-grid">
              {#each availablePresets as preset}
                <button
                  type="button"
                  class="preset-card"
                  on:click={() => requestPresetLoad(preset.path)}
                >
                  <div class="preset-thumbnail">
                    <img src={preset.gifPath} alt={preset.name} />
                  </div>
                  <div class="preset-info">
                    <div class="preset-name">{preset.name}</div>
                  </div>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {:else if activeNavTab === 'audio'}
        <div class="panel-header">
          <h3 class="panel-heading-title">Audio</h3>
          <div class="panel-header-actions">
            <button type="button" class="header-icon-btn" on:click={() => audioInput.click()} title="Import audio">
              <Upload size={16} />
            </button>
          </div>
        </div>
        <div class="panel-content">
          {#if audioName}
            <div class="audio-item">
              <Music2 size={18} />
              <span>{audioName}</span>
              <button class="icon-btn" on:click={removeAudio} title="Remove audio"><Trash2 size={14} /></button>
            </div>
          {:else}
            <p class="empty-state">No audio attached</p>
          {/if}
        </div>
      {:else if activeNavTab === 'text'}
        <div class="panel-header">
          <h3 class="panel-heading-title">Text</h3>
          <div class="panel-header-actions">
            <button type="button" class="header-icon-btn" on:click={addTextElement} title="Add text">
              <Plus size={16} />
            </button>
          </div>
        </div>
        <div class="panel-content">
          <div class="layer-list">
            {#each sourceElements.filter(el => el.kind === 'text') as element}
              <button
                type="button"
                class="layer-row"
                class:selected={selectedElementId === element.id}
                on:click={() => selectElement(element.id)}
              >
                <span class="layer-icon">
                  <Type size={14} />
                </span>
                <span class="layer-copy">
                  <strong>{element.id}</strong>
                  <small>{elementDetail(element)}</small>
                </span>
              </button>
            {/each}
          </div>
        </div>
      {:else if activeNavTab === 'effects'}
        <div class="panel-header">
          <h3 class="panel-heading-title">Effects</h3>
        </div>
        <div class="panel-content">
          <div class="effects-categories">
            <div class="effects-category">
              <div class="category-title">Text Effects</div>
              <div class="effects-list">
                {#each ANIMATION_PRESETS.filter(p => p.category === 'text') as preset}
                  <button type="button" class="effect-item" title={preset.description} disabled={!canApplyLibraryPreset(preset)} on:click={() => applyLibraryPreset(preset)}>
                    <Sparkles size={14} />
                    <span>{preset.name}</span>
                  </button>
                {/each}
              </div>
            </div>
            <div class="effects-category">
              <div class="category-title">Object Effects</div>
              <div class="effects-list">
                {#each ANIMATION_PRESETS.filter(p => p.category === 'object') as preset}
                  <button type="button" class="effect-item" title={preset.description} disabled={!canApplyLibraryPreset(preset)} on:click={() => applyLibraryPreset(preset)}>
                    <Sparkles size={14} />
                    <span>{preset.name}</span>
                  </button>
                {/each}
              </div>
            </div>
            <div class="effects-category">
              <div class="category-title">Clip Transitions</div>
              <p class="category-hint">Drag onto a cut between two touching clips.</p>
              <div class="effects-list">
                <button
                  type="button"
                  class="effect-item transition-effect-item"
                  draggable="true"
                  title="Fade the outgoing clip into the incoming clip"
                  on:dragstart={handleTransitionDragStart}
                  on:dragend={handleTransitionDragEnd}
                >
                  <Wand2 size={14} />
                  <span><strong>Crossfade</strong><small>Fade both clips</small></span>
                </button>
              </div>
            </div>
            <div class="effects-category">
              <div class="category-title">Scene Transitions</div>
              <div class="effects-list">
                {#each ANIMATION_PRESETS.filter(p => p.category === 'transition') as preset}
                  <button type="button" class="effect-item" title={preset.description} disabled={!canApplyLibraryPreset(preset)} on:click={() => applyLibraryPreset(preset)}>
                    <Wand2 size={14} />
                    <span>{preset.name}</span>
                  </button>
                {/each}
              </div>
            </div>
            <div class="effects-category">
              <div class="category-title">Camera</div>
              <div class="effects-list">
                {#each ANIMATION_PRESETS.filter(p => p.category === 'camera') as preset}
                  <button type="button" class="effect-item" title={preset.description} disabled={!canApplyLibraryPreset(preset)} on:click={() => applyLibraryPreset(preset)}>
                    <Maximize2 size={14} />
                    <span>{preset.name}</span>
                  </button>
                {/each}
              </div>
            </div>
          </div>
        </div>
      {:else if activeNavTab === 'scenes'}
        <div class="panel-header">
          <h3 class="panel-heading-title">Scenes</h3>
        </div>
        <div class="panel-content">
          <p class="panel-description">
            Backgrounds, overlays, and full-canvas effects that define the visual context of your animation. Use scenes to create atmosphere, transitions, and environmental layers.
          </p>
          <div class="layer-list">
            {#each sourceElements.filter(el => el.kind === 'effect' || el.kind === 'overlay') as element}
              <button
                type="button"
                class="layer-row"
                class:selected={selectedElementId === element.id}
                on:click={() => selectElement(element.id)}
              >
                <span class="layer-icon">
                  <Square size={14} />
                </span>
                <span class="layer-copy">
                  <strong>{element.id}</strong>
                  <small>{elementDetail(element)}</small>
                </span>
              </button>
            {/each}
          </div>
        </div>
      {:else if activeNavTab === 'ai'}
        <div class="panel-header">
          <h3 class="panel-heading-title">AI Config</h3>
        </div>
        <AiConfigPanel assetList={assistantAssets} projectInfo={aiProjectInfo} />
      {:else if activeNavTab === 'settings'}
        <div class="panel-header">
          <h3 class="panel-heading-title">Settings</h3>
        </div>
        <BrandConfigPanel assetList={assistantAssets} />
      {/if}
    </aside>

    <aside class="chat-drawer" class:collapsed={!showAiChat}>
      {#if showAiChat}
        <AiChatPanel project={code} assetList={assistantAssets} onLoadMotion={loadGeneratedMotion} onCollapse={() => showAiChat = false} />
      {:else}
        <button type="button" class="assistant-expand" on:click={() => showAiChat = true} title="Open Motionly Assistant" aria-label="Open Motionly Assistant">
          <Sparkles size={16} />
        </button>
      {/if}
    </aside>

    <main class="preview-container">
      <div class="stage-meta">
        <span>{canvasWidth} x {canvasHeight}</span>
        <div class="stage-actions">
          <button type="button" class="meta-btn" on:click={fitPreview}>Fit</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" class="icon-btn" on:click={toggleFullscreen} title="Fullscreen preview">
            <Maximize2 size={15} />
          </button>
        </div>
      </div>
      <div bind:this={stage} class="stage">
        <div class="canvas-shell" style={canvasStyle}>
          <canvas
            bind:this={canvas}
            width={canvasWidth}
            height={canvasHeight}
            class="preview-canvas"
            class:dragging={Boolean(dragState)}
            on:pointerdown={handleCanvasPointerDown}
            on:pointermove={handleCanvasPointerMove}
            on:pointerup={handleCanvasPointerUp}
            on:pointercancel={handleCanvasPointerUp}
          ></canvas>
          {#if snapGuides.vertical !== null}
            <span class="snap-guide snap-guide-v" style={`left: ${(snapGuides.vertical / canvasWidth) * 100}%`}></span>
          {/if}
          {#if snapGuides.horizontal !== null}
            <span class="snap-guide snap-guide-h" style={`top: ${(snapGuides.horizontal / canvasHeight) * 100}%`}></span>
          {/if}
        </div>
        {#if previewAsset}
          <div class="asset-preview-overlay">
            {#if previewAsset.type === 'video'}
              <video src={previewAsset.src} controls autoplay muted playsinline></video>
            {:else}
              <img src={previewAsset.src} alt="Asset preview" />
            {/if}
            <button type="button" class="asset-preview-close" on:click={clearAssetPreview} aria-label="Close asset preview"><X size={18} /></button>
          </div>
        {/if}
      </div>
      {#if parseError}
        <div class="error-banner">{parseError}</div>
      {:else if exportError}
        <div class="error-banner">{exportError}</div>
      {/if}
    </main>

    <aside class="properties-panel">
      <div class="panel-title">Properties</div>
      {#if selectedTransition}
        <div class="selection-summary transition-summary">
          <span class="layer-icon"><Wand2 size={15} /></span>
          <span><strong>Crossfade</strong><small>{selectedTransition.outgoing.assetName} → {selectedTransition.incoming.assetName}</small></span>
        </div>
        <div class="property-group">
          <div class="property-label">Duration</div>
          <div class="number-input-wrapper">
            <input
              class="number-input"
              type="number"
              min="0.05"
              max={Math.min(selectedTransition.outgoing.duration, selectedTransition.incoming.duration)}
              step="0.05"
              value={selectedTransition.duration}
              on:change={(event) => applyTransitionAtBoundary(selectedTransition, Number(event.currentTarget.value))}
            />
            <span class="input-suffix">s</span>
          </div>
        </div>
        <div class="transition-pair-copy">
          <span><small>Outgoing</small><strong>{selectedTransition.outgoing.assetName}</strong></span>
          <span class="transition-pair-arrow">→</span>
          <span><small>Incoming</small><strong>{selectedTransition.incoming.assetName}</strong></span>
        </div>
        <button type="button" class="timeline-command transition-remove" on:click={removeSelectedTransition}>
          Remove transition
        </button>
      {:else if selectedElement}
        <div class="selection-summary">
          <span class="layer-icon">
            {#if selectedElement.kind === 'asset' && selectedElement.asset?.type === 'video'}<Video size={15} />
            {:else if selectedElement.kind === 'asset' && selectedElement.asset?.path}<img src={assets.get(selectedElement.assetName ?? '')?.src ?? selectedElement.asset.path} alt="" />
            {:else if selectedElement.kind === 'text'}<Type size={15} />
            {:else if selectedElement.kind === 'asset'}<FileImage size={15} />
            {:else if selectedElement.kind === 'effect'}<Sparkles size={15} />
            {:else}<Square size={15} />{/if}
          </span>
          <span><strong>{selectedElement.id}</strong><small>{elementDetail(selectedElement)}</small></span>
        </div>

        {#if selectedElement.kind === 'asset' || selectedElement.kind === 'text'}
          <div class="property-align-toolbar">
            <span class="property-align-label">Align to canvas</span>
            <div class="property-align-actions" aria-label="Align selected layer to canvas">
              <button type="button" on:click={() => alignSelected('left')} title="Align left" aria-label="Align left"><AlignHorizontalJustifyStart size={15} /></button>
              <button type="button" on:click={() => alignSelected('center-x')} title="Align horizontal center" aria-label="Align horizontal center"><AlignHorizontalJustifyCenter size={15} /></button>
              <button type="button" on:click={() => alignSelected('right')} title="Align right" aria-label="Align right"><AlignHorizontalJustifyEnd size={15} /></button>
              <span class="align-divider"></span>
              <button type="button" on:click={() => alignSelected('top')} title="Align top" aria-label="Align top"><AlignVerticalJustifyStart size={15} /></button>
              <button type="button" on:click={() => alignSelected('center-y')} title="Align vertical center" aria-label="Align vertical center"><AlignVerticalJustifyCenter size={15} /></button>
              <button type="button" on:click={() => alignSelected('bottom')} title="Align bottom" aria-label="Align bottom"><AlignVerticalJustifyEnd size={15} /></button>
            </div>
          </div>
        {/if}
        
        <div class="property-group">
          <div class="property-label">Position</div>
          <div class="property-row">
            <div class="number-input-wrapper">
              <input class="number-input" type="number" value={numericProperty(selectedElement, 'x', 0)} on:input={(e) => updateElementProperty('x', Number(e.currentTarget.value))} />
              <span class="input-suffix">x</span>
            </div>
            <div class="number-input-wrapper">
              <input class="number-input" type="number" value={numericProperty(selectedElement, 'y', 0)} on:input={(e) => updateElementProperty('y', Number(e.currentTarget.value))} />
              <span class="input-suffix">y</span>
            </div>
          </div>
        </div>

        <div class="property-group">
          <div class="property-label">Scale</div>
          <div class="slider-control">
            <input 
              class="custom-slider" 
              type="range" 
              min="0" 
              max="3" 
              step="0.01" 
              value={numericProperty(selectedElement, 'scale', 1)} 
              on:input={(e) => updateElementProperty('scale', Number(e.currentTarget.value))} 
            />
            <input 
              class="slider-value-input" 
              type="number" 
              min="0" 
              step="0.01" 
              value={numericProperty(selectedElement, 'scale', 1).toFixed(2)} 
              on:input={(e) => updateElementProperty('scale', Number(e.currentTarget.value))} 
            />
          </div>
        </div>

        {#if selectedElement.kind === 'asset'}
          <div class="property-group">
            <div class="property-label-row">
              <div class="property-label">Width</div>
              <button type="button" class="property-action" on:click={resetElementSize}>Original size</button>
            </div>
            <div class="number-input-wrapper">
              <input class="number-input" type="number" min="1" step="1" value={numericProperty(selectedElement, 'width', estimateElementWidth(selectedElement))} on:input={(e) => updateElementProperty('width', Number(e.currentTarget.value))} />
              <span class="input-suffix">px</span>
            </div>
          </div>
        {/if}

        <div class="property-group">
          <div class="property-label">Rotation</div>
          <div class="slider-control">
            <input 
              class="custom-slider" 
              type="range" 
              min="-180" 
              max="180" 
              step="1" 
              value={numericProperty(selectedElement, 'rotation', 0)} 
              on:input={(e) => updateElementProperty('rotation', Number(e.currentTarget.value))} 
            />
            <input 
              class="slider-value-input" 
              type="number" 
              min="-180" 
              max="180" 
              value={numericProperty(selectedElement, 'rotation', 0)} 
              on:input={(e) => updateElementProperty('rotation', Number(e.currentTarget.value))} 
            />
          </div>
        </div>

        <div class="property-group">
          <div class="property-label">Opacity</div>
          <div class="slider-control">
            <input 
              class="custom-slider" 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value={numericProperty(selectedElement, 'opacity', 1)} 
              on:input={(e) => updateElementProperty('opacity', Number(e.currentTarget.value))} 
            />
            <input 
              class="slider-value-input" 
              type="number" 
              min="0" 
              max="100" 
              value={Math.round(numericProperty(selectedElement, 'opacity', 1) * 100)} 
              on:input={(e) => updateElementProperty('opacity', Number(e.currentTarget.value) / 100)} 
            />
          </div>
        </div>

        {#if selectedElement.kind === 'overlay'}
          <div class="property-group">
          <div class="property-label">Background</div>
            <input class="color-input" type="color" value={stringProperty(selectedElement, 'fill', '#000000')} on:input={(e) => updateElementProperty('fill', e.currentTarget.value)} />
          </div>
        {/if}

        {#if selectedElement.kind === 'text'}
          <div class="property-group">
          <div class="property-label">Text</div>
            <textarea class="text-input" rows="3" value={stringProperty(selectedElement, 'value', '')} on:input={(e) => updateElementProperty('value', e.currentTarget.value)}></textarea>
          </div>
          <div class="property-group">
          <div class="property-label">Font Size</div>
            <div class="number-input-wrapper">
              <input class="number-input" type="number" min="1" value={numericProperty(selectedElement, 'size', 72)} on:input={(e) => updateElementProperty('size', Number(e.currentTarget.value))} />
              <span class="input-suffix">px</span>
            </div>
          </div>
          <div class="property-group">
          <div class="property-label">Color</div>
            <input class="color-input" type="color" value={stringProperty(selectedElement, 'color', '#ffffff')} on:input={(e) => updateElementProperty('color', e.currentTarget.value)} />
          </div>
        {/if}

        <div class="section-title">Layer Mask</div>
        <div class="property-group">
          <div class="property-label">Use layer as alpha</div>
          <select
            class="text-input mask-select"
            value={stringProperty(selectedElement, 'mask', 'none')}
            on:change={(event) => updateElementProperty('mask', event.currentTarget.value)}
          >
            <option value="none">None</option>
            {#each sourceElements.filter((candidate) => candidate.id !== selectedElement?.id) as candidate}
              <option value={candidate.id}>{candidate.id}</option>
            {/each}
          </select>
        </div>
        {#if stringProperty(selectedElement, 'mask', 'none') !== 'none'}
          <label class="toggle-row">
            <input type="checkbox" checked={Boolean(propertiesOf(selectedElement)['maskInvert'])} on:change={(event) => updateElementProperty('maskInvert', event.currentTarget.checked)} />
            <span>Invert alpha</span>
          </label>
          <label class="toggle-row">
            <input type="checkbox" checked={Boolean(propertiesOf(selectedElement)['maskVisible'])} on:change={(event) => updateElementProperty('maskVisible', event.currentTarget.checked)} />
            <span>Show mask layer</span>
          </label>
        {/if}

        <div class="section-title">Adjustments</div>
        {#each adjustmentControls as control}
          <div class="property-group">
            <div class="property-label">{control.label}</div>
            <div class="slider-control">
              <input
                class="custom-slider"
                type="range"
                min={control.min}
                max={control.max}
                step={control.step}
                value={numericProperty(selectedElement, control.property, control.fallback)}
                on:input={(event) => updateElementProperty(control.property, Number(event.currentTarget.value))}
              />
              <input
                class="slider-value-input"
                type="number"
                min={control.min}
                max={control.max}
                step={control.step}
                value={numericProperty(selectedElement, control.property, control.fallback)}
                on:input={(event) => updateElementProperty(control.property, Number(event.currentTarget.value))}
              />
            </div>
          </div>
        {/each}

        <div class="section-title">Keyframes</div>
        <div class="property-group keyframe-controls">
          <button type="button" class="timeline-command" on:click={addKeyframeAtPlayhead}>◆ Add at playhead</button>
          {#if selectedKeyframeOffset !== null}
            <div class="number-input-wrapper">
              <input
                class="number-input"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={Number((selectedKeyframeOffset * 100).toFixed(1))}
                on:change={(event) => {
                  const node = selectedAnimationAst();
                  if (node && selectedKeyframeOffset !== null) {
                    const next = Math.min(1, Math.max(0, Number(event.currentTarget.value) / 100));
                    node.keyframes = moveKeyframe(node.keyframes ?? [], selectedKeyframeOffset, next);
                    selectedKeyframeOffset = next;
                    code = serializeProgram(ast!);
                  }
                }}
              />
              <span class="input-suffix">%</span>
            </div>
            <button type="button" class="icon-btn danger-btn" on:click={deleteSelectedKeyframe} title="Delete selected keyframe"><Trash2 size={14} /></button>
          {/if}
        </div>
        {#if selectedKeyframeOffset !== null}
          <div class="property-group">
            <div class="property-label">Keyframe easing (into this keyframe)</div>
            <select
              class="text-input"
              value={selectedKeyframeEasingValue}
              on:change={(event) => setSelectedKeyframeEasing(event.currentTarget.value)}
            >
              <option value="">Animation default</option>
              {#each KEYFRAME_EASINGS as option}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </div>
        {/if}

        <div class="section-title">Animation</div>
        
        <div class="property-group">
          <div class="property-label">Preset</div>
          <div class="preset-cards">
            <button 
              type="button" 
              class="preset-option" 
              class:active={!selectedAnimation}
              on:click={() => applyPreset('none')}
            >
              None
            </button>
            <button 
              type="button" 
              class="preset-option" 
              class:active={isBasicPreset('fade')}
              on:click={() => applyPreset('fade')}
            >
              Fade
            </button>
            <button 
              type="button" 
              class="preset-option" 
              class:active={isBasicPreset('rise')}
              on:click={() => applyPreset('rise')}
            >
              Rise
            </button>
            <button 
              type="button" 
              class="preset-option" 
              class:active={isBasicPreset('scale')}
              on:click={() => applyPreset('scale')}
            >
              Scale
            </button>
            <button 
              type="button" 
              class="preset-option" 
              class:active={isBasicPreset('blur')}
              on:click={() => applyPreset('blur')}
            >
              Blur
            </button>
            <button 
              type="button" 
              class="preset-option" 
              class:active={isBasicPreset('drift')}
              on:click={() => applyPreset('drift')}
            >
              Drift
            </button>
          </div>
        </div>

        <div class="property-group">
          <div class="property-label">Duration</div>
          <div class="number-input-wrapper">
            <input class="number-input" type="number" min="0.1" step="0.1" value={selectedAnimation?.duration ?? 1} on:input={(e) => updateAnimationProperty('duration', Number(e.currentTarget.value))} />
            <span class="input-suffix">s</span>
          </div>
        </div>

        <div class="property-group">
          <div class="property-label">Delay</div>
          <div class="number-input-wrapper">
            <input class="number-input" type="number" min="0" step="0.1" value={selectedAnimation?.delay ?? 0} on:input={(e) => updateAnimationProperty('delay', Number(e.currentTarget.value))} />
            <span class="input-suffix">s</span>
          </div>
        </div>

        <div class="property-group">
          <div class="property-label">Easing</div>
          <div class="easing-options">
            {#each ['soft', 'power3.out', 'linear', 'ease-out', 'spring', 'smooth'] as easingOption}
              <button 
                type="button" 
                class="easing-option" 
                class:active={(selectedAnimation?.easing ?? 'soft') === easingOption}
                on:click={() => updateAnimationProperty('easing', easingOption)}
              >
                {easingOption}
              </button>
            {/each}
          </div>
          <input
            class="text-input easing-input"
            type="text"
            value={String(selectedAnimation?.easing ?? 'soft')}
            placeholder="power3.out or cubic-bezier(...)"
            on:change={(event) => updateAnimationProperty('easing', event.currentTarget.value)}
            aria-label="Custom animation easing"
          />
        </div>
      {:else if selectedClip}
        <div class="selection-summary">
          <span class="layer-icon">
            {#if selectedClip.asset?.type === 'video'}<Video size={15} />
            {:else if selectedClip.asset?.path}<img src={assets.get(selectedClip.assetName)?.src ?? selectedClip.asset.path} alt="" />
            {:else}<FileImage size={15} />{/if}
          </span>
          <span><strong>{selectedClip.assetName}</strong><small>Timeline clip</small></span>
        </div>
        <button type="button" class="timeline-command clip-original-size" on:click={resetElementSize}>Original size</button>
        <div class="property-group">
          <div class="property-label">Track</div>
          <select class="text-input" value={String(selectedClip.track)} on:change={(event) => moveSelectedClipFromInspector(event.currentTarget.value, selectedClip.start)}>
            {#each (scene?.tracks ?? []).filter((track) => track.role !== 'audio' && (track.role === 'main' || track.content === (selectedClip.asset?.type === 'video' ? 'video' : 'image') || track.content === 'mixed')) as track}
              <option value={track.id}>{track.label} · {track.role}</option>
            {/each}
          </select>
        </div>
        <div class="property-group">
          <div class="property-label">Start</div>
          <div class="number-input-wrapper">
            <input class="number-input" type="number" min="0" max={totalDuration} step="0.01" value={selectedClip.start} on:change={(event) => moveSelectedClipFromInspector(String(selectedClip.track), Number(event.currentTarget.value))} />
            <span class="input-suffix">s</span>
          </div>
        </div>
        <div class="property-group">
          <div class="property-label">Duration</div>
          <div class="number-input-wrapper">
            <input class="number-input" type="number" min="0.05" max={totalDuration} step="0.05" value={selectedClip.duration} on:change={(event) => resizeSelectedClipFromInspector(Number(event.currentTarget.value))} />
            <span class="input-suffix">s</span>
          </div>
        </div>
        <div class="property-group">
          <div class="property-label">Trim In</div>
          <div class="number-input-wrapper">
            <input class="number-input" type="number" min="0" step="0.01" value={selectedClip.trimIn} on:input={(event) => updateClip(selectedClip.id, { trimIn: `${Math.max(0, Number(event.currentTarget.value))}s` })} />
            <span class="input-suffix">s</span>
          </div>
        </div>
        <div class="property-group">
          <div class="property-label">Trim Out</div>
          <div class="number-input-wrapper">
            <input class="number-input" type="number" min="0" step="0.01" value={selectedClip.trimOut} on:input={(event) => updateClip(selectedClip.id, { trimOut: `${Math.max(0, Number(event.currentTarget.value))}s` })} />
            <span class="input-suffix">s</span>
          </div>
        </div>
        <button
          type="button"
          class="timeline-command"
          disabled={currentTime <= selectedClip.start || currentTime >= selectedClip.start + selectedClip.duration}
          on:click={splitSelectedClip}
        >Split at playhead</button>
      {:else}
        <p class="empty">No object selected.</p>
      {/if}
    </aside>
  </div>

  <section class="timeline-panel">
    <button
      type="button"
      class="timeline-resizer"
      aria-label="Resize timeline"
      title="Drag to resize timeline"
      on:pointerdown={resizeTimeline}
      on:keydown={resizeTimelineWithKeyboard}
    ><span></span></button>
    <div class="timeline-toolbar">
      <div class="playback-controls">
        <button on:click={reset} class="control-btn" title="Go to start">
          <SkipBack size={17} />
        </button>
        <button on:click={isPlaying ? pause : play} class="control-btn play-btn" title={isPlaying ? 'Pause' : 'Play'}>
          {#if isPlaying}<Pause size={19} />{:else}<Play size={19} />{/if}
        </button>
        <span class="timecode">{formatPreciseTime(currentTime)}</span>
        <span class="framecode">Frame {displayFrame}</span>
      </div>

      <div class="timeline-context">
        <Layers3 size={14} />
        <span>{selectedElement?.id ?? selectedClip?.assetName ?? 'Timeline'}</span>
      </div>

      <div class="timeline-actions">
        <input bind:this={audioInput} class="file-input" type="file" accept="audio/*" on:change={handleAudioSelected} />
        {#if audioName}
          <span class="audio-chip"><Music2 size={13} /> {audioName}</span>
          <button class="icon-btn" on:click={removeAudio} title="Remove audio"><Trash2 size={14} /></button>
        {:else}
          <button class="timeline-command" on:click={() => audioInput.click()} title="Attach audio"><Upload size={14} /> Audio</button>
        {/if}
        {#if selectedElement || selectedClip}
          <button class="icon-btn danger-btn" on:click={deleteSelectedElement} title="Delete selected layer"><Trash2 size={14} /></button>
        {/if}
        <button class="icon-btn" on:click={undoEditor} disabled={editorHistory.past.length === 0} title="Undo (Ctrl/Cmd+Z)"><Undo2 size={14} /></button>
        <button class="icon-btn" on:click={redoEditor} disabled={editorHistory.future.length === 0} title="Redo (Ctrl/Cmd+Shift+Z)"><Redo2 size={14} /></button>
        <button class="icon-btn" on:click={splitSelectedClip} disabled={!((selectedClip && currentTime > selectedClip.start && currentTime < selectedClip.start + selectedClip.duration) || (selectedElement && currentTime > timelineRange(selectedElement.id).start && currentTime < timelineRange(selectedElement.id).end))} title="Split selected clip at playhead"><Scissors size={14} /></button>
        <button class="icon-btn" class:active={snapEnabled} on:click={() => snapEnabled = !snapEnabled} title={snapEnabled ? 'Disable edge snapping' : 'Enable edge snapping'}><Magnet size={15} /></button>
        <button on:click={() => setTimelineZoom(timelineZoom / 1.25)} class="icon-btn" title="Timeline zoom out"><Minus size={15} /></button>
        <span class="timeline-zoom-value">{Math.round(timelineZoom * 100)}%</span>
        <button on:click={() => setTimelineZoom(timelineZoom * 1.25)} class="icon-btn" title="Timeline zoom in"><Plus size={15} /></button>
      </div>
    </div>

    <div 
      bind:this={timelineScroll}
      class="timeline-scroll" 
      style={`--timeline-content-width: ${timelineContentWidth}px`}
      class:drop-target={draggingAsset !== null}
      role="region"
      aria-label="Timeline tracks"
      on:dragover={handleTimelineDragOver}
      on:drop={handleTimelineDrop}
      on:dragleave={() => dropTargetTime = null}
      on:wheel={handleTimelineWheel}
    >
      <div class="ruler-row">
        <div class="track-label ruler-label">Layers</div>
        <div class="ruler">
          {#each timelineTicks as tick}
            <span class="ruler-tick" style={`left: ${timelinePercent(tick)}%`}>{formatTime(tick)}</span>
          {/each}
          <span class="playhead-marker" style={`left: ${timelinePercent(currentTime)}%`}></span>
          {#if dropTargetTime !== null}
            <span class="drop-indicator" style={`left: ${timelinePercent(dropTargetTime)}%`}></span>
          {/if}
          <input class="timeline-scrubber" type="range" min="0" max={totalDuration} step={1 / (scene?.canvas.fps ?? 60)} value={currentTime} on:input={seek} aria-label="Timeline scrubber" />
        </div>
      </div>

      {#each timelineRows as row}
        {@const rowTrack = scene?.tracks.find((track) => track.id === row.trackId)}
        <div
          class="timeline-row"
          class:selected={row.items.some((item) => item.element.id === selectedElementId)}
          style={`min-height: ${row.laneCount * 34 + 8}px; order: ${timelineTrackDisplayOrder(rowTrack, row.trackId)}`}
        >
          <div class="track-label" class:track-hidden={rowTrack?.hidden}>
            <span class="track-thumb">
              {#if row.items[0].element.kind === 'asset' && row.items[0].element.asset?.type === 'video'}<Video size={12} />
              {:else if row.items[0].element.kind === 'asset' && row.items[0].element.asset?.path}<img src={assets.get(row.items[0].element.assetName ?? '')?.src ?? row.items[0].element.asset.path} alt="" />
              {:else if row.kind === 'text'}<Type size={12} />
              {:else if row.kind === 'effect'}<Sparkles size={12} />
              {:else}<Square size={12} />{/if}
            </span>
            <span class="track-copy">
              <strong>{timelineLaneLabel(row)}</strong>
              <small>{row.items.length} {row.items.length === 1 ? 'element' : 'elements'}{row.laneCount > 1 ? ` · ${row.laneCount} stacked` : ''}</small>
            </span>
            {#if rowTrack}
              <span class="track-controls">
                <button type="button" class="track-control" class:active={rowTrack.hidden} on:click|stopPropagation={() => updateTrack(rowTrack, { hidden: !rowTrack.hidden })} title={rowTrack.hidden ? 'Show track' : 'Hide track'}>
                  {#if rowTrack.hidden}<EyeOff size={13} />{:else}<Eye size={13} />{/if}
                </button>
              </span>
            {:else}
              <span class="track-time">{formatPreciseTime(row.start)} - {formatPreciseTime(row.end)}</span>
            {/if}
          </div>
          <div class="track-lane" data-track={row.trackId} style={`min-height: ${row.laneCount * 34 + 7}px`}>
            {#if clipDrag && clipDrag.ghostTrackId === row.trackId}
              <span class="clip-ghost" class:invalid={!clipDrag.valid} style={`left: ${timelinePercent(clipDrag.ghostStart)}%; width: ${Math.max(0.8, timelinePercent(clipDrag.duration))}%`}></span>
              {#if clipDrag.kind === 'element' && clipDrag.id === selectedElementId && !row.items.some((item) => item.element.id === selectedElementId)}
                {#each selectedKeyframeMarkers() as frame}
                  <span class="keyframe-marker drag-keyframe" style={`left: ${timelinePercent(keyframeTime(frame.offset) + keyframeDragDelta)}%; top: 19.5px`} aria-hidden="true"></span>
                {/each}
              {/if}
            {/if}
            {#each row.items as item}
              <span class="clip element-clip" class:selected-clip={item.element.id === selectedElementId} style={`left: ${timelinePercent(item.range.start)}%; width: ${Math.max(0.8, timelinePercent(item.range.end - item.range.start))}%; top: ${6 + item.lane * 34}px`}>
                {#if item.element.kind === 'asset' && item.element.asset?.type === 'video'}
                  <span class="clip-media video-clip-media"><Video size={13} /></span>
                {:else if item.element.kind === 'asset' && item.element.asset?.path}
                  <span
                    class="clip-media"
                    style={`background-image: url('${assets.get(item.element.assetName ?? '')?.src ?? item.element.asset.path}')`}
                  ></span>
                {:else if item.element.kind === 'text'}
                  <span class="clip-text">{stringProperty(item.element, 'value', item.element.id)}</span>
                {:else if item.element.kind === 'overlay'}
                  <span class="clip-color" style={`background: ${stringProperty(item.element, 'fill', '#34404e')}`}></span>
                {/if}
                <button type="button" class="clip-select" on:pointerdown={(event) => moveTimelineElement(event, item.element)} on:click={() => selectElement(item.element.id, false)} aria-label={`Select or move ${item.element.id}`}></button>
                <button type="button" class="trim-handle trim-start" on:pointerdown={(event) => trimElement(event, item.element.id, 'start')} aria-label={`Trim start of ${item.element.id}`}></button>
                <button type="button" class="trim-handle trim-end" on:pointerdown={(event) => trimElement(event, item.element.id, 'end')} aria-label={`Trim end of ${item.element.id}`}></button>
              </span>
            {/each}
            {#if row.items.some((item) => item.element.id === selectedElementId) && !(clipDrag?.kind === 'element' && clipDrag.id === selectedElementId && clipDrag.ghostTrackId !== row.trackId)}
              {@const kfLane = row.items.find((item) => item.element.id === selectedElementId)?.lane ?? 0}
              {#each selectedKeyframeMarkers() as frame}
                <button
                  type="button"
                  class="keyframe-marker"
                  class:selected-keyframe={selectedKeyframeOffset !== null && Math.abs(selectedKeyframeOffset - frame.offset) < 0.000001}
                  style={`left: ${timelinePercent(keyframeTime(frame.offset) + keyframeDragDelta)}%; top: ${6 + kfLane * 34 + 13.5}px`}
                  title={`Keyframe ${Math.round(frame.offset * 100)}%${frame.easing ? ' · ' + frame.easing : ''} — drag to retime, right-click to delete`}
                  aria-label={`Keyframe at ${Math.round(frame.offset * 100)} percent`}
                  on:pointerdown={(event) => dragKeyframeMarker(event, frame.offset)}
                  on:contextmenu={(event) => deleteKeyframeAt(event, frame.offset)}
                ></button>
              {/each}
              <button
                type="button"
                class="keyframe-add"
                style={`left: ${timelinePercent(currentTime)}%; top: ${6 + kfLane * 34 + 13.5}px`}
                title="Add keyframe at playhead"
                aria-label="Add keyframe at playhead"
                on:pointerdown|stopPropagation
                on:click|stopPropagation={addKeyframeAtPlayhead}
              >+</button>
            {/if}
            <span class="playhead" style={`left: ${timelinePercent(currentTime)}%`}></span>
          </div>
        </div>
      {/each}

      {#each timelineClipTracks as clipTrack}
          <div class="timeline-row clip-row" class:selected={clipTrack.clips.some(({ clip }) => clip.id === selectedElementId) || clipTrack.elements.some(({ item }) => item.element.id === selectedElementId)} style={`min-height: ${clipTrack.laneCount * 34 + 8}px; order: ${timelineTrackDisplayOrder(clipTrack.metadata, String(clipTrack.track))}`}>
            <div class="track-label" class:track-hidden={clipTrack.metadata?.hidden}>
              <span class="track-thumb">
                {#if clipTrack.metadata?.role === 'audio'}
                  <Music2 size={12} />
                {:else if clipTrack.clips[0]?.clip.asset?.type === 'video'}
                  <Video size={12} />
                {:else if clipTrack.clips[0]?.clip.asset?.path}
                  <img src={assets.get(clipTrack.clips[0].clip.assetName)?.src ?? clipTrack.clips[0].clip.asset?.path} alt="" />
                {:else}
                  <Layers3 size={12} />
                {/if}
              </span>
              <span class="track-copy">
                <strong>{clipTrack.metadata?.label ?? `Legacy Track ${clipTrack.track}`}</strong>
                <small>{clipTrack.metadata?.role ?? 'overlay'} · {clipTrack.clips.length + clipTrack.elements.length} {clipTrack.clips.length + clipTrack.elements.length === 1 ? 'item' : 'items'}</small>
              </span>
              {#if clipTrack.metadata}
                <span class="track-controls">
                  {#if clipTrack.metadata.role !== 'audio'}
                    <button type="button" class="track-control" class:active={clipTrack.metadata.hidden} on:click|stopPropagation={() => updateTrack(clipTrack.metadata!, { hidden: !clipTrack.metadata!.hidden })} title={clipTrack.metadata.hidden ? 'Show track' : 'Hide track'} aria-label={clipTrack.metadata.hidden ? 'Show track' : 'Hide track'}>
                      {#if clipTrack.metadata.hidden}<EyeOff size={13} />{:else}<Eye size={13} />{/if}
                    </button>
                  {/if}
                  {#if clipTrack.metadata.role === 'audio' || clipTrack.metadata.role === 'main' || clipTrack.metadata.content === 'video'}
                    <button type="button" class="track-control" class:active={clipTrack.metadata.muted} on:click|stopPropagation={() => updateTrack(clipTrack.metadata!, { muted: !clipTrack.metadata!.muted })} title={clipTrack.metadata.muted ? 'Unmute track' : 'Mute track'} aria-label={clipTrack.metadata.muted ? 'Unmute track' : 'Mute track'}>
                      {#if clipTrack.metadata.muted}<VolumeX size={13} />{:else}<Volume2 size={13} />{/if}
                    </button>
                  {/if}
                </span>
              {/if}
            </div>
            <div class="track-lane" data-track={clipTrack.track} style={`min-height: ${clipTrack.laneCount * 34 + 7}px`}>
              {#if clipDrag && clipDrag.ghostTrackId === String(clipTrack.track)}
                <span class="clip-ghost" class:invalid={!clipDrag.valid} style={`left: ${timelinePercent(clipDrag.ghostStart)}%; width: ${Math.max(0.8, timelinePercent(clipDrag.duration))}%`}></span>
                {#if clipDrag.kind === 'element' && clipDrag.id === selectedElementId && !clipTrack.elements.some(({ item }) => item.element.id === selectedElementId)}
                  {#each selectedKeyframeMarkers() as frame}
                    <span class="keyframe-marker drag-keyframe" style={`left: ${timelinePercent(keyframeTime(frame.offset) + keyframeDragDelta)}%; top: 19.5px`} aria-hidden="true"></span>
                  {/each}
                {/if}
              {/if}
              {#if clipTrack.metadata?.id === projectAudioTrack?.id && audioName}
                <span class="clip audio-clip" style={`left: ${timelinePercent(scene?.audioStart ?? 0)}%; width: ${timelinePercent(Math.min(audioDuration || totalDuration, Math.max(0, totalDuration - (scene?.audioStart ?? 0))))}%; top: 6px`}>
                  <span class="clip-text">{audioName}</span>
                  <button type="button" class="clip-select" on:pointerdown={moveTimelineAudio} aria-label={`Move audio ${audioName}`}></button>
                </span>
              {/if}
              {#each clipTrack.elements as packedElement}
                {@const item = packedElement.item}
                <span class="clip element-clip" class:selected-clip={item.element.id === selectedElementId} style={`left: ${timelinePercent(item.range.start)}%; width: ${Math.max(0.8, timelinePercent(item.range.end - item.range.start))}%; top: ${6 + packedElement.lane * 34}px`}>
                  {#if item.element.kind === 'asset' && item.element.asset?.type === 'video'}
                    <span class="clip-media video-clip-media"><Video size={13} /></span>
                  {:else if item.element.kind === 'asset' && item.element.asset?.path}
                    <span class="clip-media" style={`background-image: url('${assets.get(item.element.assetName ?? '')?.src ?? item.element.asset.path}')`}></span>
                  {:else if item.element.kind === 'text'}
                    <span class="clip-text">{stringProperty(item.element, 'value', item.element.id)}</span>
                  {:else if item.element.kind === 'overlay'}
                    <span class="clip-color" style={`background: ${stringProperty(item.element, 'fill', '#34404e')}`}></span>
                  {:else}
                    <span class="clip-text">{item.element.id}</span>
                  {/if}
                  <button type="button" class="clip-select" on:pointerdown={(event) => moveTimelineElement(event, item.element)} on:click={() => selectElement(item.element.id, false)} aria-label={`Select or move ${item.element.id}`}></button>
                  <button type="button" class="trim-handle trim-start" on:pointerdown={(event) => trimElement(event, item.element.id, 'start')} aria-label={`Trim start of ${item.element.id}`}></button>
                  <button type="button" class="trim-handle trim-end" on:pointerdown={(event) => trimElement(event, item.element.id, 'end')} aria-label={`Trim end of ${item.element.id}`}></button>
                </span>
              {/each}
              {#if clipTrack.elements.some(({ item }) => item.element.id === selectedElementId) && !(clipDrag?.kind === 'element' && clipDrag.id === selectedElementId && clipDrag.ghostTrackId !== String(clipTrack.track))}
                {@const kfLane = clipTrack.elements.find(({ item }) => item.element.id === selectedElementId)?.lane ?? 0}
                {#each selectedKeyframeMarkers() as frame}
                  <button
                    type="button"
                    class="keyframe-marker"
                    class:selected-keyframe={selectedKeyframeOffset !== null && Math.abs(selectedKeyframeOffset - frame.offset) < 0.000001}
                    style={`left: ${timelinePercent(keyframeTime(frame.offset) + keyframeDragDelta)}%; top: ${6 + kfLane * 34 + 13.5}px`}
                    title={`Keyframe ${Math.round(frame.offset * 100)}%${frame.easing ? ' · ' + frame.easing : ''} — drag to retime, right-click to delete`}
                    aria-label={`Keyframe at ${Math.round(frame.offset * 100)} percent`}
                    on:pointerdown={(event) => dragKeyframeMarker(event, frame.offset)}
                    on:contextmenu={(event) => deleteKeyframeAt(event, frame.offset)}
                  ></button>
                {/each}
                <button
                  type="button"
                  class="keyframe-add"
                  style={`left: ${timelinePercent(currentTime)}%; top: ${6 + kfLane * 34 + 13.5}px`}
                  title="Add keyframe at playhead"
                  aria-label="Add keyframe at playhead"
                  on:pointerdown|stopPropagation
                  on:click|stopPropagation={addKeyframeAtPlayhead}
                >+</button>
              {/if}
              {#each clipTrack.clips as packedClip}
                {@const clip = packedClip.clip}
                <span class="clip timeline-clip" class:selected-clip={clip.id === selectedElementId} style={`left: ${timelinePercent(clip.start)}%; width: ${Math.max(0.8, timelinePercent(clip.duration))}%; top: ${6 + packedClip.lane * 34}px`}>
                  {#if clip.asset?.type === 'video'}
                    <span class="clip-media video-clip-media"><Video size={13} /></span>
                  {:else if clip.asset?.path}
                    <span
                      class="clip-media"
                      style={`background-image: url('${assets.get(clip.assetName)?.src ?? clip.asset.path}')`}
                    ></span>
                  {:else}
                    <span class="clip-text">{clip.assetName}</span>
                  {/if}
                  {#if clip.trimIn > 0 || clip.trimOut > 0}
                    <span class="clip-trim-label">↤ {clip.trimIn.toFixed(2)}s · {clip.trimOut.toFixed(2)}s ↦</span>
                  {/if}
                  <button type="button" class="clip-select" on:pointerdown={(event) => moveTimelineClip(event, clip)} on:click={() => selectElement(clip.id, false)} aria-label={`Select ${clip.assetName} clip`}></button>
                  <button type="button" class="trim-handle trim-start" on:pointerdown={(event) => trimTimelineClip(event, clip, 'start')} aria-label={`Trim start of ${clip.assetName}`}></button>
                  <button type="button" class="trim-handle trim-end" on:pointerdown={(event) => trimTimelineClip(event, clip, 'end')} aria-label={`Trim end of ${clip.assetName}`}></button>
                  <button type="button" class="clip-delete" on:click|stopPropagation={() => deleteClip(clip.id)} title="Delete clip">
                    <X size={12} />
                  </button>
                </span>
              {/each}
              {#each transitionBoundaries.filter((boundary) => String(boundary.outgoing.track) === String(clipTrack.track)) as boundary}
                <button
                  type="button"
                  class="transition-cut"
                  class:has-transition={boundary.type !== null}
                  class:drop-ready={draggingTransition !== null}
                  class:selected-transition={selectedTransition?.outgoing.id === boundary.outgoing.id && selectedTransition?.incoming.id === boundary.incoming.id}
                  style={`left: ${timelinePercent(boundary.at)}%`}
                  title={boundary.type ? `Crossfade · ${boundary.duration.toFixed(2)}s` : 'Drop a transition here'}
                  aria-label={boundary.type ? `Select crossfade between ${boundary.outgoing.assetName} and ${boundary.incoming.assetName}` : `Add transition between ${boundary.outgoing.assetName} and ${boundary.incoming.assetName}`}
                  on:dragover|preventDefault|stopPropagation
                  on:drop={(event) => dropTransition(event, boundary)}
                  on:click|stopPropagation={() => selectTransition(boundary)}
                >
                  {boundary.type ? '×' : '+'}
                </button>
              {/each}
              <span class="playhead" style={`left: ${timelinePercent(currentTime)}%`}></span>
            </div>
          </div>
      {/each}

    </div>

    <audio bind:this={audioElement} on:loadedmetadata={() => (audioDuration = audioElement.duration)}></audio>
  </section>

  <button on:click={toggleCodeEditor} class="source-toggle" title={showCodeEditor ? 'Hide .motion source' : 'Show .motion source'}>
    .motion
  </button>

  {#if showCodeEditor}
    <div class="code-overlay">
      <div class="code-panel">
        <div class="code-header">
          <h3>.motion source</h3>
          <button on:click={toggleCodeEditor} class="close-btn">
            <X size={20} />
          </button>
        </div>

        <textarea
          bind:value={code}
          placeholder=".motion source"
          spellcheck="false"
          class="code-textarea"
        ></textarea>

        {#if parseError}
          <div class="error-banner">
            ⚠️ {parseError}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<!-- Confirmation Dialog -->
{#if showConfirmDialog}
  <div class="dialog-overlay" on:click={cancelLoadPreset} on:keydown={(e) => e.key === 'Escape' && cancelLoadPreset()} role="button" tabindex="-1">
    <div class="dialog" on:click|stopPropagation on:keydown={(e) => e.key === 'Enter' && confirmLoadPreset()} role="dialog" aria-labelledby="dialog-title" aria-modal="true" tabindex="0">
      <div class="dialog-header">
        <h3 id="dialog-title">Load Preset</h3>
        <button type="button" class="dialog-close" on:click={cancelLoadPreset}>
          <X size={18} />
        </button>
      </div>
      <div class="dialog-body">
        <p>Loading this preset will replace your current project and assets. Continue?</p>
      </div>
      <div class="dialog-footer">
        <button type="button" class="dialog-btn secondary" on:click={cancelLoadPreset}>
          Cancel
        </button>
        <button type="button" class="dialog-btn danger" on:click={confirmLoadPreset}>
          Load Preset
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .motion-editor {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #09090a;
    color: #f1f2f4;
    position: relative;
    min-height: 0;
    overflow: hidden;
  }

  .motion-editor.fullscreen {
    position: fixed;
    inset: 0;
    z-index: 200;
  }

  .workbench {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 52px 260px 50px minmax(0, 1fr) 300px;
  }

  .workbench.chat-open {
    grid-template-columns: 52px 260px 324px minmax(0, 1fr) 300px;
  }

  .chat-drawer {
    box-sizing: border-box;
    display: flex;
    min-width: 0;
    min-height: 0;
    padding: 8px;
    overflow: hidden;
    background:
      linear-gradient(90deg, rgba(255, 255, 255, 0.026) 1px, transparent 1px),
      linear-gradient(rgba(255, 255, 255, 0.026) 1px, transparent 1px),
      #0b0c0e;
    background-size: 32px 32px;
  }

  .chat-drawer :global(.ai-chat-panel) {
    flex: 1;
    height: auto;
    border: 1px solid #2a2d33;
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 14px 34px rgba(0, 0, 0, 0.28);
  }

  .chat-drawer.collapsed {
    display: flex;
    justify-content: center;
    padding-top: 14px;
  }

  .assistant-expand {
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    padding: 0;
    border: 1px solid #355e4f;
    border-radius: 6px;
    background: #17231f;
    color: #7cf7c5;
    cursor: pointer;
  }

  /* Navigation Rail */
  .nav-rail {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 6px;
    background: #0a0b0c;
    border-right: 1px solid #1c1d20;
  }

  .nav-item {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .nav-item:hover {
    background: #17191c;
    color: #9ca3af;
  }

  .nav-item.active {
    background: #1a2f28;
    color: #7cf7c5;
    box-shadow: inset 2px 0 0 #7cf7c5;
  }

  /* Content Panel (Assets, Audio, Text, etc.) */
  .content-panel {
    display: flex;
    flex-direction: column;
    background: #111214;
    border-right: 1px solid #24262a;
    min-height: 0;
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid #1c1d20;
    background: #0d0e10;
  }

  .panel-heading-title {
    color: #e4e6ea;
    font-size: 13px;
    font-weight: 600;
    margin: 0;
  }

  .panel-header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .header-icon-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #2a2d33;
    border-radius: 6px;
    background: #17191c;
    color: #a8adb5;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .header-icon-btn:hover {
    background: #202328;
    color: #d8dce2;
  }

  .panel-content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 12px;
    scrollbar-width: thin;
    scrollbar-color: #34373d #111214;
  }

  .empty-state {
    color: #6b7280;
    font-size: 12px;
    text-align: center;
    padding: 24px 16px;
  }

  .asset-error {
    margin: 0 0 12px;
    color: #f09b9b;
    font-size: 11px;
    line-height: 1.4;
  }

  .media-dropzone {
    min-height: 100%;
    box-sizing: border-box;
    padding: 18px 12px;
    border: 1px dashed #4b5060;
    border-radius: 8px;
    color: #b9b8e8;
    text-align: center;
    transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
  }

  .media-drop-prompt {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 7px;
    margin-bottom: 16px;
  }

  .media-dropzone.drag-active {
    border-color: #79e4bb;
    background: rgba(77, 140, 117, 0.16);
    animation: upload-pulse 0.8s ease-in-out infinite alternate;
  }

  @keyframes upload-pulse {
    to {
      transform: scale(1.015);
      box-shadow: 0 0 18px rgba(121, 228, 187, 0.2);
    }
  }

  .media-dropzone:has(.import-media-button:hover) {
    border-color: #4d8c75;
  }

  .media-drop-prompt span,
  .media-drop-prompt small {
    font-size: 11px;
  }

  .media-drop-prompt small {
    color: #777b88;
  }

  .import-media-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    width: 100%;
    padding: 9px 12px;
    border: 1px solid #4d8c75;
    border-radius: 6px;
    background: #1a3b30;
    color: #9af8d1;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .import-media-button:hover {
    background: #1a3028;
  }

  @media (prefers-reduced-motion: reduce) {
    .media-dropzone.drag-active {
      animation: none;
    }
  }

  .panel-description {
    color: #8e939b;
    font-size: 12px;
    line-height: 1.6;
    padding: 0 0 16px 0;
    margin: 0 0 16px 0;
    border-bottom: 1px solid #1c1d20;
  }

  /* Asset Folders */
  .asset-folder {
    margin-bottom: 20px;
  }

  .folder-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
    margin-bottom: 10px;
    color: #8e939b;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .folder-title {
    flex: 1;
  }

  .folder-count {
    color: #6b7280;
    font-size: 10px;
    font-weight: 600;
    background: #1a1c20;
    padding: 2px 6px;
    border-radius: 10px;
  }

  .folder-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  /* Asset Item (for list view like audio) */
  .asset-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    border: 1px solid #2a2d33;
    border-radius: 6px;
    background: #0d0e10;
    transition: all 0.15s ease;
  }

  .asset-item:hover {
    background: #17191c;
    border-color: #363d4b;
  }

  .asset-item-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #17191c;
    border: 1px solid #2a2d33;
    border-radius: 6px;
    color: #7cf7c5;
  }

  .asset-item-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .asset-item-name {
    color: #e4e6ea;
    font-size: 12px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .asset-item-path {
    color: #6b7280;
    font-size: 10px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Asset Grid */
  .asset-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 8px;
  }

  .asset-card {
    display: flex;
    flex-direction: column;
    border: 1px solid transparent;
    border-radius: 6px;
    background: #0d0e10;
    cursor: pointer;
    transition: all 0.15s ease;
    overflow: hidden;
    padding: 0;
  }

  .asset-card:hover {
    background: #17191c;
    border-color: #2a2d33;
  }

  .asset-thumbnail {
    width: 100%;
    aspect-ratio: 16 / 9;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #17191c;
    color: #6b7280;
    overflow: hidden;
  }

  .asset-thumbnail img,
  .asset-thumbnail video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .asset-info {
    padding: 8px;
  }

  .asset-name {
    color: #d8dce2;
    font-size: 11px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Audio Item */
  .audio-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px;
    border: 1px solid #2a2d33;
    border-radius: 6px;
    background: #0d0e10;
    color: #d8dce2;
    font-size: 13px;
  }

  /* Panel Tabs */
  .panel-tabs {
    display: flex;
    gap: 2px;
  }

  .panel-tab {
    padding: 6px 12px;
    border: none;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: #6b7280;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .panel-tab:hover {
    color: #9ca3af;
  }

  .panel-tab.active {
    color: #7cf7c5;
    border-bottom-color: #7cf7c5;
  }

  /* Preset Grid */
  .preset-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 12px;
  }

  .preset-card {
    display: flex;
    flex-direction: column;
    border: 1px solid #2a2d33;
    border-radius: 8px;
    background: #0d0e10;
    cursor: pointer;
    transition: all 0.15s ease;
    overflow: hidden;
    padding: 0;
  }

  .preset-card:hover {
    background: #17191c;
    border-color: #33584d;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .preset-thumbnail {
    width: 100%;
    aspect-ratio: 16 / 9;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #000;
    overflow: hidden;
  }

  .preset-thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .preset-info {
    padding: 10px;
  }

  .preset-name {
    color: #e4e6ea;
    font-size: 12px;
    font-weight: 600;
    text-align: center;
  }

  /* Effects Categories */
  .effects-categories {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .effects-category {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .category-title {
    color: #8e939b;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .category-hint {
    margin: -2px 0 2px;
    color: #686e77;
    font-size: 10px;
    line-height: 1.35;
  }

  .effects-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .effect-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    color: #d8dce2;
    font-size: 12px;
    text-align: left;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .effect-item:hover {
    background: #1a1c20;
    border-color: #2a2d33;
  }

  .effect-item:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }

  .effect-item span {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .transition-effect-item {
    border-color: #315449;
    background: linear-gradient(135deg, rgba(124, 247, 197, 0.12), rgba(124, 247, 197, 0.03));
    cursor: grab;
  }

  .transition-effect-item:active { cursor: grabbing; }
  .transition-effect-item span { display: flex; flex-direction: column; gap: 2px; }
  .transition-effect-item strong { color: #e9fff6; font-size: 11px; }
  .transition-effect-item small { color: #79827f; font-size: 9px; }

  /* Dialog */
  .dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
  }

  .dialog {
    width: 90%;
    max-width: 440px;
    background: #17191c;
    border: 1px solid #2a2d33;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
    overflow: hidden;
  }

  .dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid #24262a;
  }

  .dialog-header h3 {
    margin: 0;
    color: #e4e6ea;
    font-size: 16px;
    font-weight: 600;
  }

  .dialog-close {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: #9ca3af;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .dialog-close:hover {
    background: #24262a;
    color: #e4e6ea;
  }

  .dialog-body {
    padding: 20px;
  }

  .dialog-body p {
    margin: 0;
    color: #d8dce2;
    font-size: 14px;
    line-height: 1.6;
  }

  .dialog-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    padding: 16px 20px;
    border-top: 1px solid #24262a;
    background: #111214;
  }

  .dialog-btn {
    padding: 8px 16px;
    border: 1px solid #2a2d33;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .dialog-btn.secondary {
    background: transparent;
    color: #d8dce2;
  }

  .dialog-btn.secondary:hover {
    background: #24262a;
  }

  .dialog-btn.danger {
    background: #ef4444;
    color: #ffffff;
    border-color: #ef4444;
  }

  .dialog-btn.danger:hover {
    background: #dc2626;
  }

  .properties-panel {
    min-height: 0;
    overflow: auto;
    background: #111214;
    border-color: #24262a;
    padding: 14px;
    scrollbar-width: thin;
    scrollbar-color: #34373d #111214;
    border-left: 1px solid #24262a;
  }

  .panel-title,
  .section-title {
    color: #8e939b;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0;
    text-transform: uppercase;
    margin-bottom: 12px;
  }

  .section-title {
    margin-top: 22px;
  }

  .layer-list {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .layer-row {
    width: 100%;
    min-height: 48px;
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr);
    align-items: center;
    gap: 9px;
    margin: 0;
    padding: 6px 8px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    color: #e4e6ea;
    cursor: pointer;
    text-align: left;
  }

  .layer-row:hover {
    background: #1a1c20;
  }

  .layer-row.selected {
    background: #18201e;
    border-color: #33584d;
    box-shadow: inset 2px 0 #7cf7c5;
  }
  .layer-icon {
    width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #2d3137;
    border-radius: 4px;
    background: #17191c;
    color: #a8adb5;
    overflow: hidden;
  }

  .layer-icon img,
  .track-thumb img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: contain;
  }

  .selected .layer-icon,
  .selection-summary .layer-icon {
    color: #7cf7c5;
    border-color: #33584d;
  }

  .layer-copy,
  .selection-summary > span:last-child {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 3px;
  }

  .layer-copy strong,
  .selection-summary strong {
    overflow: hidden;
    color: #eef0f2;
    font-size: 12px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .layer-copy small,
  .selection-summary small {
    overflow: hidden;
    color: #777d86;
    font-size: 10px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .selection-summary {
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    margin: 0 0 18px;
    padding: 8px;
    border-bottom: 1px solid #24262a;
  }

  .preview-container {
    position: relative;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    background:
      linear-gradient(90deg, rgba(255, 255, 255, 0.026) 1px, transparent 1px),
      linear-gradient(rgba(255, 255, 255, 0.026) 1px, transparent 1px),
      #0b0c0e;
    background-size: 32px 32px;
    overflow: hidden;
  }

  .stage-meta {
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 18px;
    color: #858a92;
    font-size: 12px;
    border-bottom: 1px solid #22252a;
    background: rgba(13, 14, 16, 0.92);
  }

  .stage-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .meta-btn,
  .icon-btn {
    border: 1px solid #2c3035;
    border-radius: 6px;
    background: #17191c;
    color: #d8dce2;
    cursor: pointer;
  }

  .meta-btn {
    height: 28px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0 10px;
    font-size: 12px;
  }

  .meta-btn:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .icon-btn {
    width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .meta-btn:hover,
  .icon-btn:hover {
    background: #202328;
  }

  .stage {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 36px;
    overflow: hidden;
    position: relative;
  }

  .property-align-toolbar {
    margin: 0 14px 14px;
    padding: 10px;
    border: 1px solid #292d33;
    border-radius: 6px;
    background: #111317;
  }

  .property-align-label {
    display: block;
    margin-bottom: 8px;
    color: #7f8791;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .property-align-actions {
    display: grid;
    grid-template-columns: repeat(3, 1fr) 1px repeat(3, 1fr);
    overflow: hidden;
    border: 1px solid #30353c;
    border-radius: 5px;
  }

  .property-align-actions button {
    min-width: 0;
    height: 30px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    border-right: 1px solid #30353c;
    background: #181b20;
    color: #cbd0d7;
    cursor: pointer;
  }

  .property-align-actions button:last-child { border-right: 0; }
  .property-align-actions button:hover { background: #282d34; color: #7cf7c5; }

  .align-divider {
    width: 1px;
    height: 30px;
    justify-self: center;
    background: #30353c;
  }

  .canvas-shell {
    position: relative;
    flex: 0 0 auto;
    height: auto;
  }

  .preview-canvas {
    display: block;
    width: 100%;
    height: auto;
    max-width: none;
    max-height: none;
    border-radius: 4px;
    background: #000;
    box-shadow:
      0 24px 80px rgba(0, 0, 0, 0.58),
      0 0 0 1px rgba(255, 255, 255, 0.08);
    cursor: grab;
    touch-action: none;
  }

  .preview-canvas.dragging {
    cursor: grabbing;
  }

  .snap-guide {
    position: absolute;
    z-index: 5;
    display: block;
    background: #ff405f;
    box-shadow: 0 0 0 1px rgba(255, 64, 95, 0.18);
    pointer-events: none;
  }

  .snap-guide-v {
    top: 0;
    bottom: 0;
    width: 1px;
    transform: translateX(-0.5px);
  }

  .snap-guide-h {
    right: 0;
    left: 0;
    height: 1px;
    transform: translateY(-0.5px);
  }

  .asset-preview-overlay {
    position: absolute;
    inset: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.95);
    border: 0;
    padding: 0;
    backdrop-filter: blur(8px);
    z-index: 100;
    cursor: default;
    border-radius: 4px;
  }

  .asset-preview-overlay img,
  .asset-preview-overlay video {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 4px;
  }

  .asset-preview-close {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 32px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #3a3f46;
    border-radius: 6px;
    background: rgba(17, 19, 23, 0.9);
    color: #fff;
    cursor: pointer;
  }

  .asset-preview-close:hover { background: #292e35; }

  /* Properties Panel Controls */
  .property-group {
    margin-bottom: 16px;
  }

  .property-label {
    display: block;
    color: #8e939b;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  }

  .property-label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .property-label-row .property-label { margin-bottom: 0; }

  .property-action {
    padding: 0;
    border: 0;
    background: transparent;
    color: #7cf7c5;
    font-size: 10px;
    cursor: pointer;
  }

  .property-action:hover { color: #b8ffe4; text-decoration: underline; }

  .clip-original-size { width: 100%; margin-bottom: 14px; }

  .transition-pair-copy {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    margin: 0 0 16px;
    padding: 10px;
    border: 1px solid #2a2d33;
    border-radius: 5px;
    background: #121417;
  }

  .transition-pair-copy > span:not(.transition-pair-arrow) {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 3px;
  }

  .transition-pair-copy small { color: #727983; font-size: 9px; text-transform: uppercase; }
  .transition-pair-copy strong { overflow: hidden; color: #e8ebef; font-size: 11px; text-overflow: ellipsis; }
  .transition-pair-arrow { color: #7cf7c5; }
  .transition-remove { width: 100%; color: #ff9d9d; }

  .property-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  /* Number Inputs with Suffix */
  .number-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .number-input {
    width: 100%;
    height: 32px;
    box-sizing: border-box;
    border: 1px solid #2a2d33;
    border-radius: 6px;
    background: #17191c;
    color: #e4e6ea;
    font: inherit;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    padding: 0 26px 0 10px;
    outline: none;
    transition: all 0.12s ease;
  }

  .number-input:hover {
    border-color: #363d4b;
    background: #1a1c20;
  }

  .number-input:focus {
    border-color: #7cf7c5;
    background: #1a1c20;
    box-shadow: 0 0 0 2px rgba(124, 247, 197, 0.12);
  }

  .input-suffix {
    position: absolute;
    right: 10px;
    color: #6b7280;
    font-size: 11px;
    font-weight: 500;
    pointer-events: none;
  }

  /* Custom Sliders */
  .slider-control {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .custom-slider {
    flex: 1;
    height: 3px;
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    outline: none;
    padding: 0;
    margin: 0;
  }

  .custom-slider::-webkit-slider-track {
    width: 100%;
    height: 3px;
    background: linear-gradient(
      to right,
      #7cf7c5 0%,
      #7cf7c5 var(--slider-progress, 50%),
      #2a2d33 var(--slider-progress, 50%),
      #2a2d33 100%
    );
    border-radius: 2px;
  }

  .custom-slider::-moz-range-track {
    width: 100%;
    height: 3px;
    background: #2a2d33;
    border-radius: 2px;
  }

  .custom-slider::-moz-range-progress {
    height: 3px;
    background: #7cf7c5;
    border-radius: 2px;
  }

  .custom-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    background: #e4e6ea;
    border: 2px solid #7cf7c5;
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    transition: all 0.12s ease;
  }

  .custom-slider::-moz-range-thumb {
    width: 12px;
    height: 12px;
    background: #e4e6ea;
    border: 2px solid #7cf7c5;
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    transition: all 0.12s ease;
  }

  .custom-slider:hover::-webkit-slider-thumb {
    transform: scale(1.15);
    box-shadow: 0 2px 6px rgba(124, 247, 197, 0.3), 0 0 0 4px rgba(124, 247, 197, 0.1);
  }

  .custom-slider:hover::-moz-range-thumb {
    transform: scale(1.15);
    box-shadow: 0 2px 6px rgba(124, 247, 197, 0.3), 0 0 0 4px rgba(124, 247, 197, 0.1);
  }

  .custom-slider:active::-webkit-slider-thumb {
    transform: scale(1.05);
  }

  .custom-slider:active::-moz-range-thumb {
    transform: scale(1.05);
  }

  .slider-value-input {
    width: 52px;
    height: 28px;
    box-sizing: border-box;
    border: 1px solid #2a2d33;
    border-radius: 5px;
    background: #17191c;
    color: #e4e6ea;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    text-align: center;
    padding: 0 6px;
    outline: none;
    transition: all 0.12s ease;
  }

  .slider-value-input:hover {
    border-color: #363d4b;
  }

  .slider-value-input:focus {
    border-color: #7cf7c5;
    box-shadow: 0 0 0 2px rgba(124, 247, 197, 0.12);
  }

  /* Text Input & Textarea */
  .text-input {
    width: 100%;
    min-height: 72px;
    box-sizing: border-box;
    border: 1px solid #2a2d33;
    border-radius: 6px;
    background: #17191c;
    color: #e4e6ea;
    font: inherit;
    font-size: 12px;
    line-height: 1.5;
    padding: 8px 10px;
    outline: none;
    resize: vertical;
    transition: all 0.12s ease;
  }

  .text-input:hover {
    border-color: #363d4b;
  }

  .text-input:focus {
    border-color: #7cf7c5;
    background: #1a1c20;
    box-shadow: 0 0 0 2px rgba(124, 247, 197, 0.12);
  }

  /* Color Input */
  .color-input {
    width: 100%;
    height: 36px;
    box-sizing: border-box;
    border: 1px solid #2a2d33;
    border-radius: 6px;
    background: #17191c;
    padding: 4px;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .color-input:hover {
    border-color: #363d4b;
  }

  .color-input:focus {
    border-color: #7cf7c5;
    box-shadow: 0 0 0 2px rgba(124, 247, 197, 0.12);
  }

  /* Preset Cards */
  .preset-cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .preset-option {
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #2a2d33;
    border-radius: 5px;
    background: #17191c;
    color: #d8dce2;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .preset-option:hover {
    background: #1a1c20;
    border-color: #363d4b;
  }

  .preset-option.active {
    background: #1a2f28;
    border-color: #33584d;
    color: #7cf7c5;
    box-shadow: inset 0 0 0 1px rgba(124, 247, 197, 0.2);
  }

  /* Easing Options */
  .easing-options {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .easing-option {
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    border: 1px solid transparent;
    border-radius: 5px;
    background: transparent;
    color: #d8dce2;
    font-size: 11px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    padding: 0 10px;
    text-align: left;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .easing-option:hover {
    background: #1a1c20;
    border-color: #2a2d33;
  }

  .easing-option.active {
    background: #1a2f28;
    border-color: #33584d;
    color: #7cf7c5;
  }

  .empty {
    color: #858a92;
    font-size: 13px;
  }

  .timeline-panel {
    flex: 0 0 var(--timeline-height);
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: #0d0e10;
    border-top: 1px solid #24262a;
  }

  .timeline-resizer {
    flex: 0 0 7px;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    border-bottom: 1px solid #24262a;
    background: #0d0e10;
    cursor: ns-resize;
  }

  .timeline-resizer span {
    width: 34px;
    height: 2px;
    border-radius: 1px;
    background: #3b4047;
  }

  .timeline-resizer:hover span,
  .timeline-resizer:focus-visible span {
    background: #7cf7c5;
  }

  .timeline-toolbar {
    flex: 0 0 46px;
    display: grid;
    grid-template-columns: minmax(280px, 1fr) auto minmax(280px, 1fr);
    align-items: center;
    gap: 14px;
    padding: 0 12px;
    border-bottom: 1px solid #24262a;
    background: #111214;
  }

  .playback-controls,
  .timeline-actions,
  .timeline-context {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .timeline-actions {
    min-width: 0;
    justify-content: flex-end;
  }

  .timeline-context {
    min-width: 0;
    color: #858a92;
    font-size: 11px;
  }

  .timeline-context span {
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .control-btn {
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #2c3035;
    border-radius: 5px;
    background: #17191c;
    color: white;
    cursor: pointer;
  }

  .control-btn:hover {
    background: #202328;
    border-color: #3a3f46;
  }

  .play-btn {
    border: none;
    background: #e6e8ec;
    color: #09090a;
  }

  .timecode {
    min-width: 50px;
    color: #f1f2f4;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    font-weight: 600;
  }

  .framecode {
    color: #777d86;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 10px;
  }

  .timeline-command,
  .audio-chip {
    height: 28px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid #2c3035;
    border-radius: 5px;
    background: #17191c;
    color: #d8dce2;
    padding: 0 9px;
    font-size: 11px;
  }

  .timeline-command {
    cursor: pointer;
  }

  .timeline-command:hover {
    background: #202328;
  }

  .audio-chip {
    max-width: 170px;
    overflow: hidden;
    color: #cdb5e5;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .file-input,
  .timeline-panel audio {
    display: none;
  }

  .timeline-scroll {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    overflow: auto;
    scrollbar-width: thin;
    scrollbar-color: #34373d #0d0e10;
  }

  .ruler-row,
  .timeline-row {
    width: 100%;
    min-width: var(--timeline-content-width, 820px);
    display: grid;
    grid-template-columns: 220px minmax(600px, 1fr);
  }

  .ruler-row {
    position: sticky;
    order: -10000;
    top: 0;
    z-index: 4;
    height: 30px;
    background: #111214;
  }

  .timeline-row {
    min-height: 42px;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: #d8dce2;
    text-align: left;
  }

  .timeline-row:hover,
  .timeline-row.selected {
    background: #151719;
  }

  .timeline-row.selected .track-label {
    color: #f1f2f4;
    box-shadow: inset 2px 0 #7cf7c5;
  }

  .track-label {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 11px;
    border-right: 1px solid #24262a;
    border-bottom: 1px solid #1d1f22;
    color: #a8adb5;
    border-top: 0;
    border-left: 0;
    background: transparent;
    font: inherit;
    font-size: 11px;
    text-align: left;
    cursor: default;
  }

  .track-label strong {
    min-width: 0;
    overflow: hidden;
    font-size: 11px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .track-thumb {
    flex: 0 0 28px;
    width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border: 1px solid #2c3138;
    border-radius: 3px;
    background: #111419;
    color: #858c95;
  }

  .track-copy {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .track-copy small {
    max-width: 82px;
    overflow: hidden;
    color: #676d75;
    font-size: 9px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .track-controls { margin-left: auto; display: flex; align-items: center; gap: 2px; }
  .track-control { width: 24px; height: 24px; padding: 0; display: grid; place-items: center; border: 0; border-radius: 4px; background: transparent; color: #737a83; cursor: pointer; }
  .track-control:hover { color: #dce1e6; background: #202329; }
  .track-control.active { color: #f0b26d; }
  .track-label.track-hidden .track-copy { opacity: .55; }

  .track-time {
    margin-left: auto;
    color: #676d75;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 9px;
    white-space: nowrap;
  }

  .ruler-label {
    color: #777d86;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
  }

  .ruler,
  .track-lane {
    position: relative;
    border-bottom: 1px solid #1d1f22;
    background-image: repeating-linear-gradient(90deg, transparent 0, transparent 59px, rgba(255, 255, 255, 0.035) 60px);
  }

  .ruler-tick {
    position: absolute;
    top: 8px;
    color: #676d75;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 9px;
    transform: translateX(-50%);
    pointer-events: none;
  }

  .playhead-marker {
    position: absolute;
    z-index: 2;
    top: 0;
    bottom: -1px;
    width: 2px;
    background: #f1f2f4;
    transform: translateX(-50%);
    pointer-events: none;
  }

  .playhead-marker::before {
    content: '';
    position: absolute;
    top: 0;
    left: 50%;
    width: 0;
    height: 0;
    border-top: 7px solid #f1f2f4;
    border-right: 6px solid transparent;
    border-left: 6px solid transparent;
    transform: translateX(-50%);
  }

  /* Drop Indicator */
  .drop-indicator {
    position: absolute;
    z-index: 3;
    top: 0;
    bottom: -1px;
    width: 3px;
    background: #7cf7c5;
    transform: translateX(-50%);
    pointer-events: none;
    box-shadow: 0 0 8px rgba(124, 247, 197, 0.6);
  }

  .drop-indicator::before {
    content: '';
    position: absolute;
    top: 0;
    left: 50%;
    width: 0;
    height: 0;
    border-top: 8px solid #7cf7c5;
    border-right: 7px solid transparent;
    border-left: 7px solid transparent;
    transform: translateX(-50%);
  }

  .timeline-scroll.drop-target {
    background: rgba(124, 247, 197, 0.05);
  }

  /* Timeline Clip Styles */
  .clip-row .track-label {
    background: #0d0e10;
  }

  .timeline-clip {
    border: 2px solid #7cf7c5;
    background: rgba(124, 247, 197, 0.1);
  }

  .clip-trim-label {
    position: absolute;
    z-index: 1;
    right: 22px;
    bottom: 2px;
    left: 4px;
    overflow: hidden;
    color: rgba(255, 255, 255, 0.82);
    font-size: 8px;
    line-height: 10px;
    text-overflow: ellipsis;
    white-space: nowrap;
    pointer-events: none;
  }

  .timeline-clip.selected-clip {
    border-color: #f1f2f4;
    box-shadow: 0 0 0 1px #7cf7c5;
  }

  .transition-cut {
    position: absolute;
    z-index: 6;
    top: 10px;
    width: 16px;
    height: 16px;
    padding: 0;
    border: 1px solid #515860;
    border-radius: 4px;
    background: #15181c;
    color: #9ba1a9;
    font-size: 12px;
    line-height: 14px;
    cursor: pointer;
    transform: translateX(-50%);
    transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
  }

  .transition-cut.has-transition {
    border-color: #7cf7c5;
    background: #1c4a3d;
    color: #ecfff7;
    box-shadow: 0 0 0 2px rgba(13, 14, 16, 0.85);
  }

  .transition-cut.drop-ready {
    width: 22px;
    height: 22px;
    top: 7px;
    border-color: #7cf7c5;
    background: #243d35;
    color: #fff;
    box-shadow: 0 0 12px rgba(124, 247, 197, 0.65);
  }

  .transition-cut.selected-transition {
    border-color: #fff;
    box-shadow: 0 0 0 2px #7cf7c5, 0 0 12px rgba(124, 247, 197, 0.55);
  }

  .clip-delete {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 3px;
    background: rgba(239, 68, 68, 0.9);
    color: #fff;
    opacity: 0;
    cursor: pointer;
    transition: opacity 0.15s ease;
    z-index: 2;
  }

  .timeline-clip:hover .clip-delete {
    opacity: 1;
  }

  .clip-delete:hover {
    background: #dc2626;
  }

  .timeline-scrubber {
    position: absolute;
    inset: 0;
    z-index: 3;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: ew-resize;
  }

  .track-lane {
    min-height: 41px;
  }

  .clip {
    position: absolute;
    top: 7px;
    height: 27px;
    min-width: 5px;
    border: 1px solid #536070;
    border-radius: 3px;
    background: #34404e;
    box-sizing: border-box;
    overflow: visible;
  }

  .clip-media,
  .clip-color,
  .clip-text {
    position: absolute;
    inset: 1px;
    overflow: hidden;
    border-radius: 2px;
    pointer-events: none;
  }

  .clip-media {
    background-color: #11151a;
    background-repeat: repeat-x;
    background-position: left center;
    background-size: auto 100%;
    opacity: 0.8;
  }

  .video-clip-media {
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #15241f, #17202b);
    color: #7cf7c5;
  }

  .clip-color {
    opacity: 0.8;
  }

  .clip-text {
    padding: 5px 8px;
    color: rgba(244, 247, 249, 0.9);
    font-size: 10px;
    line-height: 15px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .clip-select {
    position: absolute;
    inset: 0;
    width: 100%;
    padding: 0;
    border: 0;
    border-radius: 2px;
    background: transparent;
    cursor: grab;
    touch-action: none;
  }
  .clip-select:active { cursor: grabbing; }

  .clip-ghost {
    position: absolute;
    z-index: 3;
    top: 6px;
    height: 27px;
    border: 1px dashed #7cf7c5;
    border-radius: 3px;
    background: rgba(124, 247, 197, 0.14);
    pointer-events: none;
  }
  .clip-ghost.invalid {
    border-color: #ff6b74;
    background: rgba(255, 107, 116, 0.14);
  }

  .trim-handle {
    position: absolute;
    z-index: 2;
    top: -2px;
    bottom: -2px;
    width: min(8px, 30%);
    padding: 0;
    border: 0;
    border-radius: 2px;
    background: #c7d0d9;
    opacity: 0;
    pointer-events: none;
    cursor: ew-resize;
  }

  .trim-start {
    left: -1px;
  }

  .trim-end {
    right: -1px;
  }

  .timeline-row:hover .trim-handle,
  .timeline-row.selected .trim-handle,
  .trim-handle:focus-visible {
    opacity: 1;
    pointer-events: auto;
  }

  .element-clip.selected-clip {
    border-color: #69cda9;
    background: #31594d;
  }

  .audio-clip {
    border-color: #725d86;
    background: #4e405d;
  }

  .mask-select { min-height: 34px; width: 100%; }

  .toggle-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: -2px 0 10px;
    color: #b6bbc2;
    font-size: 11px;
    cursor: pointer;
  }

  .toggle-row input { accent-color: #7cf7c5; }

  .keyframe-marker {
    position: absolute;
    z-index: 5;
    top: 50%;
    width: 10px;
    height: 10px;
    padding: 0;
    border: 1px solid #111318;
    border-radius: 1px;
    background: #f4b860;
    box-shadow: 0 0 0 1px rgba(244, 184, 96, 0.22);
    transform: translate(-50%, -50%) rotate(45deg);
    cursor: ew-resize;
    touch-action: none;
  }

  .keyframe-marker:hover,
  .keyframe-marker.selected-keyframe {
    background: #fff1c9;
    box-shadow: 0 0 0 2px #f4b860;
  }

  .drag-keyframe { pointer-events: none; }

  .keyframe-add {
    position: absolute;
    z-index: 5;
    top: 50%;
    width: 15px;
    height: 15px;
    padding: 0;
    display: grid;
    place-items: center;
    border: 1px solid #2f6d59;
    border-radius: 50%;
    background: #17362d;
    color: #b8ffe4;
    font-size: 12px;
    line-height: 1;
    transform: translate(-50%, -50%);
    cursor: pointer;
    opacity: 0;
  }
  .timeline-row:hover .keyframe-add,
  .timeline-row.selected .keyframe-add {
    opacity: 1;
  }
  .keyframe-add:hover { background: #1d4538; }

  .keyframe-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .keyframe-controls .timeline-command { flex: 1; }
  .keyframe-controls .number-input-wrapper { width: 84px; }
  .easing-input { margin-top: 8px; min-height: 32px; }

  .playhead {
    position: absolute;
    z-index: 2;
    top: 0;
    bottom: 0;
    width: 1px;
    background: #f1f2f4;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.45);
    pointer-events: none;
  }

  .danger-btn:hover {
    border-color: #714044;
    background: #2b1719;
    color: #ff9da5;
  }

  .source-toggle {
    position: absolute;
    right: 316px;
    bottom: calc(var(--timeline-height) + 10px);
    border: 1px solid #2c3035;
    border-radius: 6px;
    background: #111214;
    color: #d8dce2;
    padding: 8px 10px;
    font-size: 12px;
    cursor: pointer;
  }

  .code-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: var(--timeline-height);
    background: rgba(5, 5, 6, 0.88);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .code-panel {
    width: 90%;
    max-width: 1200px;
    height: 80%;
    background: #111214;
    border: 1px solid #2c3035;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 16px 64px rgba(0, 0, 0, 0.8);
    animation: slideUp 0.2s ease-out;
  }

  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .code-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    border-bottom: 1px solid #24262a;
  }

  .code-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #f1f2f4;
  }

  .close-btn {
    width: 36px;
    height: 36px;
    background: transparent;
    border: 1px solid #2c3035;
    border-radius: 6px;
    color: #8e939b;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    background: #202328;
    color: #fff;
    border-color: #3a3f46;
  }

  .code-textarea {
    flex: 1;
    padding: 24px;
    background: #111214;
    border: none;
    color: #e6e8ec;
    font-family: 'Fira Code', 'Courier New', monospace;
    font-size: 15px;
    line-height: 1.6;
    resize: none;
    outline: none;
    tab-size: 2;
  }

  .code-textarea::placeholder {
    color: #6d737c;
  }

  .error-banner {
    margin: 12px;
    padding: 12px 14px;
    background: rgba(255, 107, 107, 0.08);
    border: 1px solid rgba(255, 107, 107, 0.28);
    border-radius: 6px;
    color: #ff6b6b;
    font-size: 12px;
    font-family: monospace;
  }

  @media (max-width: 900px) {
    .workbench,
    .workbench.chat-open {
      grid-template-columns: 1fr;
    }

    .nav-rail,
    .content-panel,
    .chat-drawer,
    .chat-drawer.collapsed,
    .properties-panel {
      display: none;
    }

    .source-toggle {
      right: 16px;
    }

    .timeline-toolbar {
      grid-template-columns: 1fr auto;
    }

    .timeline-context {
      display: none;
    }

    .timeline-actions .audio-chip,
    .framecode {
      display: none;
    }
  }
</style>
