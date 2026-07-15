<script lang="ts">
  import { onMount } from 'svelte';
  import { FileImage, Layers3, Maximize2, Minus, Music2, Pause, Play, Plus, RotateCcw, SkipBack, Sparkles, Square, Trash2, Type, Upload, X, FolderOpen, Headphones, Wand2 } from 'lucide-svelte';
  import { parseMotion } from '../../language/parser';
  import { buildSceneGraph } from '../../scene/scene-graph';
  import { evaluateScene } from '../../animation/evaluator';
  import { loadAssets } from '../../assets/asset-loader';
  import type { LoadedAsset } from '../../assets/asset-loader';
  import { CanvasRenderer } from '../../render/canvas-renderer';
  import { canExport, exportVideo } from '../../export/exporter';
  import { parsePresetCall } from '../../animation-library/preset-parser';
  import type { AnimationNode, CameraNode, ClipNode, ElementNode, ProgramNode } from '../../types/parser';
  import { serializeProgram } from '../../language/serializer';
  import type { Asset, Clip, Element, EvaluatedElement, EvaluatedScene, Scene } from '../../types/scene';
  import { packTimelineLanes, type TimelineLane } from '../timeline-lanes';
  import { restoreEmbeddedAssetPaths } from '../../ai/chat';
  import { appUrl } from '../../app/routing';
  import AiChatPanel from './AiChatPanel.svelte';

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
    | { mode: 'move'; id: string; offsetX: number; offsetY: number }
    | { mode: 'resize'; id: string; centerX: number; centerY: number; startDistance: number; startScale: number }
    | null = null;
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
  let activeNavTab: 'media' | 'audio' | 'text' | 'effects' | 'scenes' = 'media';
  let showAiChat = true;
  let mediaSubTab: 'assets' | 'presets' = 'assets';
  let showConfirmDialog = false;
  let pendingPresetPath = '';
  let previewAsset: { src: string; width: number; height: number } | null = null;
  let draggingAsset: Element | null = null;
  let dropTargetTime: number | null = null;
  let dropTargetTrack: number | string = 1;

  interface AnimationPresetDef {
    name: string;
    description: string;
    category: 'text' | 'object' | 'transition' | 'camera';
  }

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
      if (e.key === 'Escape' && previewAsset) {
        clearAssetPreview();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      observer.disconnect();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      window.removeEventListener('keydown', handleKeyDown);
    };
  });

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
    parseAndRender();
  }

  $: selectedElement =
    scene?.elements.find((element) => element.id === selectedElementId) ?? null;
  $: selectedClip = scene?.clips.find((clip) => clip.id === selectedElementId) ?? null;
  $: selectedAnimation =
    scene?.animations.find((animation) => animation.target === selectedElement?.id) ?? null;
  $: sourceElements = scene?.elements.filter((element) => !element.id.includes('__')) ?? [];
  $: timelineRows = packTimelineLanes(sourceElements, timelineRange);
  $: timelineClipTracks = groupClipsByTrack(scene?.clips ?? []);
  $: timelineTicks = Array.from({ length: 7 }, (_, index) => (totalDuration * index) / 6);
  $: displayFrame = Math.round(currentTime * (scene?.canvas.fps ?? 60));
  $: assistantAssets = mergeAssets(scene?.imports ?? [], embeddedAssets);
  $: canvasWidth = scene?.canvas.width ?? 1920;
  $: canvasHeight = scene?.canvas.height ?? 1080;
  $: canvasStyle = `width: ${Math.round(canvasWidth * zoom)}px; aspect-ratio: ${canvasWidth} / ${canvasHeight};`;

  function parseAndRender() {
    try {
      parseError = null;
      ast = parseMotion(code);
      scene = buildSceneGraph(ast);
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

  function renderFrame(time: number) {
    if (!renderer || !scene) return;
    currentFrame = evaluateScene(scene, time);
    renderer.render(currentFrame, assets);
    drawSelection();
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
      renderFrame(currentTime);
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
    if (audioUrl && audioElement) {
      audioElement.currentTime = Math.min(currentTime, audioDuration || currentTime);
      audioElement.play().catch((error) => {
        console.warn('Audio playback failed (this is normal if no user interaction yet):', error.message);
      });
    }

    const fps = scene.canvas.fps;
    const frameTime = 1000 / fps;
    let lastTime = performance.now();
    
    function animate(now: number) {
      if (!isPlaying) return;

      const delta = now - lastTime;
      if (delta >= frameTime) {
        if (audioUrl && audioElement && !audioElement.paused && !audioElement.ended) {
          currentTime = audioElement.currentTime;
        } else {
          currentTime += delta / 1000;
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
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  function reset() {
    pause();
    currentTime = 0;
    syncAudio();
    renderFrame(currentTime);
  }

  function seek(event: Event) {
    pause();
    currentTime = Number((event.currentTarget as HTMLInputElement).value);
    syncAudio();
    renderFrame(currentTime);
  }

  function setTime(time: number) {
    pause();
    currentTime = Math.max(0, Math.min(totalDuration, time));
    syncAudio();
    renderFrame(currentTime);
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

  function handleAudioSelected(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = URL.createObjectURL(file);
    audioName = file.name;
    audioDuration = 0;
    if (audioElement) {
      audioElement.src = audioUrl;
      audioElement.load();
    }
    audioInput.value = '';
    
    // Note: We can't save blob URLs to .motion file
    // Audio needs to be an actual file path for persistence
    // For now, audio remains session-only until user saves project with audio path
  }

  async function loadAudioFromPath(path: string) {
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error('Failed to load audio');
      
      const blob = await response.blob();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      audioUrl = URL.createObjectURL(blob);
      audioName = path.substring(path.lastIndexOf('/') + 1);
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
    const rect = lane.getBoundingClientRect();
    const update = (pointer: PointerEvent) => {
      const time = Math.max(0, Math.min(totalDuration, ((pointer.clientX - rect.left) / rect.width) * totalDuration));
      setClipBoundary(id, edge, time);
    };
    const stop = () => {
      window.removeEventListener('pointermove', update);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', update);
    window.addEventListener('pointerup', stop);
  }

  function setClipBoundary(id: string, edge: 'start' | 'end', time: number) {
    if (!ast) return;
    const range = timelineRange(id);
    const element = ast.body.find((node): node is ElementNode => node.type === 'Element' && node.name === id);
    const presetKey = element?.properties['animation'] ? 'animation' : element?.properties['textAnimation'] ? 'textAnimation' : null;

    if (element && presetKey) {
      const preset = parsePresetCall(element.properties[presetKey]);
      const options = { ...preset.options };
      if (edge === 'start') options['delay'] = Math.min(time, range.end - 0.1);
      else {
        const exitDuration = Number(options['exitDuration'] ?? 0.35);
        options['exitDuration'] = exitDuration;
        options['exitAt'] = Math.max(range.start, time - exitDuration);
      }
      element.properties[presetKey] = `${preset.name}(${Object.entries(options)
        .map(([key, value]) => `${key} ${['delay', 'duration', 'stagger', 'exitAt', 'exitDuration'].includes(key) && typeof value === 'number' ? `${Number(value.toFixed(3))}s` : value}`)
        .join(' ')})`;
      code = serializeProgram(ast);
      return;
    }

    const animations = ast.body.filter((node): node is AnimationNode => node.type === 'Animation' && node.target === id);
    if (edge === 'start') {
      const entry = animations.find((animation) => Number(animation.to?.['opacity'] ?? 1) > 0) ?? ensureAnimationNode(ast, id);
      entry.delay = Math.min(time, range.end - 0.1);
    } else {
      let exit = animations.find((animation) => Number(animation.to?.['opacity'] ?? 1) <= 0);
      if (!exit) {
        exit = { type: 'Animation', target: id, from: { opacity: 1 }, to: { opacity: 0 }, keyframes: [], easing: 'power2.in' };
        ast.body.push(exit);
      }
      exit.duration = 0.35;
      exit.delay = Math.max(range.start, time - 0.35);
    }
    code = serializeProgram(ast);
  }

  function syncAudio() {
    if (!audioUrl || !audioElement) return;
    audioElement.currentTime = Math.min(currentTime, audioDuration || currentTime);
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
    const nextX = Math.round(point.x - dragState.offsetX - (centered ? scene.canvas.width / 2 : 0));
    const nextY = Math.round(point.y - dragState.offsetY - (centered ? scene.canvas.height / 2 : 0));
    updateElementProperties(element.id, { x: nextX, y: nextY });
  }

  function handleCanvasPointerUp(event: PointerEvent) {
    dragState = null;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
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
    const editable = currentFrame.elements
      .filter((element) => element.kind === 'text' || element.kind === 'asset')
      .filter((element) => numericProperty(element, 'opacity', 1) > 0)
      .reverse();

    return editable.find((element) => {
      const bounds = elementBounds(element);
      return x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height;
    }) ?? null;
  }

  function selectElement(id: string, seekToElement = true) {
    selectedElementId = id;
    if (seekToElement) setTime(firstVisibleTime(id));
    else renderFrame(currentTime);
  }

  function previewAssetOnly(element: Element) {
    if (element.kind !== 'asset' || !element.assetName) return;
    const asset = assets.get(element.assetName);
    if (asset) {
      previewAsset = { src: asset.src, width: asset.width, height: asset.height };
    }
  }

  function clearAssetPreview() {
    previewAsset = null;
  }

  function handleAssetDragStart(event: DragEvent, element: Element) {
    if (!element.assetName) return;
    draggingAsset = element;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('text/plain', element.assetName);
    }
  }

  function handleAssetDragEnd() {
    draggingAsset = null;
    dropTargetTime = null;
    dropTargetTrack = 1;
  }

  async function handleAssetUpload(event: Event) {
    if (!ast) return;
    const program = ast;
    assetError = '';
    const files = Array.from((event.currentTarget as HTMLInputElement).files ?? []);
    for (const file of files) {
      if (!file.type.startsWith('image/') && !file.name.toLowerCase().endsWith('.svg')) {
        assetError = `${file.name} is not a supported image or SVG.`;
        continue;
      }
      if (file.size > 10_000_000) {
        assetError = `${file.name} is larger than 10 MB.`;
        continue;
      }
      let path = '';
      try {
        path = await readFileDataUrl(file);
      } catch (cause) {
        assetError = cause instanceof Error ? cause.message : `Could not read ${file.name}.`;
        continue;
      }
      const used = new Set(program.body.flatMap((node) => node.type === 'Import' ? [node.name] : node.type === 'Element' ? [node.name] : []));
      const base = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[^a-zA-Z_]/, 'asset_') || 'asset';
      let name = base;
      let suffix = 2;
      while (used.has(name)) name = `${base}_${suffix++}`;
      program.body.push(
        { type: 'Import', path, name },
        { type: 'Element', kind: 'asset', name, properties: { center: true, width: 480, layer: 'content' } }
      );
    }
    assetInput.value = '';
    code = serializeProgram(program);
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
    
    const assetName = draggingAsset.assetName;
    if (!assetName) return;
    const frame = 1 / (scene?.canvas.fps ?? 60);
    const duration = Math.min(5, Math.max(frame, totalDuration - dropTargetTime));
    const start = Math.min(dropTargetTime, Math.max(0, totalDuration - duration));
    const clipNode: ClipNode = {
      type: 'Clip',
      assetName,
      properties: {
        track: dropTargetTrack,
        start: `${start.toFixed(3)}s`,
        duration: `${duration.toFixed(3)}s`,
        trimIn: '0s',
        trimOut: '0s',
      },
    };
    ast.body.push(clipNode);
    code = serializeProgram(ast);
    draggingAsset = null;
    dropTargetTime = null;
    dropTargetTrack = 1;
  }

  function deleteClip(clipId: string) {
    if (!ast || !scene) return;
    const node = clipNodeAt(scene.clips.findIndex((clip) => clip.id === clipId));
    if (!node) return;
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

  function updateClip(clipId: string, updates: Record<string, string | number | boolean>) {
    if (!ast || !scene) return;
    const node = clipNodeAt(scene.clips.findIndex((clip) => clip.id === clipId));
    if (!node) return;
    node.properties = { ...node.properties, ...updates };
    code = serializeProgram(ast);
  }

  function moveTimelineClip(event: PointerEvent, clip: Clip) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    selectElement(clip.id, false);
    const lane = (event.currentTarget as HTMLElement).closest<HTMLElement>('.track-lane');
    if (!lane) return;
    const rect = lane.getBoundingClientRect();
    const startX = event.clientX;
    const startTime = clip.start;
    const move = (pointer: PointerEvent) => {
      const raw = startTime + ((pointer.clientX - startX) / rect.width) * totalDuration;
      const latestStart = Math.max(0, totalDuration - clip.duration);
      const next = Math.min(latestStart, snapTimelineTime(raw, rect.width, clip.id));
      updateClip(clip.id, { start: `${next.toFixed(3)}s` });
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  }

  function timelineTimeAt(clientX: number, rect: DOMRect): number {
    const raw = ((clientX - rect.left) / rect.width) * totalDuration;
    return snapTimelineTime(raw, rect.width);
  }

  function snapTimelineTime(raw: number, width: number, excludeClipId = ''): number {
    const clamped = Math.max(0, Math.min(totalDuration, raw));
    const fps = scene?.canvas.fps ?? 60;
    const frameTime = Math.round(clamped * fps) / fps;
    const candidates = [0, totalDuration, currentTime];
    for (const clip of scene?.clips ?? []) {
      if (clip.id === excludeClipId) continue;
      candidates.push(clip.start, clip.start + clip.duration);
    }
    for (const row of timelineRows) {
      for (const item of row.items) candidates.push(item.range.start, item.range.end);
    }
    const nearest = candidates.reduce((best, value) =>
      Math.abs(value - clamped) < Math.abs(best - clamped) ? value : best, 0);
    return Math.abs(nearest - clamped) <= (totalDuration * 8) / Math.max(1, width) ? nearest : frameTime;
  }

  function groupClipsByTrack(clips: Clip[]): Array<{ track: number | string; clips: Clip[] }> {
    const tracks = new Map<number | string, Clip[]>();
    for (const clip of clips) tracks.set(clip.track, [...(tracks.get(clip.track) ?? []), clip]);
    return Array.from(tracks, ([track, trackClips]) => ({ track, clips: trackClips }))
      .sort((a, b) => Number(b.track) - Number(a.track));
  }

  function timelineLaneLabel(row: TimelineLane): string {
    if (row.items.length === 1) return row.items[0].element.id;
    if (row.kind === 'text') return 'Text';
    if (row.kind === 'asset') return 'Images';
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
              <input bind:this={assetInput} class="file-input" type="file" accept="image/*,.svg" multiple on:change={handleAssetUpload} />
              <button type="button" class="header-icon-btn" on:click={() => assetInput.click()} title="Upload assets" aria-label="Upload assets">
                <Upload size={16} />
              </button>
            </div>
          {/if}
        </div>
        <div class="panel-content">
          {#if mediaSubTab === 'assets'}
            {#if assetError}<p class="asset-error">{assetError}</p>{/if}
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
            {#if sourceElements.filter(el => el.kind === 'asset').length > 0}
              <div class="asset-folder">
                <div class="folder-header">
                  <FileImage size={14} />
                  <span class="folder-title">Images & Graphics</span>
                  <span class="folder-count">{sourceElements.filter(el => el.kind === 'asset').length}</span>
                </div>
                <div class="asset-grid">
                  {#each sourceElements.filter(el => el.kind === 'asset') as element}
                    <button
                      type="button"
                      class="asset-card"
                      draggable="true"
                      on:click={() => previewAssetOnly(element)}
                      on:dragstart={(e) => handleAssetDragStart(e, element)}
                      on:dragend={handleAssetDragEnd}
                    >
                      <div class="asset-thumbnail">
                        {#if element.asset?.path}
                          <img src={assets.get(element.assetName ?? '')?.src ?? element.asset.path} alt={element.id} />
                        {:else}
                          <FileImage size={24} />
                        {/if}
                      </div>
                      <div class="asset-info">
                        <div class="asset-name">{element.id}</div>
                      </div>
                    </button>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Empty State -->
            {#if !scene?.audio && sourceElements.filter(el => el.kind === 'asset').length === 0}
              <p class="empty-state">No assets in project</p>
            {/if}
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
              <div class="category-title">Transitions</div>
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
        <canvas
          bind:this={canvas}
          width={canvasWidth}
          height={canvasHeight}
          class="preview-canvas"
          class:dragging={Boolean(dragState)}
          style={canvasStyle}
          on:pointerdown={handleCanvasPointerDown}
          on:pointermove={handleCanvasPointerMove}
          on:pointerup={handleCanvasPointerUp}
          on:pointercancel={handleCanvasPointerUp}
        ></canvas>
        {#if previewAsset}
          <button type="button" class="asset-preview-overlay" on:click={clearAssetPreview} aria-label="Close asset preview">
            <img 
              src={previewAsset.src} 
              alt="Asset preview" 
              style="max-width: 100%; max-height: 100%; object-fit: contain;"
            />
          </button>
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
      {#if selectedElement}
        <div class="selection-summary">
          <span class="layer-icon">
            {#if selectedElement.kind === 'asset' && selectedElement.asset?.path}<img src={assets.get(selectedElement.assetName ?? '')?.src ?? selectedElement.asset.path} alt="" />
            {:else if selectedElement.kind === 'text'}<Type size={15} />
            {:else if selectedElement.kind === 'asset'}<FileImage size={15} />
            {:else if selectedElement.kind === 'effect'}<Sparkles size={15} />
            {:else}<Square size={15} />{/if}
          </span>
          <span><strong>{selectedElement.id}</strong><small>{elementDetail(selectedElement)}</small></span>
        </div>
        
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
          <div class="property-label">Width</div>
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
        </div>
      {:else if selectedClip}
        <div class="selection-summary">
          <span class="layer-icon">
            {#if selectedClip.asset?.path}<img src={assets.get(selectedClip.assetName)?.src ?? selectedClip.asset.path} alt="" />
            {:else}<FileImage size={15} />{/if}
          </span>
          <span><strong>{selectedClip.assetName}</strong><small>Timeline clip</small></span>
        </div>
        <div class="property-group">
          <div class="property-label">Track</div>
          <input class="number-input" type="number" min="0" step="1" value={Number(selectedClip.track) || 0} on:input={(event) => updateClip(selectedClip.id, { track: Number(event.currentTarget.value) })} />
        </div>
        <div class="property-group">
          <div class="property-label">Start</div>
          <div class="number-input-wrapper">
            <input class="number-input" type="number" min="0" max={totalDuration} step="0.01" value={selectedClip.start} on:input={(event) => updateClip(selectedClip.id, { start: `${Number(event.currentTarget.value)}s` })} />
            <span class="input-suffix">s</span>
          </div>
        </div>
        <div class="property-group">
          <div class="property-label">Duration</div>
          <div class="number-input-wrapper">
            <input class="number-input" type="number" min="0.05" max={totalDuration} step="0.05" value={selectedClip.duration} on:input={(event) => updateClip(selectedClip.id, { duration: `${Math.max(0.05, Number(event.currentTarget.value))}s` })} />
            <span class="input-suffix">s</span>
          </div>
        </div>
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
        <button on:click={() => (zoom = Math.max(0.1, zoom - 0.05))} class="icon-btn" title="Zoom out"><Minus size={15} /></button>
        <button on:click={fitPreview} class="icon-btn" title="Fit preview"><RotateCcw size={15} /></button>
        <button on:click={() => (zoom = Math.min(1, zoom + 0.05))} class="icon-btn" title="Zoom in"><Plus size={15} /></button>
      </div>
    </div>

    <div 
      class="timeline-scroll" 
      class:drop-target={draggingAsset !== null}
      role="region"
      aria-label="Timeline tracks"
      on:dragover={handleTimelineDragOver}
      on:drop={handleTimelineDrop}
      on:dragleave={() => dropTargetTime = null}
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
          <input class="timeline-scrubber" type="range" min="0" max={totalDuration} step="0.001" value={currentTime} on:input={seek} aria-label="Timeline scrubber" />
        </div>
      </div>

      {#each timelineRows as row}
        <div class="timeline-row" class:selected={row.items.some((item) => item.element.id === selectedElementId)}>
          <div class="track-label">
            <span class="track-thumb">
              {#if row.items[0].element.kind === 'asset' && row.items[0].element.asset?.path}<img src={assets.get(row.items[0].element.assetName ?? '')?.src ?? row.items[0].element.asset.path} alt="" />
              {:else if row.kind === 'text'}<Type size={12} />
              {:else if row.kind === 'effect'}<Sparkles size={12} />
              {:else}<Square size={12} />{/if}
            </span>
            <span class="track-copy">
              <strong>{timelineLaneLabel(row)}</strong>
              <small>{row.items.length === 1 ? elementDetail(row.items[0].element) : `${row.items.length} connected clips`}</small>
            </span>
            <span class="track-time">{formatPreciseTime(row.start)} - {formatPreciseTime(row.end)}</span>
          </div>
          <div class="track-lane">
            {#each row.items as item}
              <span class="clip element-clip" class:selected-clip={item.element.id === selectedElementId} style={`left: ${timelinePercent(item.range.start)}%; width: ${Math.max(0.8, timelinePercent(item.range.end - item.range.start))}%`}>
                {#if item.element.kind === 'asset' && item.element.asset?.path}
                  <span
                    class="clip-media"
                    style={`background-image: url('${assets.get(item.element.assetName ?? '')?.src ?? item.element.asset.path}')`}
                  ></span>
                {:else if item.element.kind === 'text'}
                  <span class="clip-text">{stringProperty(item.element, 'value', item.element.id)}</span>
                {:else if item.element.kind === 'overlay'}
                  <span class="clip-color" style={`background: ${stringProperty(item.element, 'fill', '#34404e')}`}></span>
                {/if}
                <button type="button" class="clip-select" on:click={() => selectElement(item.element.id, false)} aria-label={`Select ${item.element.id}`}></button>
                <button type="button" class="trim-handle trim-start" on:pointerdown={(event) => trimElement(event, item.element.id, 'start')} aria-label={`Trim start of ${item.element.id}`}></button>
                <button type="button" class="trim-handle trim-end" on:pointerdown={(event) => trimElement(event, item.element.id, 'end')} aria-label={`Trim end of ${item.element.id}`}></button>
              </span>
            {/each}
            <span class="playhead" style={`left: ${timelinePercent(currentTime)}%`}></span>
          </div>
        </div>
      {/each}

      {#each timelineClipTracks as clipTrack}
          <div class="timeline-row clip-row" class:selected={clipTrack.clips.some((clip) => clip.id === selectedElementId)}>
            <div class="track-label">
              <span class="track-thumb">
                {#if clipTrack.clips[0]?.asset?.path}
                  <img src={assets.get(clipTrack.clips[0].assetName)?.src ?? clipTrack.clips[0].asset?.path} alt="" />
                {:else}
                  <FileImage size={12} />
                {/if}
              </span>
              <span class="track-copy">
                <strong>Track {clipTrack.track}</strong>
                <small>{clipTrack.clips.length} {clipTrack.clips.length === 1 ? 'clip' : 'clips'}</small>
              </span>
            </div>
            <div class="track-lane" data-track={clipTrack.track}>
              {#each clipTrack.clips as clip}
                <span class="clip timeline-clip" class:selected-clip={clip.id === selectedElementId} style={`left: ${timelinePercent(clip.start)}%; width: ${Math.max(0.8, timelinePercent(clip.duration))}%`}>
                  {#if clip.asset?.path}
                    <span
                      class="clip-media"
                      style={`background-image: url('${assets.get(clip.assetName)?.src ?? clip.asset.path}')`}
                    ></span>
                  {:else}
                    <span class="clip-text">{clip.assetName}</span>
                  {/if}
                  <button type="button" class="clip-select" on:pointerdown={(event) => moveTimelineClip(event, clip)} on:click={() => selectElement(clip.id, false)} aria-label={`Select ${clip.assetName} clip`}></button>
                  <button type="button" class="clip-delete" on:click|stopPropagation={() => deleteClip(clip.id)} title="Delete clip">
                    <X size={12} />
                  </button>
                </span>
              {/each}
              <span class="playhead" style={`left: ${timelinePercent(currentTime)}%`}></span>
            </div>
          </div>
      {/each}

      {#if audioName}
        <div class="timeline-row audio-row">
          <span class="track-label"><Music2 size={14} /><strong>{audioName}</strong></span>
          <span class="track-lane">
            <span class="clip audio-clip" style={`left: 0%; width: ${timelinePercent(Math.min(audioDuration || totalDuration, totalDuration))}%`}></span>
            <span class="playhead" style={`left: ${timelinePercent(currentTime)}%`}></span>
          </span>
        </div>
      {/if}
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

  .asset-thumbnail img {
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

  .preview-canvas {
    display: block;
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
    cursor: pointer;
    border-radius: 4px;
  }

  .asset-preview-overlay img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 4px;
  }

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
    overflow: auto;
    scrollbar-width: thin;
    scrollbar-color: #34373d #0d0e10;
  }

  .ruler-row,
  .timeline-row {
    width: 100%;
    min-width: 820px;
    display: grid;
    grid-template-columns: 220px minmax(600px, 1fr);
  }

  .ruler-row {
    position: sticky;
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

  .timeline-clip.selected-clip {
    border-color: #f1f2f4;
    box-shadow: 0 0 0 1px #7cf7c5;
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
    cursor: pointer;
  }

  .trim-handle {
    position: absolute;
    z-index: 2;
    top: -2px;
    bottom: -2px;
    width: 8px;
    padding: 0;
    border: 0;
    border-radius: 2px;
    background: #c7d0d9;
    opacity: 0;
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
  }

  .element-clip.selected-clip {
    border-color: #69cda9;
    background: #31594d;
  }

  .audio-clip {
    border-color: #725d86;
    background: #4e405d;
  }

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

  .audio-row {
    cursor: default;
  }

  .audio-row .track-label {
    cursor: default;
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
