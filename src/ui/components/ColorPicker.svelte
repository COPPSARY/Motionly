<script lang="ts">
  import { Check, ChevronDown, Pipette } from 'lucide-svelte';

  export let value = '#ffffff';
  export let ariaLabel = 'Color';
  export let onChange: (color: string) => void = () => undefined;

  let root: HTMLDivElement;
  let open = false;

  const palette = [
    '#f8fafc', '#d1d5db', '#9ca3af', '#6b7280', '#374151', '#1f2937', '#111827', '#030712',
    '#fee2e2', '#fecaca', '#fca5a5', '#f87171', '#ef4444', '#dc2626', '#b91c1c', '#7f1d1d',
    '#ffedd5', '#fed7aa', '#fdba74', '#fb923c', '#f97316', '#ea580c', '#c2410c', '#7c2d12',
    '#fef3c7', '#fde68a', '#fcd34d', '#fbbf24', '#f59e0b', '#d97706', '#b45309', '#78350f',
    '#dcfce7', '#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#16a34a', '#15803d', '#14532d',
    '#ccfbf1', '#99f6e4', '#5eead4', '#2dd4bf', '#14b8a6', '#0d9488', '#0f766e', '#134e4a',
    '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e3a8a',
    '#ede9fe', '#ddd6fe', '#c4b5fd', '#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9', '#4c1d95',
    '#fce7f3', '#fbcfe8', '#f9a8d4', '#f472b6', '#ec4899', '#db2777', '#be185d', '#831843',
  ];

  $: normalizedValue = normalizeColor(value);

  function normalizeColor(color: string): string {
    const candidate = color.trim();
    if (/^#[0-9a-f]{6}$/i.test(candidate)) return candidate.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(candidate)) {
      return `#${candidate.slice(1).split('').map((digit) => `${digit}${digit}`).join('')}`.toLowerCase();
    }
    return '#ffffff';
  }

  function selectColor(color: string) {
    onChange(normalizeColor(color));
    open = false;
  }

  function commitHex(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const candidate = input.value.startsWith('#') ? input.value : `#${input.value}`;
    if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(candidate)) selectColor(candidate);
    else input.value = normalizedValue.toUpperCase();
  }

  function handleWindowPointerDown(event: PointerEvent) {
    if (open && root && !root.contains(event.target as Node)) open = false;
  }

  function handleWindowKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') open = false;
  }
</script>

<svelte:window on:pointerdown={handleWindowPointerDown} on:keydown={handleWindowKeyDown} />

<div class="color-picker" bind:this={root}>
  <button
    type="button"
    class="color-trigger"
    aria-label={ariaLabel}
    aria-haspopup="dialog"
    aria-expanded={open}
    on:click={() => (open = !open)}
  >
    <span class="trigger-swatch" style={`background: ${normalizedValue}`}></span>
    <span class="trigger-value">{normalizedValue.toUpperCase()}</span>
    <ChevronDown size={13} />
  </button>

  {#if open}
    <div class="color-popover" role="dialog" aria-label={`${ariaLabel} palette`}>
      <div class="picker-toolbar">
        <span class="toolbar-swatch" style={`background: ${normalizedValue}`}></span>
        <input
          class="hex-input"
          type="text"
          value={normalizedValue.toUpperCase()}
          maxlength="7"
          spellcheck="false"
          aria-label="Hex color"
          on:change={commitHex}
          on:keydown={(event) => event.key === 'Enter' && commitHex(event)}
        />
        <label class="custom-color" title="Choose a custom color" aria-label="Choose a custom color">
          <Pipette size={14} />
          <input type="color" value={normalizedValue} on:input={(event) => selectColor(event.currentTarget.value)} />
        </label>
      </div>

      <div class="palette-grid" aria-label="Color swatches">
        {#each palette as color}
          <button
            type="button"
            class:selected={color === normalizedValue}
            class="palette-swatch"
            style={`background: ${color}`}
            aria-label={`Set color ${color}`}
            title={color.toUpperCase()}
            on:click={() => selectColor(color)}
          >
            {#if color === normalizedValue}<Check size={11} strokeWidth={3} />{/if}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .color-picker {
    position: relative;
    width: 100%;
  }

  .color-trigger {
    width: 100%;
    height: 34px;
    display: grid;
    grid-template-columns: 20px 1fr auto;
    align-items: center;
    gap: 9px;
    padding: 0 10px 0 7px;
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 7px;
    background: #18181b;
    color: #b6b6bd;
    font: inherit;
    cursor: pointer;
  }

  .color-trigger:hover,
  .color-trigger[aria-expanded='true'] {
    border-color: rgba(138, 180, 255, 0.34);
    background: linear-gradient(135deg, rgba(138, 180, 255, 0.11), rgba(124, 247, 197, 0.055));
    color: #f2f2f4;
  }

  .trigger-swatch,
  .toolbar-swatch {
    display: block;
    border: 1px solid rgba(255, 255, 255, 0.24);
    border-radius: 5px;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.16);
  }

  .trigger-swatch {
    width: 20px;
    height: 20px;
  }

  .trigger-value {
    overflow: hidden;
    font-size: 11px;
    font-weight: 550;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
    text-align: left;
    text-overflow: ellipsis;
  }

  .color-popover {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: 80;
    width: 236px;
    box-sizing: border-box;
    padding: 9px;
    border: 1px solid rgba(255, 255, 255, 0.11);
    border-radius: 9px;
    background: #1b1b1e;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.42);
  }

  .picker-toolbar {
    height: 30px;
    display: grid;
    grid-template-columns: 26px 1fr 30px;
    gap: 6px;
    margin-bottom: 8px;
  }

  .toolbar-swatch {
    width: 26px;
    height: 30px;
    box-sizing: border-box;
  }

  .hex-input {
    min-width: 0;
    padding: 0 8px;
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 6px;
    outline: none;
    background: #121214;
    color: #dedee2;
    font: inherit;
    font-size: 10.5px;
    font-variant-numeric: tabular-nums;
    text-transform: uppercase;
  }

  .hex-input:focus {
    border-color: rgba(138, 180, 255, 0.5);
  }

  .custom-color {
    position: relative;
    display: grid;
    place-items: center;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 6px;
    background: #242428;
    color: #a8a8af;
    cursor: pointer;
  }

  .custom-color:hover {
    border-color: rgba(138, 180, 255, 0.34);
    color: #fff;
  }

  .custom-color input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }

  .palette-grid {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 3px;
  }

  .palette-swatch {
    width: 24px;
    height: 20px;
    display: grid;
    place-items: center;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    color: #fff;
    cursor: pointer;
  }

  .palette-swatch:hover {
    z-index: 1;
    border-color: rgba(255, 255, 255, 0.72);
    transform: scale(1.1);
  }

  .palette-swatch.selected {
    border-color: #fff;
    box-shadow: 0 0 0 1px #111114;
  }

  @media (prefers-reduced-motion: reduce) {
    .palette-swatch:hover {
      transform: none;
    }
  }
</style>
