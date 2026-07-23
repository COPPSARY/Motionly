<script lang="ts">
  import PreviewStage from '../../../src/ui/components/motion-editor/PreviewStage.svelte';
  import SourceEditor from '../../../src/ui/components/motion-editor/SourceEditor.svelte';

  export let onFit: () => void;
  export let onToggleFullscreen: () => void;
  export let onPointerDown: (event: PointerEvent) => void;
  export let onPointerMove: (event: PointerEvent) => void;
  export let onPointerUp: (event: PointerEvent) => void;

  let sourceCode = 'canvas { duration 1s }';
  let canvas: HTMLCanvasElement;
  let stage: HTMLDivElement;

  export function getSourceCode() {
    return sourceCode;
  }

  export function getPreviewBindings() {
    return { canvas, stage };
  }
</script>

<SourceEditor bind:code={sourceCode} open={true} parseError={null} onToggle={() => undefined} />
<PreviewStage
  bind:canvas
  bind:stage
  canvasWidth={320}
  canvasHeight={180}
  zoom={1}
  canvasStyle="width: 320px; aspect-ratio: 16 / 9"
  assetsReady={true}
  dragActive={false}
  snapGuides={{ vertical: null, horizontal: null }}
  previewAsset={null}
  parseError={null}
  exportError=""
  {onFit}
  {onToggleFullscreen}
  {onPointerDown}
  {onPointerMove}
  {onPointerUp}
  onClearAssetPreview={() => undefined}
/>
