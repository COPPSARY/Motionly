<script lang="ts">
  import { onMount } from 'svelte';
  import { Sparkles } from 'lucide-svelte';
  import { parseMotion } from '../../language/parser';
  import { buildSceneGraph } from '../../scene/scene-graph';
  import { evaluateScene } from '../../animation/evaluator';
  import {
    assetWarnings,
    disposeAssets,
    loadAssets,
    isLoadedVideo,
    pauseAnimatedAssets,
    synchronizeAnimatedAssets,
  } from '../../assets/asset-loader';
  import type { LoadedAsset } from '../../assets/asset-loader';
  import { assetFilename, significantlyDifferentAsset, tagEmbeddedAssetPath } from '../../assets/asset-resolution';
  import type { AssetIdentity } from '../../assets/asset-resolution';
  import { CanvasRenderer, hiddenMaskSourceIds } from '../../render/canvas-renderer';
  import { canExport, exportVideo } from '../../export/exporter';
  import type { AnimationNode, AudioNode, CameraNode, ClipNode, ElementNode, ImportNode, ProgramNode, TrackNode } from '../../types/parser';
  import { serializeProgram } from '../../language/serializer';
  import type { Asset, Clip, Element, EvaluatedElement, EvaluatedScene, Scene, Track } from '../../types/scene';
  import { combinePersistentTrackRows, packClipTrackLanes, packTimelineLanes } from '../timeline-lanes';
  import { alignRect, snapRect, type Alignment, type SnapGuides } from '../canvas-geometry';
  import {
    animatedProperties,
    hasKeyframeProperties,
    keyframeOffsetAtTime,
    mergeCoincidentKeyframes,
    moveKeyframe,
    removeKeyframe,
    removeKeyframeProperties,
    seedKeyframes,
    setKeyframeEasing,
    upsertKeyframe,
  } from '../keyframe-editing';
  import { placeMediaClip, splitClip, type ClipTiming } from '../clip-timing';
  import {
    adjacentClipBoundaries,
    applyClipTransition,
    removedClipTransitionProperties,
    type ClipTransitionBoundary,
  } from '../clip-transitions';
  import { elementWindowProperties, moveElementClip, splitElementClip } from '../element-clips';
  import { restoreEmbeddedAssetPaths } from '../../ai/chat';
  import { createEditorHistory, recordEditorSource, redoEditorSource, undoEditorSource } from '../editor-history';
  import { editorShortcut } from '../editor-shortcuts';
  import { cloneClipInProgram, cloneElementInProgram } from '../duplicate-cloning';
  import { extractAudioPeaks, waveformBucketCount, waveformPath } from '../audio-waveform';
  import { moveClipToTrack, removeClipFromTracks, trimClipOnTrack } from '../timeline-tracks';
  import { anchoredTimelineScroll, clampTimelineZoom, playbackTimeFromClock, quantizeTimelineTime as quantizeFrameTime } from '../timeline-viewport';
  import AiChatPanel from './AiChatPanel.svelte';
  import NavigationRail from './motion-editor/NavigationRail.svelte';
  import PreviewStage from './motion-editor/PreviewStage.svelte';
  import SourceEditor from './motion-editor/SourceEditor.svelte';
  import EditorFeedback from './motion-editor/EditorFeedback.svelte';
  import ContentPanel from './motion-editor/ContentPanel.svelte';
  import PropertiesInspector from './motion-editor/PropertiesInspector.svelte';
  import TimelinePanel from './motion-editor/TimelinePanel.svelte';
  import {
    assetPreviewSource,
    ensureAnimationNode,
    mergeAssets,
    numericProperty,
    propertiesOf,
    readFileDataUrl,
    stringProperty,
  } from './motion-editor/helpers';
  import type { AnimationPresetDef, AssetPreview, EditorNavTab } from './motion-editor/types';
  import './motion-editor/editor-shell.css';
  import './motion-editor/editor-theme.css';

  const TIMING_PROPERTIES = new Set([
    'start',
    'duration',
    'delay',
    'track',
    'mediaTime',
    'mediaTrimOut',
    'mediaVolume',
  ]);
  const DEFAULT_KEYFRAME_PROPERTIES = [
    'x',
    'y',
    'scale',
    'rotation',
    'opacity',
    'blur',
    'size',
    'color',
    'fill',
  ];

  // Timeline layout: clips are drawn at a fixed pixels-per-second scale (× zoom)
  // so a clip's on-screen length reflects its real duration. At rest the ruler
  // spans the content end (or the visible panel, whichever is longer) with no
  // trailing padding. While a clip is being dragged/stretched toward the end,
  // the ruler grows to follow so there is room to extend; committing past the
  // old end grows the project. Fixed px/s means existing clips never shift when
  // the ruler grows.
  const TIMELINE_LABEL_WIDTH = 220;
  const TIMELINE_PIXELS_PER_SECOND = 100;
  const TIMELINE_MIN_LANE_WIDTH = 160;

  export let code = '';
  export let onSave: () => void | Promise<void> = () => undefined;
  export let serverBacked = false;
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
  let playbackTime = 0;
  let totalDuration = 5;
  let animationFrameId: number | null = null;
  let dragState:
    | { mode: 'move'; id: string; visualId: string; offsetX: number; offsetY: number; startX: number; startY: number }
    | { mode: 'resize'; id: string; visualId: string; centerX: number; centerY: number; startDistance: number; startScale: number }
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
  let animatedPropertyNames: string[] = [];
  let selectedKeyframeMarkerList: { offset: number; easing?: string; properties: string[] }[] = [];
  let selectedAnimationTargetId = '';
  let moreOptionsOpen = false;
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
  let audioPlayPromise: Promise<void> | null = null;
  let audioLoadId = 0;
  let loadedAudioPath = '';
  let audioWaveformLoadId = 0;
  let audioWaveformPath = '';
  let audioWaveformPeakCount = 0;
  let audioWaveformLoading = false;
  let audioClipDuration = 0;
  let visibleWaveformPeaks = 1;
  let timelineHeight = 230;
  let contentPanelWidth = 260;
  let mp4Supported = false;
  let isExporting = false;
  let exportError = '';
  let assetError = '';
  let audioError = '';
  let activeNavTab: EditorNavTab = 'media';
  let showAiChat = false;
  let mediaSubTab: 'assets' | 'presets' = 'assets';
  let showConfirmDialog = false;
  let pendingPresetPath = '';
  let pendingDelete:
    | { kind: 'assets'; assets: Asset[]; usageCount: number }
    | { kind: 'audio' }
    | { kind: 'text'; ids: string[] }
    | null = null;
  let previewAsset: AssetPreview | null = null;
  let videoRenderId = 0;
  let isDraggingUpload = false;
  let stageDropActive = false;
  let draggingAsset: Asset | null = null;
  let draggingAudio = false;
  let draggingTransition: 'crossfade' | null = null;
  let selectedTransitionIds: { outgoingId: string; incomingId: string } | null = null;
  let dropTargetTime: number | null = null;
  let dropTargetTrack: number | string = '';
  let editorHistory = createEditorHistory(code);
  let timelineScroll: HTMLDivElement;
  let timelineZoom = 1;
  let timelineViewportWidth = 0;
  // While a clip/element is being dragged or stretched toward the end this holds
  // the current far edge (seconds) so the ruler can grow to follow; 0 when idle.
  let timelineDragReach = 0;
  let snapEnabled = true;
  let timelineSnapGuide: number | null = null;
  let historyGestureBase: string | null = null;
  let deleteToast = '';
  let deleteToastTimer: ReturnType<typeof setTimeout> | null = null;
  let deleteUndoSource: string | null = null;
  let deleteResultSource: string | null = null;
  let keyframeNotice = '';
  let keyframeNoticeTimer: ReturnType<typeof setTimeout> | null = null;



  onMount(() => {
    mp4Supported = canExport('mp4');
    if (canvas) {
      renderer = new CanvasRenderer(canvas);
      parseAndRender();
    }
    const observer = new ResizeObserver(fitPreview);
    if (stage) observer.observe(stage);
    requestAnimationFrame(fitPreview);

    // Track the timeline viewport width so the lane scale can fit long projects
    // to the visible area while keeping short projects compact.
    const measureTimeline = () => {
      if (timelineScroll) timelineViewportWidth = timelineScroll.clientWidth;
    };
    const timelineObserver = new ResizeObserver(measureTimeline);
    if (timelineScroll) timelineObserver.observe(timelineScroll);
    measureTimeline();
    requestAnimationFrame(measureTimeline);
    
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      const interactive = Boolean(target?.closest(
        'input, textarea, select, button, a, [contenteditable="true"], [role="button"], [role="slider"]'
      ));
      const shortcut = editorShortcut(e, interactive);
      if (!shortcut || showConfirmDialog) return;
      e.preventDefault();
      if (e.repeat && !shortcut.startsWith('nudge-')) return;

      const nudge = e.shiftKey ? 10 : 1;
      switch (shortcut) {
        case 'save':
          void onSave();
          break;
        case 'undo':
          undoEditor();
          break;
        case 'redo':
          redoEditor();
          break;
        case 'toggle-playback':
          if (isPlaying) pause();
          else play();
          break;
        case 'delete-selection':
          if (selectedKeyframeOffset !== null) deleteSelectedKeyframe();
          else deleteSelectedElement();
          break;
        case 'duplicate-selection':
          duplicateSelected();
          break;
        case 'nudge-left':
          nudgeSelectedElement(-nudge, 0);
          break;
        case 'nudge-right':
          nudgeSelectedElement(nudge, 0);
          break;
        case 'nudge-up':
          nudgeSelectedElement(0, -nudge);
          break;
        case 'nudge-down':
          nudgeSelectedElement(0, nudge);
          break;
        case 'split':
          splitSelectedClip();
          break;
        case 'reset-playhead':
          reset();
          break;
        case 'clear-selection':
          if (previewAsset) clearAssetPreview();
          else if (selectedElementId) {
            selectedElementId = '';
            selectedKeyframeOffset = null;
            selectedTransitionIds = null;
            renderFrame(currentTime);
          }
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      observer.disconnect();
      timelineObserver.disconnect();
      disposeAssets(assets);
      audioLoadId += 1;
      audioWaveformLoadId += 1;
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (deleteToastTimer) clearTimeout(deleteToastTimer);
      if (keyframeNoticeTimer) clearTimeout(keyframeNoticeTimer);
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
    clearDeleteToast();
    const previous = undoEditorSource(editorHistory);
    if (previous === editorHistory) return;
    pause();
    editorHistory = previous;
    code = previous.present;
  }

  function redoEditor() {
    clearDeleteToast();
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

  function cancelConfirmDialog() {
    if (pendingDelete) pendingDelete = null;
    else cancelLoadPreset();
    showConfirmDialog = false;
  }

  function confirmDialog() {
    if (!pendingDelete) return confirmLoadPreset();
    const deletion = pendingDelete;
    pendingDelete = null;
    showConfirmDialog = false;
    if (deletion.kind === 'assets') {
      for (const asset of deletion.assets) removeAssetNow(asset);
    } else if (deletion.kind === 'audio') {
      removeAudio();
    } else {
      for (const id of deletion.ids) deleteElement(id);
    }
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
    if (deleteResultSource && code !== deleteResultSource) clearDeleteToast();
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
  $: selectedClipElement = selectedClip
    ? scene?.elements.find((element) => element.id === selectedClip?.assetName) ??
      currentFrame?.elements.find((element) => element.id === selectedClip?.id) ??
      null
    : null;
  $: selectedAnimationTargetId = selectedElement?.id ?? selectedClip?.assetName ?? '';
  $: selectedAnimation =
    scene?.animations.find((animation) => animation.target === selectedAnimationTargetId) ?? null;
  $: animatedPropertyNames =
    code && selectedAnimationTargetId ? selectedAnimatedProperties() : [];
  $: selectedKeyframeMarkerList =
    code && selectedAnimationTargetId ? selectedKeyframeMarkers() : [];
  $: keyframeDragDelta =
    clipDrag?.kind === 'element' && clipDrag.id === selectedElementId
      ? clipDrag.ghostStart - timelineRange(clipDrag.id).start
      : 0;
  $: sourceElements = scene?.elements.filter((element) => !element.id.includes('__')) ?? [];
  $: timelineElements = sourceElements.filter(
    (element) =>
      element.kind !== 'asset' ||
      !element.assetName ||
      !scene?.clips.some((clip) => clip.assetName === element.assetName)
  );
  $: allTimelineRows = packTimelineLanes(timelineElements, timelineRange);
  $: combinedTimelineRows = combinePersistentTrackRows(
    packClipTrackLanes(scene?.clips ?? [], scene?.tracks ?? []),
    allTimelineRows
  );
  $: timelineRows = combinedTimelineRows.elementLanes;
  $: timelineClipTracks = combinedTimelineRows.clipTracks;
  $: defaultMainTrack = scene?.tracks.find((track) => track.role === 'main')?.id ?? 'main';
  $: projectAudioTrack = scene?.tracks.find((track) => track.role === 'audio') ?? null;
  $: audioClipDuration = Math.min(
    audioDuration || totalDuration,
    Math.max(0, totalDuration - (scene?.audioStart ?? 0))
  );
  $: visibleWaveformPeaks =
    audioDuration > 0
      ? Math.max(1, (audioWaveformPeakCount * audioClipDuration) / audioDuration)
      : Math.max(1, audioWaveformPeakCount);
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
  $: timelineTicks = Array.from({ length: 7 }, (_, index) => (timelineVisibleDuration * index) / 6);
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
  // The last clipbar end (content end). The playhead is clamped here; the ruler
  // extends a fixed tail past it so clips can be dragged/extended into the gap.
  $: timelineContentEnd = (() => {
    const ends = [
      ...(scene?.clips ?? []).map((clip) => clip.start + clip.duration),
      ...(scene?.elements ?? []).map((element) => timelineRange(element.id).end),
    ].filter((value) => Number.isFinite(value));
    return ends.length ? Math.max(0, ...ends) : Math.max(0, totalDuration);
  })();
  // Fixed pixels-per-second scale (× zoom): a clip is drawn at duration × scale,
  // so short clips look short. The ruler/drag extent is the content end plus a
  // fixed tail so there is always room to drag or stretch a clip; committing a
  // clip past the current end grows the project (see extendProjectDuration).
  // All clip/tick/playhead positions are percentages of timelineVisibleDuration.
  $: timelinePixelsPerSecond = TIMELINE_PIXELS_PER_SECOND * timelineZoom;
  $: timelineAvailableLaneWidth = Math.max(
    TIMELINE_MIN_LANE_WIDTH,
    timelineViewportWidth - TIMELINE_LABEL_WIDTH
  );
  // Seconds that fill the visible panel at the current scale.
  $: timelineFillPanelDuration =
    timelinePixelsPerSecond > 0 ? timelineAvailableLaneWidth / timelinePixelsPerSecond : 0;
  // At rest: content end, or the panel width if the content is shorter (so a
  // short clip looks short inside a filled ruler, with no trailing padding).
  // While dragging toward the end: grow to keep half a screen of room ahead of
  // the drag so it can be extended; existing clips keep their pixel position
  // because the scale is fixed.
  $: timelineVisibleDuration = Math.max(
    timelineContentEnd,
    timelineFillPanelDuration,
    timelineDragReach > 0 ? timelineDragReach + timelineFillPanelDuration * 0.5 : 0
  );
  $: timelineLaneWidth = timelineVisibleDuration * timelinePixelsPerSecond;
  $: timelineContentWidth = TIMELINE_LABEL_WIDTH + timelineLaneWidth;

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
        const currentAudioPath = scene.audio;
        const needsLoad = !audioUrl || currentAudioPath !== loadedAudioPath;
        
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

  async function renderFrame(time: number, exactVideoSeek = false) {
    if (!renderer || !scene) return;
    const frame = evaluateScene(scene, time);
    const outputScale = previewRenderScale();
    currentFrame = frame;
    const renderId = ++videoRenderId;
    const draw = () => {
      if (!renderer || renderId !== videoRenderId) return;
      renderer.render(frame, assets, outputScale);
      drawSelection(outputScale);
    };
    try {
      await synchronizeAnimatedAssets(frame, assets, {
        playing: exactVideoSeek ? false : isPlaying,
        exact: exactVideoSeek,
      });
      draw();
    } catch (error) {
      console.warn('Animated asset synchronization failed:', error);
    }
  }

  function drawSelection(outputScale = previewRenderScale()) {
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
    ctx.setTransform(outputScale, 0, 0, outputScale, 0, 0);
    ctx.strokeStyle = '#0a84ff';
    ctx.lineWidth = 2 / zoom;
    ctx.setLineDash([8 / zoom, 5 / zoom]);
    ctx.strokeRect(left + inset, top + inset, right - left - inset * 2, bottom - top - inset * 2);
    if (selectedElement?.kind === 'asset' || selectedElement?.kind === 'text' || selectedClip) {
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
    const failures: string[] = [];
    try {
      const loaded = await loadAssets(nextScene, document.baseURI, (name, error) => {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${name}: ${message}`);
      });
      if (loadId !== assetLoadId) {
        disposeAssets(loaded);
        return;
      }
      for (const asset of nextScene.imports) {
        const previous = previousAssets.get(asset.name);
        if (!loaded.has(asset.name) && previous) loaded.set(asset.name, previous);
      }
      for (const [name, previous] of previousAssets) {
        if (loaded.get(name) !== previous) disposeAssets(new Map([[name, previous]]));
      }
      assets = loaded;
      const missing = nextScene.imports.filter((asset) => !loaded.has(asset.name));
      assetError = [
        ...failures,
        ...(failures.length || !missing.length
          ? []
          : [`Could not load ${missing.map((asset) => asset.name).join(', ')}.`]),
        ...assetWarnings(loaded),
      ].join(' ');
      assetsReady = true;
      renderFrame(currentTime, true);
    } catch (error) {
      if (loadId !== assetLoadId) return;
      assetsReady = true;
      assetError = error instanceof Error ? `Loading assets failed: ${error.message}` : 'Loading assets failed.';
      console.warn('Asset load failed:', error);
    }
  }

  function rememberEmbeddedAssets(imports: Asset[]) {
    const remembered = new Map(embeddedAssets.map((asset) => [asset.name, asset]));
    for (const asset of imports) if (asset.path.startsWith('data:')) remembered.set(asset.name, asset);
    embeddedAssets = [...remembered.values()];
  }



  function play() {
    if (!scene || isPlaying) return;
    isPlaying = true;
    playbackTime = currentTime;
    resumeAudioAtTime(currentTime);

    const fps = scene.canvas.fps;
    let clockTime = currentTime;
    let clockStartedAt = performance.now();
    let previousFrame = -1;
    let lastUiUpdate = 0;
    
    async function animate(now: number) {
      if (!isPlaying) return;

      const audioIsClock = Boolean(
        audioUrl && audioElement && !audioElement.paused && !audioElement.ended
      );
      const nextTime = quantizeTimelineTime(
        audioIsClock
          ? (scene?.audioStart ?? 0) + audioElement.currentTime
          : playbackTimeFromClock(clockTime, clockStartedAt, now, totalDuration)
      );
      playbackTime = nextTime;
      if (audioIsClock) {
        clockTime = nextTime;
        clockStartedAt = now;
      } else {
        resumeAudioAtTime(nextTime);
      }

      const frame = Math.round(nextTime * fps);
      if (frame !== previousFrame) {
        previousFrame = frame;
        await renderFrame(nextTime);
        if (!isPlaying) {
          pauseAnimatedAssets(assets);
          return;
        }
      }
      if (now - lastUiUpdate >= 1000 / 30 || nextTime >= totalDuration) {
        currentTime = nextTime;
        lastUiUpdate = now;
      }
      if (nextTime >= totalDuration) {
        pause();
        return;
      }

      animationFrameId = requestAnimationFrame(animate);
    }

    animationFrameId = requestAnimationFrame(animate);
  }

  function pause() {
    const wasPlaying = isPlaying;
    isPlaying = false;
    if (wasPlaying) currentTime = playbackTime;
    audioElement?.pause();
    pauseAnimatedAssets(assets);
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
    // Clamp the playhead to the last clipbar end, not the padded ruler tail.
    return quantizeFrameTime(time, timelineContentEnd, scene?.canvas.fps ?? 60);
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
    const previousScale = previewRenderScale();
    const rect = stage.getBoundingClientRect();
    const next = Math.min((rect.width - 72) / canvasWidth, (rect.height - 72) / canvasHeight, 1);
    zoom = Math.max(0.08, Number(next.toFixed(3)));
    if (!isPlaying && Math.abs(previousScale - previewRenderScale()) > 0.01) {
      requestAnimationFrame(() => renderFrame(currentTime));
    }
  }

  function previewRenderScale(): number {
    const pixelRatio = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
    return Math.min(1, Math.max(0.08, zoom * Math.min(pixelRatio, 1.5)));
  }

  function toggleFullscreen() {
    isFullscreen = !isFullscreen;
    requestAnimationFrame(fitPreview);
  }

  function toggleCodeEditor() {
    showCodeEditor = !showCodeEditor;
  }

  function resizeContentPanel(event: PointerEvent) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = contentPanelWidth;
    const move = (pointer: PointerEvent) => {
      contentPanelWidth = Math.min(420, Math.max(220, startWidth + pointer.clientX - startX));
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
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

  // Reactive so clip/tick/playhead positions recompute when the visible
  // duration changes (e.g. on zoom), not just when the project duration does.
  $: timelinePercent = (time: number): number =>
    timelineVisibleDuration > 0
      ? Math.max(0, Math.min(100, (time / timelineVisibleDuration) * 100))
      : 0;

  async function handleAudioSelected(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    await importAudioFile(input.files?.[0]);
    input.value = '';
  }

  async function handleAudioFileDrop(event: DragEvent) {
    event.preventDefault();
    isDraggingUpload = false;
    await importAudioFile(event.dataTransfer?.files[0]);
  }

  async function importAudioFile(file: File | undefined) {
    if (!file || !ast) return;
    audioError = '';
    if (!file.type.startsWith('audio/') && !/\.(aac|flac|m4a|mp3|ogg|opus|wav)$/i.test(file.name)) {
      audioError = `${file.name} is not a supported audio file.`;
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      audioError = 'Audio files must be 50 MB or smaller.';
      return;
    }
    const loadId = ++audioLoadId;
    const dataUrl = await readFileDataUrl(file);
    if (loadId !== audioLoadId) return;
    if (audioUrl.startsWith('blob:')) URL.revokeObjectURL(audioUrl);
    audioUrl = dataUrl;
    loadedAudioPath = dataUrl;
    audioName = file.name;
    audioDuration = 0;
    audioElement.src = audioUrl;
    audioElement.muted = projectAudioTrack?.muted ?? false;
    audioElement.load();
    void loadAudioWaveform(file);
    ast.body = ast.body.filter((node) => node.type !== 'Audio');
    const insertAt = ast.body.findIndex(
      (node) => node.type === 'Import' || node.type === 'Track' || node.type === 'Element'
    );
    ast.body.splice(insertAt < 0 ? ast.body.length : insertAt, 0, {
      type: 'Audio',
      path: dataUrl,
      properties: {},
    });
    code = serializeProgram(ast);
  }

  async function loadAudioFromPath(path: string) {
    const loadId = ++audioLoadId;
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error('Failed to load audio');
      
      const blob = await response.blob();
      if (loadId !== audioLoadId) return;
      if (audioUrl.startsWith('blob:')) URL.revokeObjectURL(audioUrl);
      audioUrl = URL.createObjectURL(blob);
      loadedAudioPath = path;
      audioName = path.startsWith('data:audio/')
        ? 'Embedded audio'
        : path.substring(path.lastIndexOf('/') + 1);
      audioDuration = 0;
      
      if (audioElement) {
        audioElement.src = audioUrl;
        audioElement.load();
      }
      void loadAudioWaveform(blob);
    } catch (error) {
      if (loadId === audioLoadId) console.error('Failed to load audio:', error);
    }
  }

  async function loadAudioWaveform(blob: Blob) {
    const loadId = ++audioWaveformLoadId;
    audioWaveformPath = '';
    audioWaveformPeakCount = 0;
    audioWaveformLoading = true;
    let context: AudioContext | null = null;
    try {
      const source = await blob.arrayBuffer();
      if (loadId !== audioWaveformLoadId) return;
      context = new AudioContext();
      const buffer = await context.decodeAudioData(source);
      if (loadId !== audioWaveformLoadId) return;
      audioDuration = buffer.duration;
      const channels = Array.from(
        { length: buffer.numberOfChannels },
        (_, channel) => buffer.getChannelData(channel)
      );
      const peaks = await extractAudioPeaks(
        channels,
        waveformBucketCount(buffer.duration),
        () => loadId !== audioWaveformLoadId
      );
      if (loadId !== audioWaveformLoadId) return;
      audioWaveformPath = waveformPath(peaks);
      audioWaveformPeakCount = peaks.length;
    } catch (error) {
      if (loadId === audioWaveformLoadId) {
        console.warn('Could not generate audio waveform:', error);
      }
    } finally {
      if (context) await context.close().catch(() => undefined);
      if (loadId === audioWaveformLoadId) audioWaveformLoading = false;
    }
  }

  function clearAudioWaveform() {
    audioWaveformLoadId += 1;
    audioWaveformPath = '';
    audioWaveformPeakCount = 0;
    audioWaveformLoading = false;
  }

  function removeAudio() {
    pause();
    audioLoadId += 1;
    clearAudioWaveform();
    if (audioUrl.startsWith('blob:')) URL.revokeObjectURL(audioUrl);
    audioUrl = '';
    loadedAudioPath = '';
    audioName = '';
    audioDuration = 0;
    audioPlayPromise = null;
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

  function clearDeleteToast() {
    if (deleteToastTimer) clearTimeout(deleteToastTimer);
    deleteToast = '';
    deleteToastTimer = null;
    deleteUndoSource = null;
    deleteResultSource = null;
  }

  function showDeletedToast(label: string, previousSource: string, resultSource: string) {
    if (deleteToastTimer) clearTimeout(deleteToastTimer);
    deleteToast = label;
    deleteUndoSource = previousSource;
    deleteResultSource = resultSource;
    deleteToastTimer = setTimeout(clearDeleteToast, 5000);
  }

  function undoDelete() {
    const source = deleteUndoSource;
    if (!source) return;
    clearDeleteToast();
    pause();
    editorHistory = recordEditorSource(editorHistory, source);
    code = source;
  }

  function duplicateSelected() {
    const clip = scene?.clips.find((candidate) => candidate.id === selectedElementId);
    if (clip) duplicateClip(clip.id);
    else if (selectedElementId) duplicateElement(selectedElementId);
  }

  function duplicateElement(id: string) {
    if (!ast) return;
    const result = cloneElementInProgram(ast, id);
    if (!result) return;
    ast = result.program;
    selectedElementId = result.id;
    code = serializeProgram(ast);
  }

  function duplicateClip(clipId: string) {
    if (!ast || !scene) return;
    const sceneIndex = scene.clips.findIndex((clip) => clip.id === clipId);
    const sourceClip = scene.clips[sceneIndex];
    if (!sourceClip) return;
    const result = cloneClipInProgram(
      ast,
      sceneIndex,
      sourceClip,
      totalDuration,
      1 / scene.canvas.fps
    );
    if (!result) return;
    ast = result.program;
    selectedElementId = result.id;
    code = serializeProgram(ast);
  }

  function deleteElement(id: string) {
    if (!ast) return;
    const previousSource = code;
    ast.body = ast.body.filter(
      (node) =>
        !(node.type === 'Element' && node.name === id) &&
        !(node.type === 'Animation' && node.target === id)
    );
    selectedElementId = '';
    const resultSource = serializeProgram(ast);
    code = resultSource;
    showDeletedToast('Layer removed', previousSource, resultSource);
  }

  function deleteSelectedElement() {
    if (!ast || !selectedElementId) return;
    const id = selectedElementId;
    if (scene?.clips.some((clip) => clip.id === id)) deleteClip(id);
    else deleteElement(id);
  }

  function trimElement(event: PointerEvent, id: string, edge: 'start' | 'end') {
    event.preventDefault();
    event.stopPropagation();
    const laneEl = (event.currentTarget as HTMLElement).closest<HTMLElement>('.me-track-lane[data-track]');
    if (!laneEl) return;
    const trackId = laneEl.dataset['track'] ?? '';
    beginHistoryGesture();
    const update = (pointer: PointerEvent) => {
      // Fetch the lane live: the ruler (and this element) can grow/re-render
      // mid-trim, so a rect captured up front would go stale.
      const rect = timelineLaneRect(trackId) ?? laneEl.getBoundingClientRect();
      const raw = ((pointer.clientX - rect.left) / rect.width) * timelineVisibleDuration;
      if (edge === 'end') {
        timelineDragReach = raw;
        followTimelineDrag(raw);
      }
      setClipBoundary(id, edge, snapTimelineTime(raw, rect.width, id, raw + timelineFillPanelDuration));
    };
    const stop = () => {
      timelineSnapGuide = null;
      timelineDragReach = 0;
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
    extendProjectDuration(end);
    code = serializeProgram(ast);
  }

  function syncAudio(time = currentTime) {
    if (!audioUrl || !audioElement) return;
    audioElement.currentTime = Math.min(
      Math.max(0, time - (scene?.audioStart ?? 0)),
      audioDuration || time
    );
  }

  function resumeAudioAtTime(time: number) {
    if (!audioUrl || !audioElement || !scene) return;
    const localTime = time - scene.audioStart;
    if (localTime < 0 || localTime >= (audioDuration || Number.POSITIVE_INFINITY)) return;
    syncAudio(time);
    if (audioElement.paused && !audioPlayPromise) {
      const operation = audioElement.play().catch((error) => {
        console.warn('Audio playback failed (this is normal if no user interaction yet):', error.message);
      });
      audioPlayPromise = operation;
      void operation.finally(() => {
        if (audioPlayPromise === operation) audioPlayPromise = null;
      });
    }
  }



  function selectedAnimationTarget(): string {
    return selectedAnimationTargetId;
  }

  function selectedEvaluatedElement(): EvaluatedElement | Element | null {
    const id = selectedClip?.id ?? selectedElement?.id;
    return currentFrame?.elements.find((element) => element.id === id) ??
      selectedElement ??
      selectedClipElement;
  }

  function updateElementProperty(key: string, value: string | number | boolean) {
    updateElementProperties(selectedAnimationTarget(), { [key]: value });
  }

  function updateElementProperties(
    elementId: string,
    updates: Record<string, string | number | boolean>
  ) {
    if (!ast) return;
    const element = ensureAssetElement(elementId);
    if (!element) return;
    const animated = Object.fromEntries(
      Object.entries(updates).filter(([key]) => isPropertyAnimated([key]))
    );
    const staticUpdates = Object.fromEntries(
      Object.entries(updates).filter(([key]) => !(key in animated))
    );
    if (Object.keys(staticUpdates).length) {
      element.properties = { ...element.properties, ...staticUpdates };
    }
    if (Object.keys(animated).length) {
      const animation = materializeSelectedAnimation();
      if (animation) {
        ensureSeededKeyframes(animation);
        const offset = selectedAnimationOffset(animation);
        animation.keyframes = upsertKeyframe(
          animation.keyframes ?? [],
          offset,
          animated,
          selectedKeyframeTolerance(animation)
        );
        animation.from = {};
        animation.to = {};
        selectedKeyframeOffset = offset;
      }
    }
    code = serializeProgram(ast);
  }

  function selectedVisualProperty(key: string, fallback: number, _time = currentTime): number {
    return numericProperty(selectedEvaluatedElement(), key, fallback);
  }

  function selectedVisualStringProperty(key: string, fallback: string): string {
    return stringProperty(selectedEvaluatedElement(), key, fallback);
  }

  function handlePropertyScrubKey(event: KeyboardEvent, key: string, fallback: number, minimum = Number.NEGATIVE_INFINITY) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const direction = event.key === 'ArrowUp' ? 1 : -1;
    const step = event.shiftKey ? 10 : 1;
    updateElementProperty(key, Math.max(minimum, Math.round(selectedVisualProperty(key, fallback) + direction * step)));
  }

  function beginPropertyScrub(event: PointerEvent, key: string, fallback: number, minimum = Number.NEGATIVE_INFINITY) {
    if (event.button !== 0) return;
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    const startY = event.clientY;
    const startValue = selectedVisualProperty(key, fallback);
    const previousCursor = document.body.style.cursor;
    const previousSelection = document.body.style.userSelect;
    let lastValue = startValue;
    target.setPointerCapture?.(event.pointerId);
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    // Bracket the whole scrub gesture into one undo step.
    beginHistoryGesture();

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const sensitivity = moveEvent.shiftKey ? 0.1 : 0.5;
      const nextValue = Math.max(minimum, Math.round(startValue + (startY - moveEvent.clientY) * sensitivity));
      if (nextValue === lastValue) return;
      lastValue = nextValue;
      updateElementProperty(key, nextValue);
    };
    const finishScrub = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishScrub);
      window.removeEventListener('pointercancel', finishScrub);
      if (target.hasPointerCapture?.(event.pointerId)) target.releasePointerCapture(event.pointerId);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousSelection;
      endHistoryGesture();
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', finishScrub);
    window.addEventListener('pointercancel', finishScrub);
  }

  function ensureAssetElement(assetName: string): ElementNode | null {
    if (!ast) return null;
    const existing = ast.body.find(
      (item): item is ElementNode => item.type === 'Element' && item.name === assetName
    );
    if (existing) return existing;
    if (!ast.body.some((item) => item.type === 'Import' && item.name === assetName)) return null;
    const node: ElementNode = {
      type: 'Element',
      kind: 'asset',
      name: assetName,
      properties: { center: true },
    };
    ast.body.push(node);
    return node;
  }

  function resetElementSize() {
    if (!ast) return;
    const targetId = selectedElement?.kind === 'asset' ? selectedElement.id : selectedClip?.assetName;
    if (!targetId) return;
    const node = ensureAssetElement(targetId);
    if (!node) return;
    const properties = { ...node.properties };
    delete properties['width'];
    delete properties['height'];
    node.properties = properties;
    code = serializeProgram(ast);
  }

  function nudgeSelectedElement(x: number, y: number) {
    if (!selectedElement) return;
    updateElementProperties(selectedElement.id, {
      x: numericProperty(selectedElement, 'x', 0) + x,
      y: numericProperty(selectedElement, 'y', 0) + y,
    });
  }

  function handleCanvasPointerDown(event: PointerEvent) {
    if (!scene || !canvas) return;
    const point = pointerToCanvas(event);
    const selectedVisual =
      selectedElement ?? currentFrame?.elements.find((element) => element.id === selectedClip?.id);
    if (selectedVisual && (selectedVisual.kind === 'asset' || selectedVisual.kind === 'text')) {
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
          const visualId = selectedClip?.id ?? selectedVisual.id;
          // Bracket the whole resize gesture into one undo step.
          beginHistoryGesture();
          dragState = {
            mode: 'resize',
            id: selectedAnimationTarget() || selectedVisual.id,
            visualId,
            centerX,
            centerY,
            startDistance: Math.max(1, Math.hypot(point.x - centerX, point.y - centerY)),
            startScale: numericProperty(selectedVisual, 'scale', 1),
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
    const target =
      currentFrame?.elements.find((item) => item.id === targetId) ??
      scene.elements.find((item) => item.id === targetId);
    if (!target) return;
    const sourceTarget = scene.clips.find((clip) => clip.id === targetId)?.assetName ?? targetId;
    const center = elementCenter(target);
    // Bracket the whole move gesture into one undo step.
    beginHistoryGesture();
    dragState = {
      mode: 'move',
      id: sourceTarget,
      visualId: targetId,
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
    const element =
      currentFrame?.elements.find((item) => item.id === dragState?.visualId) ??
      scene.elements.find((item) => item.id === dragState?.visualId);
    if (!element) return;
    if (dragState.mode === 'resize') {
      const distance = Math.hypot(point.x - dragState.centerX, point.y - dragState.centerY);
      updateElementProperties(dragState.id, { scale: Number(Math.max(0.05, dragState.startScale * distance / dragState.startDistance).toFixed(3)) });
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
    const snapped = event.altKey || !snapEnabled
      ? { rect: proposedBounds, guides: { vertical: null, horizontal: null } }
      : snapRect(proposedBounds, others, scene.canvas, 6 / Math.max(zoom, 0.01));
    snapGuides = snapped.guides;
    nextX += snapped.rect.x - proposedBounds.x;
    nextY += snapped.rect.y - proposedBounds.y;
    updateElementProperties(dragState.id, { x: Math.round(nextX), y: Math.round(nextY) });
  }

  function handleCanvasPointerUp(event: PointerEvent) {
    dragState = null;
    snapGuides = { vertical: null, horizontal: null };
    // Collapse the move/resize gesture into a single undo entry (a no-op click
    // records nothing because the source never changed).
    endHistoryGesture();
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  }

  function alignSelected(alignment: Alignment) {
    const visual = selectedElement ?? selectedClipElement;
    if (!scene || !visual) return;
    const bounds = elementBounds(visual);
    const aligned = alignRect(bounds, scene.canvas, alignment);
    updateElementProperty('x', Math.round(numericProperty(visual, 'x', 0) + aligned.x - bounds.x));
    updateElementProperty('y', Math.round(numericProperty(visual, 'y', 0) + aligned.y - bounds.y));
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
    if (id !== selectedElementId) {
      selectedKeyframeOffset = null;
      moreOptionsOpen = false;
    }
    selectedTransitionIds = null;
    selectedElementId = id;
    if (seekToElement) setTime(firstVisibleTime(id));
    else renderFrame(currentTime);
  }

  function showMoreOptions(id: string) {
    selectElement(id, false);
    moreOptionsOpen = true;
  }

  function previewAssetOnly(asset: Asset) {
    const loaded = assets.get(asset.name);
    if (loaded) {
      previewAsset = {
        src: assetPreviewSource(loaded, asset.path),
        width: loaded.width,
        height: loaded.height,
        type: isLoadedVideo(loaded) ? 'video' : 'image',
      };
    }
  }

  function requestRemoveAssets(selectedAssets: Asset[]) {
    if (!ast || !selectedAssets.length) return;
    pendingDelete = {
      kind: 'assets',
      assets: selectedAssets,
      usageCount: selectedAssets.reduce((total, asset) => total + assetUsage(asset).usageCount, 0),
    };
    showConfirmDialog = true;
  }

  function requestRemoveAudio() {
    if (!audioName) return;
    pendingDelete = { kind: 'audio' };
    showConfirmDialog = true;
  }

  function requestRemoveElements(ids: string[]) {
    if (!ids.length) return;
    pendingDelete = { kind: 'text', ids };
    showConfirmDialog = true;
  }

  function assetUsage(asset: Asset) {
    const elementNames = new Set(
      ast.body.flatMap((node) =>
        node.type === 'Element' &&
        ((node.kind === 'asset' && node.name === asset.name) ||
          (node.kind === 'image' && node.properties['source'] === asset.name))
          ? [node.name]
          : []
      )
    );
    const usageCount =
      elementNames.size +
      ast.body.filter((node) => node.type === 'Clip' && node.assetName === asset.name).length;
    return { elementNames, usageCount };
  }

  function removeAssetNow(asset: Asset) {
    if (!ast) return;
    const { elementNames } = assetUsage(asset);
    const previousSource = code;
    ast.body = ast.body.filter(
      (node) =>
        !(node.type === 'Import' && node.name === asset.name) &&
        !(node.type === 'Clip' && node.assetName === asset.name) &&
        !(node.type === 'Element' && elementNames.has(node.name)) &&
        !(node.type === 'Animation' && elementNames.has(node.target))
    );
    embeddedAssets = embeddedAssets.filter((item) => item.name !== asset.name);
    selectedElementId = '';
    previewAsset = null;
    const resultSource = serializeProgram(ast);
    code = resultSource;
    showDeletedToast('Asset removed', previousSource, resultSource);
  }

  function clearAssetPreview() {
    previewAsset = null;
  }

  function handleAssetDragStart(event: DragEvent, asset: Asset) {
    const loaded = assets.get(asset.name);
    if (!loaded || (asset.type === 'video' && !loaded.motionlyDuration)) {
      event.preventDefault();
      assetError = `${asset.name} is still loading. Try again in a moment.`;
      return;
    }
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

  function handleAudioDragStart(event: DragEvent) {
    draggingAudio = true;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', audioName);
    }
  }

  function handleAudioDragEnd() {
    draggingAudio = false;
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

  // Dropping OS files directly onto the preview stage saves them into the asset
  // folder (Media panel), where they can be viewed, reused, or deleted.
  function handleStageFileDragOver(event: DragEvent) {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    stageDropActive = true;
  }

  function handleStageFileDragLeave(event: DragEvent) {
    if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) {
      stageDropActive = false;
    }
  }

  async function handleStageFileDrop(event: DragEvent) {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    stageDropActive = false;
    const added = await importAssetFiles(event.dataTransfer.files);
    if (added.length) {
      // Reveal the freshly imported media so the drop has a visible result.
      activeNavTab = 'media';
      mediaSubTab = 'assets';
    }
  }

  function handleAssetFileDrag(event: DragEvent) {
    if (event.dataTransfer?.types.includes('Files')) isDraggingUpload = true;
  }

  function handleAssetFileDragLeave(event: DragEvent) {
    if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) {
      isDraggingUpload = false;
    }
  }

  /**
   * Persist an uploaded/dragged file so the editor can reference it.
   *
   * In a server-backed project (npx init → CLI `dev`), the file is written into
   * the project's on-disk `assets/` folder via the local editor server and
   * referenced by relative path, so it becomes real, reusable project media.
   * In the browser-only editor (no project server) there is nowhere to write, so
   * the file is embedded in the `.motion` source as a tagged data URL instead.
   */
  async function persistAssetFile(file: File): Promise<string> {
    if (serverBacked) {
      const response = await fetch(`/assets/${encodeURIComponent(file.name)}`, {
        method: 'PUT',
        headers: { 'content-type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!response.ok) {
        throw new Error(`Could not save ${file.name} to the project assets folder (${response.status}).`);
      }
      return `./assets/${file.name}`;
    }
    return tagEmbeddedAssetPath(await readFileDataUrl(file), file.name);
  }

  async function importAssetFiles(fileList: FileList | null | undefined): Promise<string[]> {
    if (!ast) return [];
    const program = ast;
    assetError = '';
    const files = Array.from(fileList ?? []);
    if (!files.length) return [];
    const addedNames: string[] = [];
    for (const file of files) {
      const lowerName = file.name.toLowerCase();
      const isImage = file.type.startsWith('image/') || lowerName.endsWith('.svg');
      const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/.test(lowerName);
      const isLottie = file.type === 'application/zip+dotlottie' || lowerName.endsWith('.lottie');
      if (!isImage && !isVideo && !isLottie) {
        assetError = `${file.name} is not a supported image, SVG, GIF, video, or Lottie file.`;
        continue;
      }
      const maximumSize = isVideo ? 100_000_000 : isLottie ? 50_000_000 : 10_000_000;
      if (file.size > maximumSize) {
        assetError = `${file.name} is larger than ${isVideo ? '100' : isLottie ? '50' : '10'} MB.`;
        continue;
      }
      const matchingImports = program.body.filter(
        (node): node is ImportNode => node.type === 'Import' && assetFilename(node.path) === file.name
      );
      if (matchingImports.length) {
        const existing = matchingImports
          .map((node) => assets.get(node.name))
          .find((asset): asset is LoadedAsset => !!asset);
        let replacement: AssetIdentity;
        try {
          replacement = isLottie
            ? { width: 0, height: 0, size: file.size }
            : await readMediaIdentity(file, isVideo);
        } catch (cause) {
          assetError = cause instanceof Error ? cause.message : `Could not inspect ${file.name}.`;
          continue;
        }
        if (
          existing && replacement.width > 0 && replacement.height > 0 &&
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
        // Persist only after the replace decision so declining never overwrites disk media.
        let replacedPath = '';
        try {
          replacedPath = await persistAssetFile(file);
        } catch (cause) {
          assetError = cause instanceof Error ? cause.message : `Could not save ${file.name}.`;
          continue;
        }
        for (const node of matchingImports) node.path = replacedPath;
        assetError = `Matched ${file.name} to its existing import by filename.`;
        continue;
      }
      let path = '';
      try {
        path = await persistAssetFile(file);
      } catch (cause) {
        assetError = cause instanceof Error ? cause.message : `Could not save ${file.name}.`;
        continue;
      }
      const used = new Set(program.body.flatMap((node) => node.type === 'Import' ? [node.name] : node.type === 'Element' ? [node.name] : []));
      const base = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[^a-zA-Z_]/, 'asset_') || 'asset';
      let name = base;
      let suffix = 2;
      while (used.has(name)) name = `${base}_${suffix++}`;
      program.body.push({ type: 'Import', path, name });
      addedNames.push(name);
    }
    code = serializeProgram(program);
    return addedNames;
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



  function handleTimelineDragOver(event: DragEvent) {
    if (!draggingAsset && !draggingAudio) return;
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = draggingAudio ? 'move' : 'copy';
    }

    const timeline = event.currentTarget as HTMLElement;
    const rect = timeline.querySelector<HTMLElement>('.me-ruler')?.getBoundingClientRect();
    if (!rect) return;
    dropTargetTime = timelineTimeAt(event.clientX, rect);
    const track = (event.target as HTMLElement).closest<HTMLElement>('[data-track]')?.dataset['track'];
    if (draggingAudio) {
      dropTargetTrack = projectAudioTrack?.id ?? 'legacy-audio';
    } else {
      dropTargetTrack = track && !Number.isNaN(Number(track)) ? Number(track) : (track || 1);
    }
  }

  function handleTimelineDrop(event: DragEvent) {
    event.preventDefault();
    if (!ast || dropTargetTime === null) return;
    if (draggingAudio) {
      const node = ast.body.find((candidate): candidate is AudioNode => candidate.type === 'Audio');
      if (node) {
        node.properties = { ...node.properties, start: `${dropTargetTime.toFixed(3)}s` };
        code = serializeProgram(ast);
      }
      handleAudioDragEnd();
      return;
    }
    if (!draggingAsset) return;
    
    const assetName = draggingAsset.name;
    ensureAssetElement(assetName);
    const frame = 1 / (scene?.canvas.fps ?? 60);
    const loadedAsset = assets.get(assetName);
    const placement = placeMediaClip(
      dropTargetTime,
      loadedAsset?.motionlyDuration ?? 0,
      totalDuration,
      5,
      frame
    );
    const { start, duration } = placement;
    if (placement.timelineDuration > totalDuration) {
      const canvasNode = ast.body.find((candidate) => candidate.type === 'Canvas');
      if (canvasNode) {
        canvasNode.properties = {
          ...canvasNode.properties,
          duration: `${placement.timelineDuration.toFixed(3)}s`,
        };
      }
    }
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
        placement.timelineDuration
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
    const previousSource = code;
    const node = clipNodeAt(scene.clips.findIndex((clip) => clip.id === clipId));
    if (!node) return;
    detachClipTransitions(clipId);
    const next = removeClipFromTracks(scene.clips, clipId);
    writeClipLayout(next, false);
    ast.body.splice(ast.body.indexOf(node), 1);
    if (selectedElementId === clipId) selectedElementId = '';
    const resultSource = serializeProgram(ast);
    code = resultSource;
    showDeletedToast('Clip removed', previousSource, resultSource);
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
      `.me-track-lane[data-track="${CSS.escape(trackId)}"]`
    );
    return lane?.getBoundingClientRect() ?? null;
  }

  function laneTrackAtPoint(clientX: number, clientY: number): string | null {
    const hit = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    return hit?.closest<HTMLElement>('.me-track-lane[data-track]')?.dataset['track'] ?? null;
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
    const pointerTime = ((pointer.clientX - rect.left) / rect.width) * timelineVisibleDuration;
    // Follow the pointer; the ruler grows via timelineDragReach so there is
    // always room to keep extending. The project only grows on commit.
    const rawStart = Math.max(
      0,
      snapTimelineTime(
        pointerTime - clipDrag.grabOffset,
        rect.width,
        clipDrag.id,
        timelineVisibleDuration
      )
    );
    clipDrag = { ...clipDrag, ghostStart: rawStart, ghostTrackId: targetTrackId, valid: true };
    timelineDragReach = rawStart + clipDrag.duration;
    followTimelineDrag(timelineDragReach);
  }

  /** Keep the dragged/stretched end in view as the ruler grows behind it. */
  function followTimelineDrag(reachSeconds: number) {
    if (!timelineScroll) return;
    const endPx = TIMELINE_LABEL_WIDTH + Math.max(0, reachSeconds) * timelinePixelsPerSecond;
    const viewRight = timelineScroll.scrollLeft + timelineScroll.clientWidth;
    if (endPx > viewRight - 48) timelineScroll.scrollLeft = endPx - timelineScroll.clientWidth + 48;
  }

  function moveTimelineClip(event: PointerEvent, clip: Clip) {
    if (event.button !== 0 || !scene) return;
    event.preventDefault();
    event.stopPropagation();
    selectElement(clip.id, false);
    const rect = timelineLaneRect(String(clip.track));
    if (!rect) return;
    const grabTime = ((event.clientX - rect.left) / rect.width) * timelineVisibleDuration;
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

  /** Grow the canvas duration so a moved clip/element that ends past the current
   *  project end still fits inside the rendered timeline. */
  function extendProjectDuration(minDuration: number) {
    if (!ast || !Number.isFinite(minDuration) || minDuration <= totalDuration) return;
    const canvasNode = ast.body.find((candidate) => candidate.type === 'Canvas');
    if (canvasNode) {
      canvasNode.properties = {
        ...canvasNode.properties,
        duration: `${minDuration.toFixed(3)}s`,
      };
    }
  }

  function commitClipDrag() {
    const drag = clipDrag;
    clipDrag = null;
    timelineSnapGuide = null;
    timelineDragReach = 0;
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
        timelineVisibleDuration
      );
      if (next) {
        extendProjectDuration(drag.ghostStart + drag.duration);
        writeClipLayout(next);
      }
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
    extendProjectDuration(end);
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
    const originLane = (event.currentTarget as HTMLElement).closest<HTMLElement>('.me-track-lane[data-track]');
    const originTrackId =
      originLane?.dataset['track'] ??
      String(node.properties['track'] ?? scene.tracks.find((track) => track.role === 'overlay')?.id ?? defaultMainTrack);
    const rect = originLane?.getBoundingClientRect() ?? timelineLaneRect(originTrackId);
    if (!rect) return;
    const grabTime = ((event.clientX - rect.left) / rect.width) * timelineVisibleDuration;
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
    const lane = (event.currentTarget as HTMLElement).closest<HTMLElement>('.me-track-lane[data-track]');
    const rect = lane?.getBoundingClientRect();
    if (!rect) return;
    const grabTime = ((event.clientX - rect.left) / rect.width) * timelineVisibleDuration;
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
    const laneEl = (event.currentTarget as HTMLElement).closest<HTMLElement>('.me-track-lane[data-track]');
    if (!laneEl) return;
    const trackId = laneEl.dataset['track'] ?? '';
    beginHistoryGesture();
    const minimum = 1 / (scene?.canvas.fps ?? 60);
    const move = (pointer: PointerEvent) => {
      const rect = timelineLaneRect(trackId) ?? laneEl.getBoundingClientRect();
      const raw = ((pointer.clientX - rect.left) / rect.width) * timelineVisibleDuration;
      const time = snapTimelineTime(raw, rect.width, clip.id, raw + timelineFillPanelDuration);
      if (!scene) return;
      const next = trimClipOnTrack(
        scene.clips,
        clip.id,
        edge,
        time,
        minimum
      );
      const trimmed = next.find((candidate) => candidate.id === clip.id);
      if (trimmed) {
        const trimmedEnd = trimmed.start + trimmed.duration;
        extendProjectDuration(trimmedEnd);
        if (edge === 'end') {
          timelineDragReach = trimmedEnd;
          followTimelineDrag(trimmedEnd);
        }
      }
      writeClipLayout(next);
    };
    const stop = () => {
      timelineSnapGuide = null;
      timelineDragReach = 0;
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
    const raw = ((clientX - rect.left) / rect.width) * timelineVisibleDuration;
    return snapTimelineTime(raw, rect.width);
  }

  function snapTimelineTime(raw: number, width: number, excludeClipId = '', maxTime = totalDuration): number {
    const clamped = Math.max(0, Math.min(maxTime, raw));
    const fps = scene?.canvas.fps ?? 60;
    const frameTime = Math.round(clamped * fps) / fps;
    if (!snapEnabled) {
      timelineSnapGuide = null;
      return frameTime;
    }
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
    const snapped = Math.abs(nearest - clamped) <= (timelineVisibleDuration * 8) / Math.max(1, width);
    timelineSnapGuide = snapped ? nearest : null;
    return snapped ? nearest : frameTime;
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
    const target = selectedAnimationTarget();
    if (!ast || !target) return null;
    return ast.body.find(
      (node): node is AnimationNode => node.type === 'Animation' && node.target === target
    ) ?? null;
  }



  // Markers shown on the selected element's row. Explicit `animate` blocks show
  // their real keyframes; preset-driven animations (animation/textAnimation)
  // surface their compiled start/end (or keyframes) so every animated element
  // shows editable keyframes.
  function selectedKeyframeMarkers(): { offset: number; easing?: string; properties: string[] }[] {
    const node = selectedAnimationAst();
    if (node?.keyframes?.length)
      return node.keyframes.map((frame) => ({
        offset: frame.offset,
        easing: frame.easing,
        properties: Object.keys(frame.properties),
      }));
    if (node) {
      const animated =
        Object.keys(node.from ?? {}).length > 0 || Object.keys(node.to ?? {}).length > 0;
      if (animated) {
        return [
          { offset: 0, properties: Object.keys(node.from ?? {}) },
          { offset: 1, properties: Object.keys(node.to ?? {}) },
        ];
      }
    }
    // Preset-driven animation compiled into the scene graph.
    if (selectedAnimation) {
      if (selectedAnimation.keyframes?.length)
        return selectedAnimation.keyframes.map((frame) => ({
          offset: frame.offset,
          easing: frame.easing,
          properties: Object.keys(frame.properties),
        }));
      return [
        { offset: 0, properties: Object.keys(selectedAnimation.from ?? {}) },
        { offset: 1, properties: Object.keys(selectedAnimation.to ?? {}) },
      ];
    }
    return [];
  }

  /**
   * Return an editable `animate` AST node for the selected element, converting a
   * preset (animation/textAnimation) into explicit keyframes on first edit so
   * timing and easing changes persist. Conversion is intentionally best-effort.
   */
  function materializeSelectedAnimation(): AnimationNode | null {
    const target = selectedAnimationTarget();
    if (!ast || !target) return null;
    const existing = selectedAnimationAst();
    if (existing) return existing;
    const compiled = selectedAnimation;
    if (!compiled) return null;
    const created: AnimationNode = {
      type: 'Animation',
      target,
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
        candidate.type === 'Element' && candidate.name === target
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

  function createSelectedAnimation(): AnimationNode | null {
    const target = selectedAnimationTarget();
    if (!ast || !target) return null;
    const created: AnimationNode = {
      type: 'Animation',
      target,
      from: {},
      to: {},
      keyframes: [],
      delay: selectedClip?.start ?? 0,
      duration: selectedClip?.duration ?? totalDuration,
      easing: 'power3.out',
    };
    ast.body.push(created);
    return created;
  }

  function selectedAnimationTiming(node: AnimationNode): { delay: number; duration: number } {
    if (selectedAnimation?.target === node.target) {
      return { delay: selectedAnimation.delay, duration: selectedAnimation.duration };
    }
    const delay = Number.parseFloat(String(node.delay ?? 0));
    const duration = Number.parseFloat(String(node.duration ?? totalDuration));
    return {
      delay: Number.isFinite(delay) ? delay : 0,
      duration: Number.isFinite(duration) && duration > 0 ? duration : totalDuration,
    };
  }

  function selectedAnimationOffset(node: AnimationNode): number {
    const timing = selectedAnimationTiming(node);
    return keyframeOffsetAtTime(currentTime, timing.delay, timing.duration);
  }

  function selectedKeyframeTolerance(node: AnimationNode): number {
    const { duration } = selectedAnimationTiming(node);
    return 0.5 / Math.max(1, duration * (scene?.canvas.fps ?? 60));
  }

  /** Convert a from/to animation into explicit keyframes so edits persist. */
  function ensureSeededKeyframes(node: AnimationNode): void {
    if (
      !node.keyframes?.length &&
      (Object.keys(node.from ?? {}).length || Object.keys(node.to ?? {}).length)
    ) {
      node.keyframes = seedKeyframes(node.keyframes, node.from, node.to);
      node.from = {};
      node.to = {};
    }
  }

  function removeEmptyAnimation(node: AnimationNode) {
    if (
      ast &&
      !node.keyframes?.length &&
      !Object.keys(node.from ?? {}).length &&
      !Object.keys(node.to ?? {}).length
    ) {
      ast.body = ast.body.filter((candidate) => candidate !== node);
    }
  }

  function selectedAnimatedProperties(): string[] {
    const node = selectedAnimationAst();
    if (node) {
      return [...new Set([
        ...animatedProperties(node.keyframes),
        ...Object.keys(node.from ?? {}),
        ...Object.keys(node.to ?? {}),
      ])];
    }
    if (!selectedAnimation) return [];
    return [...new Set([
      ...animatedProperties(selectedAnimation.keyframes),
      ...Object.keys(selectedAnimation.from ?? {}),
      ...Object.keys(selectedAnimation.to ?? {}),
    ])];
  }

  function isPropertyAnimated(properties: string[]): boolean {
    const animated = new Set(selectedAnimatedProperties());
    return properties.some((property) => animated.has(property));
  }

  function hasPropertyKeyframeAtPlayhead(properties: string[]): boolean {
    const node = selectedAnimationAst();
    if (!node) return false;
    const offset = selectedAnimationOffset(node);
    if (hasKeyframeProperties(node.keyframes, offset, properties, selectedKeyframeTolerance(node))) {
      return true;
    }
    if (Math.abs(offset) < 1e-6) return properties.every((property) => property in (node.from ?? {}));
    if (Math.abs(offset - 1) < 1e-6) return properties.every((property) => property in (node.to ?? {}));
    return false;
  }

  function showKeyframeNotice(message: string) {
    if (keyframeNoticeTimer) clearTimeout(keyframeNoticeTimer);
    keyframeNotice = message;
    keyframeNoticeTimer = setTimeout(() => {
      keyframeNotice = '';
      keyframeNoticeTimer = null;
    }, 1600);
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
    const node = materializeSelectedAnimation();
    if (!ast || !node) return;
    ensureSeededKeyframes(node);
    if (!node.keyframes?.length) return;
    node.keyframes = removeKeyframe(node.keyframes, offset);
    removeEmptyAnimation(node);
    if (selectedKeyframeOffset !== null && Math.abs(selectedKeyframeOffset - offset) < 1e-6)
      selectedKeyframeOffset = null;
    code = serializeProgram(ast);
    showKeyframeNotice('Keyframe deleted');
  }

  $: selectedKeyframeEasingValue =
    code && selectedKeyframeOffset !== null ? keyframeEasingAt(selectedKeyframeOffset) : '';

  function keyframeTime(offset: number): number {
    const node = selectedAnimationAst();
    const timing = node
      ? selectedAnimationTiming(node)
      : { delay: selectedAnimation?.delay ?? 0, duration: selectedAnimation?.duration ?? 1 };
    return timing.delay + offset * timing.duration;
  }

  function capturedKeyframeProperties(keys?: string[]): Record<string, unknown> {
    const source = selectedEvaluatedElement() ? propertiesOf(selectedEvaluatedElement()!) : {};
    const element = ast?.body.find(
      (node): node is ElementNode =>
        node.type === 'Element' && node.name === selectedAnimationTarget()
    );
    const names = keys?.length
      ? keys
      : [
          ...new Set([
            ...DEFAULT_KEYFRAME_PROPERTIES,
            ...Object.keys(element?.properties ?? {}),
            ...selectedAnimatedProperties(),
          ]),
        ];
    return Object.fromEntries(
      names
        .filter((key) => {
          const value = source[key];
          return (
            !TIMING_PROPERTIES.has(key) &&
            (typeof value === 'number' ||
              (typeof value === 'string' && (value.startsWith('#') || value.startsWith('rgb'))))
          );
        })
        .map((key) => [key, source[key]])
    );
  }

  function addKeyframeAtPlayhead() {
    if (!ast || !selectedAnimationTarget()) return;
    const node = materializeSelectedAnimation() ?? createSelectedAnimation();
    if (!node) return;
    ensureSeededKeyframes(node);
    const offset = selectedAnimationOffset(node);
    node.keyframes = upsertKeyframe(
      node.keyframes ?? [],
      offset,
      capturedKeyframeProperties(),
      selectedKeyframeTolerance(node)
    );
    node.from = {};
    node.to = {};
    selectedKeyframeOffset = offset;
    code = serializeProgram(ast);
    showKeyframeNotice('Keyframe created');
  }

  function togglePropertyKeyframe(properties: string[]) {
    if (!ast || !selectedAnimationTarget()) return;
    const node = materializeSelectedAnimation() ?? createSelectedAnimation();
    if (!node) return;
    ensureSeededKeyframes(node);
    const offset = selectedAnimationOffset(node);
    const tolerance = selectedKeyframeTolerance(node);
    if (hasKeyframeProperties(node.keyframes, offset, properties, tolerance)) {
      node.keyframes = removeKeyframeProperties(node.keyframes ?? [], offset, properties, tolerance);
      removeEmptyAnimation(node);
      selectedKeyframeOffset = null;
      showKeyframeNotice(`${properties.join('/')} keyframe deleted`);
    } else {
      node.keyframes = upsertKeyframe(
        node.keyframes ?? [],
        offset,
        capturedKeyframeProperties(properties),
        tolerance
      );
      selectedKeyframeOffset = offset;
      showKeyframeNotice(`${properties.join('/')} keyframe created`);
    }
    node.from = {};
    node.to = {};
    removeEmptyAnimation(node);
    code = serializeProgram(ast);
  }

  function deleteSelectedKeyframe() {
    const node = materializeSelectedAnimation();
    if (!node || selectedKeyframeOffset === null) return;
    ensureSeededKeyframes(node);
    node.keyframes = removeKeyframe(node.keyframes ?? [], selectedKeyframeOffset);
    removeEmptyAnimation(node);
    selectedKeyframeOffset = null;
    code = serializeProgram(ast!);
    showKeyframeNotice('Keyframe deleted');
  }

  function dragKeyframeMarker(event: PointerEvent, offset: number) {
    if (event.button !== 0 || !selectedAnimationTarget()) return;
    event.preventDefault();
    event.stopPropagation();
    const lane = (event.currentTarget as HTMLElement).closest<HTMLElement>('.me-track-lane');
    if (!lane) return;
    const rect = lane.getBoundingClientRect();
    const startX = event.clientX;
    let node: AnimationNode | null = null;
    let frame: NonNullable<AnimationNode['keyframes']>[number] | null = null;
    let moved = false;
    selectKeyframeMarker(offset);
    const move = (pointer: PointerEvent) => {
      if (!moved && Math.abs(pointer.clientX - startX) < 3) return;
      if (!moved) {
        node = materializeSelectedAnimation();
        if (!node) return;
        ensureSeededKeyframes(node);
        frame = node.keyframes?.reduce<typeof frame>(
          (closest, candidate) =>
            !closest || Math.abs(candidate.offset - offset) < Math.abs(closest.offset - offset)
              ? candidate
              : closest,
          null
        ) ?? null;
        if (!frame) return;
        moved = true;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'ew-resize';
      }
      if (!node || !frame) return;
      const timing = selectedAnimationTiming(node);
      const raw = ((pointer.clientX - rect.left) / rect.width) * timelineVisibleDuration;
      const snappedTime = snapTimelineTime(raw, rect.width);
      const nextOffset = keyframeOffsetAtTime(snappedTime, timing.delay, timing.duration);
      frame.offset = nextOffset;
      node.keyframes = [...(node.keyframes ?? [])].sort((left, right) => left.offset - right.offset);
      selectedKeyframeOffset = nextOffset;
      currentTime = quantizeTimelineTime(timing.delay + nextOffset * timing.duration);
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      timelineSnapGuide = null;
      if (moved && node && ast) {
        node.keyframes = mergeCoincidentKeyframes(node.keyframes ?? []);
        code = serializeProgram(ast);
        showKeyframeNotice('Keyframe moved');
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  }

  function selectKeyframeMarker(offset: number) {
    selectedKeyframeOffset = offset;
    setTime(keyframeTime(offset));
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



  function moveSelectedKeyframeOffset(next: number) {
    const node = selectedAnimationAst();
    if (!node || selectedKeyframeOffset === null || !ast) return;
    node.keyframes = moveKeyframe(node.keyframes ?? [], selectedKeyframeOffset, next);
    selectedKeyframeOffset = next;
    code = serializeProgram(ast);
    setTime(keyframeTime(next));
    showKeyframeNotice('Keyframe moved');
  }

  function toggleTimelineSnap() {
    snapEnabled = !snapEnabled;
    timelineSnapGuide = null;
    snapGuides = { vertical: null, horizontal: null };
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

<div class="motion-editor-scope" style={`--timeline-height: ${timelineHeight}px`}>
<div class="me-motion-editor" class:me-fullscreen={isFullscreen} style={`--timeline-height: ${timelineHeight}px`}>
  <div class="me-workbench" class:me-chat-open={showAiChat} style={`--content-panel-width: ${contentPanelWidth}px`}>
    <NavigationRail activeTab={activeNavTab} onSelect={(tab) => (activeNavTab = tab)} />

    <ContentPanel
      bind:mediaSubTab
      bind:assetInput
      bind:audioInput
      {activeNavTab}
      {scene}
      {assets}
      {assetsReady}
      {isDraggingUpload}
      {assetError}
      {audioError}
      {audioName}
      {sourceElements}
      {selectedElementId}
      {assistantAssets}
      {aiProjectInfo}
      onAssetUpload={handleAssetUpload}
      onAssetFileDrag={handleAssetFileDrag}
      onAssetFileDragLeave={handleAssetFileDragLeave}
      onAssetFileDrop={handleAssetFileDrop}
      onAudioFileDrop={handleAudioFileDrop}
      onAudioDragStart={handleAudioDragStart}
      onAudioDragEnd={handleAudioDragEnd}
      onAssetDragStart={handleAssetDragStart}
      onAssetDragEnd={handleAssetDragEnd}
      onPreviewAsset={previewAssetOnly}
      onRemoveAssets={requestRemoveAssets}
      onRequestPresetLoad={requestPresetLoad}
      onRequestRemoveAudio={requestRemoveAudio}
      onAddTextElement={addTextElement}
      onSelectElement={selectElement}
      onRemoveElements={requestRemoveElements}
      {canApplyLibraryPreset}
      onApplyLibraryPreset={applyLibraryPreset}
      onTransitionDragStart={handleTransitionDragStart}
      onTransitionDragEnd={handleTransitionDragEnd}
      onResizeStart={resizeContentPanel}
    />

    <aside class="me-chat-drawer" class:me-collapsed={!showAiChat}>
      {#if showAiChat}
        <AiChatPanel project={code} assetList={assistantAssets} onLoadMotion={loadGeneratedMotion} onCollapse={() => showAiChat = false} />
      {:else}
        <button type="button" class="me-assistant-expand" on:click={() => showAiChat = true} title="Open Motionly Assistant" aria-label="Open Motionly Assistant">
          <Sparkles size={16} />
        </button>
      {/if}
    </aside>

    <PreviewStage
      bind:canvas
      bind:stage
      {canvasWidth}
      {canvasHeight}
      {zoom}
      {canvasStyle}
      {assetsReady}
      dragActive={Boolean(dragState)}
      {snapGuides}
      {previewAsset}
      {parseError}
      {exportError}
      fileDropActive={stageDropActive}
      onFit={fitPreview}
      onToggleFullscreen={toggleFullscreen}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerUp}
      onClearAssetPreview={clearAssetPreview}
      onFileDragOver={handleStageFileDragOver}
      onFileDragLeave={handleStageFileDragLeave}
      onFileDrop={handleStageFileDrop}
    />

    <PropertiesInspector
      bind:moreOptionsOpen
      {selectedTransition}
      {selectedElement}
      {selectedClip}
      {selectedClipElement}
      {selectedAnimation}
      {selectedKeyframeOffset}
      {selectedKeyframeEasingValue}
      {assets}
      {scene}
      {sourceElements}
      {totalDuration}
      {currentTime}
      onApplyTransition={applyTransitionAtBoundary}
      onRemoveTransition={removeSelectedTransition}
      onAlignSelected={alignSelected}
      {selectedVisualProperty}
      {selectedVisualStringProperty}
      {animatedPropertyNames}
      {isPropertyAnimated}
      {hasPropertyKeyframeAtPlayhead}
      onUpdateElementProperty={updateElementProperty}
      onGestureStart={beginHistoryGesture}
      onGestureEnd={endHistoryGesture}
      onTogglePropertyKeyframe={togglePropertyKeyframe}
      onBeginPropertyScrub={beginPropertyScrub}
      onPropertyScrubKey={handlePropertyScrubKey}
      {timelineRange}
      onSetClipBoundary={setClipBoundary}
      onResetElementSize={resetElementSize}
      {estimateElementWidth}
      onAddKeyframe={addKeyframeAtPlayhead}
      onMoveKeyframe={moveSelectedKeyframeOffset}
      onDeleteKeyframe={deleteSelectedKeyframe}
      onSetKeyframeEasing={setSelectedKeyframeEasing}
      onApplyPreset={applyPreset}
      {isBasicPreset}
      onUpdateAnimationProperty={updateAnimationProperty}
      onMoveSelectedClip={moveSelectedClipFromInspector}
      onResizeSelectedClip={resizeSelectedClipFromInspector}
      onUpdateClip={updateClip}
      onSplitSelectedClip={splitSelectedClip}
    />
  </div>

  <TimelinePanel
    bind:timelineScroll
    bind:audioInput
    bind:audioElement
    {isPlaying}
    {currentTime}
    {displayFrame}
    {selectedElement}
    {selectedClip}
    {selectedElementId}
    editorCanUndo={editorHistory.past.length > 0}
    editorCanRedo={editorHistory.future.length > 0}
    {snapEnabled}
    {timelineZoom}
    {timelineContentWidth}
    {timelineVisibleDuration}
    {scene}
    draggingAsset={draggingAsset !== null}
    {draggingAudio}
    {draggingTransition}
    {dropTargetTime}
    {timelineTicks}
    {timelineSnapGuide}
    {timelineRows}
    {timelineClipTracks}
    {clipDrag}
    {keyframeDragDelta}
    {selectedKeyframeOffset}
    {transitionBoundaries}
    {selectedTransition}
    {projectAudioTrack}
    {audioName}
    {audioClipDuration}
    {audioWaveformLoading}
    {audioWaveformPath}
    {visibleWaveformPeaks}
    {assets}
    onResizeTimeline={resizeTimeline}
    onResizeTimelineKey={resizeTimelineWithKeyboard}
    onReset={reset}
    onPlay={play}
    onPause={pause}
    onAudioSelected={handleAudioSelected}
    onRemoveAudio={removeAudio}
    onDuplicateSelected={duplicateSelected}
    onDeleteSelected={deleteSelectedElement}
    onUndo={undoEditor}
    onRedo={redoEditor}
    onSplitSelectedClip={splitSelectedClip}
    {timelineRange}
    onToggleSnap={toggleTimelineSnap}
    onSetTimelineZoom={setTimelineZoom}
    {timelinePercent}
    onTimelineDragOver={handleTimelineDragOver}
    onTimelineDrop={handleTimelineDrop}
    onTimelineDragLeave={() => (dropTargetTime = null)}
    onTimelineWheel={handleTimelineWheel}
    onSeek={seek}
    {timelineTrackDisplayOrder}
    onUpdateTrack={updateTrack}
    selectedKeyframeMarkers={selectedKeyframeMarkerList}
    {keyframeTime}
    onMoveTimelineElement={moveTimelineElement}
    onSelectElement={selectElement}
    onDuplicateElement={duplicateElement}
    onShowMoreOptions={showMoreOptions}
    onDeleteElement={deleteElement}
    onTrimElement={trimElement}
    onDragKeyframe={dragKeyframeMarker}
    onSelectKeyframe={selectKeyframeMarker}
    onDeleteKeyframeAt={deleteKeyframeAt}
    onAddKeyframe={addKeyframeAtPlayhead}
    onMoveTimelineAudio={moveTimelineAudio}
    onMoveTimelineClip={moveTimelineClip}
    onDuplicateClip={duplicateClip}
    onTrimTimelineClip={trimTimelineClip}
    onDeleteClip={deleteClip}
    onDropTransition={dropTransition}
    onSelectTransition={selectTransition}
    onAudioMetadata={(duration) => (audioDuration = duration)}
  />

  <SourceEditor bind:code open={showCodeEditor} {parseError} onToggle={toggleCodeEditor} />
</div>

<EditorFeedback
  {deleteToast}
  {keyframeNotice}
  {showConfirmDialog}
  dialogTitle={pendingDelete?.kind === 'assets'
    ? 'Delete Asset'
    : pendingDelete?.kind === 'audio'
      ? 'Delete Audio'
      : pendingDelete?.kind === 'text'
        ? 'Delete Text'
        : 'Load Preset'}
  dialogMessage={pendingDelete?.kind === 'assets'
    ? pendingDelete.assets.length === 1
      ? `${pendingDelete.assets[0].name} is used ${pendingDelete.usageCount} time${pendingDelete.usageCount === 1 ? '' : 's'}. Delete it and its timeline items?`
      : `Delete ${pendingDelete.assets.length} selected assets and their timeline items?`
    : pendingDelete?.kind === 'audio'
      ? `Delete ${audioName} and remove it from the timeline?`
      : pendingDelete?.kind === 'text'
        ? `Delete ${pendingDelete.ids.length === 1 ? pendingDelete.ids[0] : `${pendingDelete.ids.length} selected text layers`}?`
        : 'Loading this preset will replace your current project and assets. Continue?'}
  dialogConfirmLabel={pendingDelete ? 'Delete' : 'Load Preset'}
  onUndoDelete={undoDelete}
  onCancelDialog={cancelConfirmDialog}
  onConfirmDialog={confirmDialog}
/>
</div>
