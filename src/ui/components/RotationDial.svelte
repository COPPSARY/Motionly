<script lang="ts">
  import { FlipHorizontal2 } from 'lucide-svelte';

  export let value = 0;
  export let ariaLabel = 'Rotation';
  export let onChange: (angle: number) => void = () => undefined;

  let dial: HTMLDivElement;
  let dragging = false;
  let flipped = false;
  let angle = normalize(value);
  let lastExternalAngle = angle;

  $: {
    const nextExternalAngle = normalize(value);
    if (nextExternalAngle !== lastExternalAngle) {
      lastExternalAngle = nextExternalAngle;
      if (!dragging) angle = nextExternalAngle;
    }
  }

  function normalize(next: number): number {
    return ((Math.round(next) % 360) + 360) % 360;
  }

  function snap(next: number): number {
    const normalized = normalize(next);
    const nearest = normalize(Math.round(normalized / 45) * 45);
    const distance = Math.min(Math.abs(normalized - nearest), 360 - Math.abs(normalized - nearest));
    return distance <= 3 ? nearest : normalized;
  }

  function applyAngle(next: number, resetFlip = true) {
    angle = normalize(next);
    if (resetFlip) flipped = false;
    onChange(angle);
  }

  function pointerAngle(event: PointerEvent): number {
    const rect = dial.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    return snap((Math.atan2(y, x) * 180) / Math.PI + 90);
  }

  function updateFromPointer(event: PointerEvent) {
    const next = pointerAngle(event);
    if (next !== angle) applyAngle(next);
  }

  function startDrag(event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    dragging = true;
    dial.setPointerCapture(event.pointerId);
    updateFromPointer(event);
  }

  function moveDrag(event: PointerEvent) {
    if (dragging) updateFromPointer(event);
  }

  function endDrag(event: PointerEvent) {
    dragging = false;
    if (dial.hasPointerCapture(event.pointerId)) dial.releasePointerCapture(event.pointerId);
  }

  function toggleFlip() {
    flipped = !flipped;
    applyAngle(angle + 180, false);
  }

  function handleKeydown(event: KeyboardEvent) {
    let next = angle;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next += event.shiftKey ? 45 : 1;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next -= event.shiftKey ? 45 : 1;
    else if (event.key === 'Home') next = 0;
    else return;
    event.preventDefault();
    applyAngle(next);
  }
</script>

<div class="rotation-row" aria-label="Rotation controls">
  <div
    bind:this={dial}
    class="rotation-dial"
    class:dragging
    role="slider"
    tabindex="0"
    aria-label={ariaLabel}
    aria-valuemin="0"
    aria-valuemax="359"
    aria-valuenow={angle}
    on:pointerdown={startDrag}
    on:pointermove={moveDrag}
    on:pointerup={endDrag}
    on:pointercancel={endDrag}
    on:keydown={handleKeydown}
  >
    <span class="dial-arm" style={`transform: rotate(${angle}deg)`}>
      <span class="dial-line"></span>
    </span>
    <span class="dial-center"></span>
  </div>

  <label class="angle-field">
    <input type="number" min="0" max="359" value={angle} aria-label="Rotation angle" on:input={(event) => applyAngle(Number(event.currentTarget.value))} />
    <span>°</span>
  </label>

  {#each [0, 45, 90, 180] as preset}
    <button class="preset" type="button" class:active={angle === preset && !flipped} on:click={() => applyAngle(preset)}>{preset}°</button>
  {/each}
  <button class="preset flip" type="button" class:active={flipped} on:click={toggleFlip} aria-label="Flip rotation" data-tooltip="Flip 180°">
    <FlipHorizontal2 size={14} />
  </button>
</div>

<style>
  .rotation-row {
    width: 100%;
    display: grid;
    grid-template-columns: 30px 46px repeat(4, minmax(30px, 1fr)) 30px;
    align-items: center;
    gap: 4px;
  }
  .rotation-dial {
    position: relative;
    width: 30px;
    height: 30px;
    box-sizing: border-box;
    border: 1px solid #44444a;
    border-radius: 50%;
    background: #242428;
    outline: none;
    cursor: ew-resize;
    touch-action: none;
  }
  .rotation-dial:hover,
  .rotation-dial:focus-visible,
  .rotation-dial.dragging { border-color: #73737b; background: #2a2a2f; }
  .dial-arm { position: absolute; inset: 2px; pointer-events: none; }
  .dial-line {
    position: absolute;
    top: 2px;
    left: 50%;
    width: 1.5px;
    height: 11px;
    border-radius: 999px;
    background: #d7d7db;
    transform: translateX(-50%);
  }
  .dial-center {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #a2a2a9;
    transform: translate(-50%, -50%);
    pointer-events: none;
  }
  .angle-field { position: relative; width: 46px; height: 28px; display: flex; align-items: center; }
  .angle-field input {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    padding: 0 15px 0 7px;
    border: 1px solid rgba(255,255,255,.09);
    border-radius: 6px;
    outline: none;
    background: #1b1b1e;
    color: #dedee2;
    font: inherit;
    font-size: 10px;
    font-variant-numeric: tabular-nums;
    -moz-appearance: textfield;
    appearance: textfield;
  }
  .angle-field input::-webkit-inner-spin-button,
  .angle-field input::-webkit-outer-spin-button { display: none; -webkit-appearance: none; }
  .angle-field input:focus { border-color: #66666e; }
  .angle-field span { position: absolute; right: 6px; color: #73737b; font-size: 10px; pointer-events: none; }
  .preset {
    min-width: 0;
    height: 28px;
    display: grid;
    place-items: center;
    padding: 0 2px;
    border: 1px solid rgba(255,255,255,.09);
    border-radius: 6px;
    background: #1b1b1e;
    color: #85858d;
    font: inherit;
    font-size: 9px;
    font-weight: 550;
    cursor: pointer;
  }
  .preset:hover { border-color: #55555d; background: #27272b; color: #e7e7e9; }
  .preset.active { border-color: #66666e; background: #3a3a40; color: #fff; }
  .flip { position: relative; padding: 0; }
  .flip::after {
    content: attr(data-tooltip);
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    z-index: 20;
    padding: 5px 7px;
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 5px;
    background: #29292d;
    color: #f1f1f3;
    font-size: 9.5px;
    font-weight: 550;
    line-height: 1;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transform: translate(-50%, 3px);
    transition: opacity .12s ease, transform .12s ease;
  }
  .flip:hover::after,
  .flip:focus-visible::after { opacity: 1; transform: translate(-50%, 0); }
</style>
