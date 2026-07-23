<script lang="ts">
  import './preview-stage.css';
  import { Maximize2, X } from 'lucide-svelte';
  import type { SnapGuides } from '../../canvas-geometry';
  import type { AssetPreview } from './types';

  export let canvas: HTMLCanvasElement;
  export let stage: HTMLDivElement;
  export let canvasWidth: number;
  export let canvasHeight: number;
  export let zoom: number;
  export let canvasStyle: string;
  export let assetsReady: boolean;
  export let dragActive: boolean;
  export let snapGuides: SnapGuides;
  export let previewAsset: AssetPreview | null;
  export let parseError: string | null;
  export let exportError: string;
  export let onFit: () => void;
  export let onToggleFullscreen: () => void;
  export let onPointerDown: (event: PointerEvent) => void;
  export let onPointerMove: (event: PointerEvent) => void;
  export let onPointerUp: (event: PointerEvent) => void;
  export let onClearAssetPreview: () => void;
</script>

<main class="me-preview-container">
  <div class="me-stage-meta">
    <span>{canvasWidth} x {canvasHeight}</span>
    <div class="me-stage-actions">
      <button type="button" class="me-meta-btn" on:click={onFit}>Fit</button>
      <span>{Math.round(zoom * 100)}%</span>
      <button type="button" class="me-icon-btn" on:click={onToggleFullscreen} title="Fullscreen preview">
        <Maximize2 size={15} />
      </button>
    </div>
  </div>
  <div bind:this={stage} class="me-stage">
    {#if !assetsReady}<div class="me-stage-status" role="status"><span></span> Preparing project media…</div>{/if}
    <div class="me-canvas-shell" style={canvasStyle}>
      <canvas
        bind:this={canvas}
        width={canvasWidth}
        height={canvasHeight}
        class="me-preview-canvas"
        class:me-dragging={dragActive}
        on:pointerdown={onPointerDown}
        on:pointermove={onPointerMove}
        on:pointerup={onPointerUp}
        on:pointercancel={onPointerUp}
      ></canvas>
      {#if snapGuides.vertical !== null}
        <span class="me-snap-guide me-snap-guide-v" style={`left: ${(snapGuides.vertical / canvasWidth) * 100}%`}></span>
      {/if}
      {#if snapGuides.horizontal !== null}
        <span class="me-snap-guide me-snap-guide-h" style={`top: ${(snapGuides.horizontal / canvasHeight) * 100}%`}></span>
      {/if}
    </div>
    {#if previewAsset}
      <div class="me-asset-preview-overlay">
        {#if previewAsset.type === 'video'}
          <video src={previewAsset.src} controls autoplay muted playsinline></video>
        {:else}
          <img src={previewAsset.src} alt="Asset preview" />
        {/if}
        <button type="button" class="me-asset-preview-close" on:click={onClearAssetPreview} aria-label="Close asset preview"><X size={18} /></button>
      </div>
    {/if}
  </div>
  {#if parseError}
    <div class="me-error-banner">{parseError}</div>
  {:else if exportError}
    <div class="me-error-banner">{exportError}</div>
  {/if}
</main>
