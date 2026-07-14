<script lang="ts">
  import { onMount } from 'svelte';
  import { FileImage, Layers3, Maximize2, Minus, Music2, Pause, Play, Plus, RotateCcw, SkipBack, Sparkles, Square, Trash2, Type, Upload, X } from 'lucide-svelte';
  import { parseMotion } from '../../language/parser';
  import { buildSceneGraph } from '../../scene/scene-graph';
  import { evaluateScene } from '../../animation/evaluator';
  import { loadAssets } from '../../assets/asset-loader';
  import type { LoadedAsset } from '../../assets/asset-loader';
  import { CanvasRenderer } from '../../render/canvas-renderer';
  import { canExport, exportVideo } from '../../export/exporter';
  import { parsePresetCall } from '../../animation-library/preset-parser';
  import type { AnimationNode, ElementNode, ProgramNode } from '../../types/parser';
  import { serializeProgram } from '../../language/serializer';
  import type { Element, EvaluatedElement, EvaluatedScene, Scene } from '../../types/scene';

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
  let audioElement: HTMLAudioElement;
  let audioUrl = '';
  let audioName = '';
  let audioDuration = 0;
  let timelineHeight = 230;
  let mp4Supported = false;
  let isExporting = false;
  let exportProgress = 0;
  let exportError = '';

  onMount(() => {
    mp4Supported = canExport('mp4');
    if (canvas) {
      renderer = new CanvasRenderer(canvas);
      parseAndRender();
    }
    const observer = new ResizeObserver(fitPreview);
    if (stage) observer.observe(stage);
    requestAnimationFrame(fitPreview);
    return () => {
      observer.disconnect();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  });

  $: if (code) {
    parseAndRender();
  }

  $: selectedElement =
    scene?.elements.find((element) => element.id === selectedElementId) ?? null;
  $: selectedAnimation =
    scene?.animations.find((animation) => animation.target === selectedElement?.id) ?? null;
  $: sourceElements = scene?.elements.filter((element) => !element.id.includes('__')) ?? [];
  $: timelineRows = sourceElements.map((element) => ({ element, range: timelineRange(element.id) }));
  $: timelineTicks = Array.from({ length: 7 }, (_, index) => (totalDuration * index) / 6);
  $: displayFrame = Math.round(currentTime * (scene?.canvas.fps ?? 60));
  $: canvasWidth = scene?.canvas.width ?? 1920;
  $: canvasHeight = scene?.canvas.height ?? 1080;
  $: canvasStyle = `width: ${Math.round(canvasWidth * zoom)}px; aspect-ratio: ${canvasWidth} / ${canvasHeight};`;

  function parseAndRender() {
    try {
      parseError = null;
      ast = parseMotion(code);
      scene = buildSceneGraph(ast);
      totalDuration = scene.canvas.duration;
      currentTime = Math.min(currentTime, totalDuration);
      if (selectedElementId && !scene.elements.some((element) => element.id === selectedElementId)) selectedElementId = '';
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
    if (!canvas || !currentFrame || !selectedElement) return;
    const matches = currentFrame.elements.filter((element) => {
      const props = propertiesOf(element);
      return element.id === selectedElement.id || props['textGroup'] === selectedElement.id;
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
    const inset = selectedElement.kind === 'overlay' || selectedElement.kind === 'effect' ? 3 / zoom : 0;
    const handleSize = 10 / zoom;
    ctx.save();
    ctx.strokeStyle = '#7cf7c5';
    ctx.lineWidth = 2 / zoom;
    ctx.setLineDash([8 / zoom, 5 / zoom]);
    ctx.strokeRect(left + inset, top + inset, right - left - inset * 2, bottom - top - inset * 2);
    if (selectedElement.kind === 'asset' || selectedElement.kind === 'text') {
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
    try {
      const loaded = await loadAssets(nextScene);
      if (loadId !== assetLoadId) return;
      assets = loaded;
      assetsReady = true;
      renderFrame(currentTime);
    } catch (error) {
      console.warn('Asset load failed:', error);
    }
  }

  function play() {
    if (!scene) return;
    isPlaying = true;
    if (audioUrl && audioElement) {
      audioElement.currentTime = Math.min(currentTime, audioDuration || currentTime);
      void audioElement.play().catch(() => undefined);
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
  }

  function removeAudio() {
    pause();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = '';
    audioName = '';
    audioDuration = 0;
    if (audioElement) audioElement.removeAttribute('src');
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
    exportProgress = 0;
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
          exportProgress = progress;
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
    const target = scene.elements.find((item) => item.id === targetId) ?? element;
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

  function hitTest(x: number, y: number): Element | null {
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

  function firstVisibleTime(id: string): number {
    return timelineRange(id).start;
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
  <div class="workbench">
    <aside class="layers-panel">
      <div class="panel-heading">
        <div class="panel-title">Scene</div>
        <button type="button" class="small-btn" on:click={addTextElement} title="Add text">
          <Type size={15} />
          Text
        </button>
      </div>
      {#if scene}
        <div class="layer-list">
        {#each sourceElements as element}
          <button
            type="button"
            class="layer-row"
            class:selected={selectedElementId === element.id}
            on:click={() => selectElement(element.id)}
          >
            <span class="layer-icon">
              {#if element.kind === 'asset' && element.asset?.path}<img src={assets.get(element.assetName ?? '')?.src ?? element.asset.path} alt="" />
              {:else if element.kind === 'text'}<Type size={14} />
              {:else if element.kind === 'asset'}<FileImage size={14} />
              {:else if element.kind === 'effect'}<Sparkles size={14} />
              {:else}<Square size={14} />{/if}
            </span>
            <span class="layer-copy">
              <strong>{element.id}</strong>
              <small>{elementDetail(element)}</small>
            </span>
            <span class="layer-range">{formatTime(timelineRange(element.id).start)}</span>
          </button>
        {/each}
        </div>
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
        <label>
          Position
          <div class="row">
            <input type="number" value={numericProperty(selectedElement, 'x', 0)} on:input={(e) => updateElementProperty('x', Number(e.currentTarget.value))} />
            <input type="number" value={numericProperty(selectedElement, 'y', 0)} on:input={(e) => updateElementProperty('y', Number(e.currentTarget.value))} />
          </div>
        </label>
        <label>
          Scale
          <input type="number" min="0" step="0.05" value={numericProperty(selectedElement, 'scale', 1)} on:input={(e) => updateElementProperty('scale', Number(e.currentTarget.value))} />
        </label>
        {#if selectedElement.kind === 'asset'}
          <label>
            Width
            <input type="number" min="1" step="1" value={numericProperty(selectedElement, 'width', estimateElementWidth(selectedElement))} on:input={(e) => updateElementProperty('width', Number(e.currentTarget.value))} />
          </label>
        {/if}
        <label>
          Rotation
          <input type="number" value={numericProperty(selectedElement, 'rotation', 0)} on:input={(e) => updateElementProperty('rotation', Number(e.currentTarget.value))} />
        </label>
        <label>
          Opacity
          <input type="range" min="0" max="1" step="0.01" value={numericProperty(selectedElement, 'opacity', 1)} on:input={(e) => updateElementProperty('opacity', Number(e.currentTarget.value))} />
          <span>{Math.round(numericProperty(selectedElement, 'opacity', 1) * 100)}%</span>
        </label>

        {#if selectedElement.kind === 'overlay'}
          <label>
            Background
            <input type="color" value={stringProperty(selectedElement, 'fill', '#000000')} on:input={(e) => updateElementProperty('fill', e.currentTarget.value)} />
          </label>
        {/if}

        {#if selectedElement.kind === 'text'}
          <label>
            Text
            <textarea rows="3" value={stringProperty(selectedElement, 'value', '')} on:input={(e) => updateElementProperty('value', e.currentTarget.value)}></textarea>
          </label>
          <label>
            Font Size
            <input type="number" min="1" value={numericProperty(selectedElement, 'size', 72)} on:input={(e) => updateElementProperty('size', Number(e.currentTarget.value))} />
          </label>
          <label>
            Color
            <input type="color" value={stringProperty(selectedElement, 'color', '#ffffff')} on:input={(e) => updateElementProperty('color', e.currentTarget.value)} />
          </label>
        {/if}

        <div class="section-title">Animation</div>
        <label>
          Preset
          <select value={selectedAnimation ? 'custom' : 'none'} on:change={(e) => applyPreset(e.currentTarget.value)}>
            <option value="none">None</option>
            <option value="fade">Fade in</option>
            <option value="rise">Rise in</option>
            <option value="scale">Scale in</option>
            <option value="blur">Blur reveal</option>
            <option value="drift">Soft drift</option>
            {#if selectedAnimation}<option value="custom">Custom</option>{/if}
          </select>
        </label>
        <label>
          Duration
          <input type="number" min="0.1" step="0.1" value={selectedAnimation?.duration ?? 1} on:input={(e) => updateAnimationProperty('duration', Number(e.currentTarget.value))} />
        </label>
        <label>
          Delay
          <input type="number" min="0" step="0.1" value={selectedAnimation?.delay ?? 0} on:input={(e) => updateAnimationProperty('delay', Number(e.currentTarget.value))} />
        </label>
        <label>
          Easing
          <select value={selectedAnimation?.easing ?? 'soft'} on:change={(e) => updateAnimationProperty('easing', e.currentTarget.value)}>
            <option>soft</option>
            <option>power3.out</option>
            <option>linear</option>
            <option>ease-out</option>
            <option>spring</option>
            <option>smooth</option>
          </select>
        </label>
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
        <span>{selectedElement?.id ?? 'Timeline'}</span>
      </div>

      <div class="timeline-actions">
        <input bind:this={audioInput} class="file-input" type="file" accept="audio/*" on:change={handleAudioSelected} />
        {#if audioName}
          <span class="audio-chip"><Music2 size={13} /> {audioName}</span>
          <button class="icon-btn" on:click={removeAudio} title="Remove audio"><Trash2 size={14} /></button>
        {:else}
          <button class="timeline-command" on:click={() => audioInput.click()} title="Attach audio"><Upload size={14} /> Audio</button>
        {/if}
        {#if selectedElement}
          <button class="icon-btn danger-btn" on:click={deleteSelectedElement} title="Delete selected layer"><Trash2 size={14} /></button>
        {/if}
        <button on:click={() => (zoom = Math.max(0.1, zoom - 0.05))} class="icon-btn" title="Zoom out"><Minus size={15} /></button>
        <button on:click={fitPreview} class="icon-btn" title="Fit preview"><RotateCcw size={15} /></button>
        <button on:click={() => (zoom = Math.min(1, zoom + 0.05))} class="icon-btn" title="Zoom in"><Plus size={15} /></button>
      </div>
    </div>

    <div class="timeline-scroll">
      <div class="ruler-row">
        <div class="track-label ruler-label">Layers</div>
        <div class="ruler">
          {#each timelineTicks as tick}
            <span class="ruler-tick" style={`left: ${timelinePercent(tick)}%`}>{formatTime(tick)}</span>
          {/each}
          <span class="playhead-marker" style={`left: ${timelinePercent(currentTime)}%`}></span>
          <input class="timeline-scrubber" type="range" min="0" max={totalDuration} step="0.001" value={currentTime} on:input={seek} aria-label="Timeline scrubber" />
        </div>
      </div>

      {#each timelineRows as row}
        <div class="timeline-row" class:selected={selectedElementId === row.element.id}>
          <button type="button" class="track-label" on:click={() => selectElement(row.element.id)}>
            <span class="track-thumb">
              {#if row.element.kind === 'asset' && row.element.asset?.path}<img src={assets.get(row.element.assetName ?? '')?.src ?? row.element.asset.path} alt="" />
              {:else if row.element.kind === 'text'}<Type size={12} />
              {:else if row.element.kind === 'effect'}<Sparkles size={12} />
              {:else}<Square size={12} />{/if}
            </span>
            <span class="track-copy"><strong>{row.element.id}</strong><small>{elementDetail(row.element)}</small></span>
            <span class="track-time">{formatPreciseTime(row.range.start)} - {formatPreciseTime(row.range.end)}</span>
          </button>
          <div class="track-lane">
            <span class="clip" style={`left: ${timelinePercent(row.range.start)}%; width: ${Math.max(0.8, timelinePercent(row.range.end - row.range.start))}%`}>
              {#if row.element.kind === 'asset' && row.element.asset?.path}
                <span
                  class="clip-media"
                  style={`background-image: url('${assets.get(row.element.assetName ?? '')?.src ?? row.element.asset.path}')`}
                ></span>
              {:else if row.element.kind === 'text'}
                <span class="clip-text">{stringProperty(row.element, 'value', row.element.id)}</span>
              {:else if row.element.kind === 'overlay'}
                <span class="clip-color" style={`background: ${stringProperty(row.element, 'fill', '#34404e')}`}></span>
              {/if}
              <button type="button" class="clip-select" on:click={() => selectElement(row.element.id, false)} aria-label={`Select ${row.element.id}`}></button>
              <button type="button" class="trim-handle trim-start" on:pointerdown={(event) => trimElement(event, row.element.id, 'start')} aria-label={`Trim start of ${row.element.id}`}></button>
              <button type="button" class="trim-handle trim-end" on:pointerdown={(event) => trimElement(event, row.element.id, 'end')} aria-label={`Trim end of ${row.element.id}`}></button>
            </span>
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
    grid-template-columns: 220px minmax(0, 1fr) 300px;
  }

  .layers-panel,
  .properties-panel {
    min-height: 0;
    overflow: auto;
    background: #111214;
    border-color: #24262a;
    padding: 14px;
    scrollbar-width: thin;
    scrollbar-color: #34373d #111214;
  }

  .layers-panel {
    border-right: 1px solid #24262a;
  }

  .properties-panel {
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

  .panel-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 12px;
  }

  .panel-heading .panel-title {
    margin-bottom: 0;
  }

  .small-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid #363d4b;
    border-radius: 6px;
    background: #17191c;
    color: #e4e6ea;
    padding: 6px 8px;
    font-size: 12px;
    cursor: pointer;
  }

  .small-btn:hover {
    background: #202328;
  }

  .section-title {
    margin-top: 22px;
  }

  .layer-list {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .layers-panel .layer-row {
    width: 100%;
    min-height: 48px;
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr) auto;
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

  .layers-panel .layer-row:hover {
    background: #1a1c20;
  }

  .layers-panel .layer-row.selected {
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

  .layer-range {
    color: #777d86;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 10px;
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

  .properties-panel label {
    display: block;
    color: #a8adb5;
    font-size: 12px;
    margin-bottom: 13px;
  }

  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  input,
  select,
  textarea {
    width: 100%;
    box-sizing: border-box;
    margin-top: 6px;
    border: 1px solid #2a2d33;
    border-radius: 6px;
    background: #0d0e10;
    color: #f1f2f4;
    font: inherit;
    font-size: 13px;
    padding: 8px 9px;
    outline: none;
  }

  input:focus,
  select:focus,
  textarea:focus {
    border-color: #606772;
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.04);
  }

  input[type='range'] {
    padding: 0;
    accent-color: #d8dce2;
  }

  input[type='color'] {
    height: 36px;
    padding: 3px;
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
    cursor: pointer;
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

  .timeline-row.selected .clip {
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
    .workbench {
      grid-template-columns: 1fr;
    }

    .layers-panel,
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
