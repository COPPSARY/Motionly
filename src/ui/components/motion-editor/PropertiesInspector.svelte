<script lang="ts">
  import './properties-inspector.css';
  import { AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd, AlignHorizontalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, AlignVerticalJustifyStart, FileImage, Sparkles, Square, Trash2, Type, Video, Wand2 } from 'lucide-svelte';
  import type { LoadedAsset } from '../../../assets/asset-loader';
  import type { AnimationNode } from '../../../types/parser';
  import type { Animation, Clip, Element, Scene } from '../../../types/scene';
  import type { Alignment } from '../../canvas-geometry';
  import type { ClipTransitionBoundary } from '../../clip-transitions';
  import ColorPicker from '../ColorPicker.svelte';
  import RotationDial from '../RotationDial.svelte';
  import { ADJUSTMENT_CONTROLS, KEYFRAME_EASINGS } from './constants';
  import { assetPreviewSource, elementDetail, numericProperty, propertiesOf, stringProperty } from './helpers';

  export let selectedTransition: ClipTransitionBoundary | null;
  export let selectedElement: Element | null;
  export let selectedClip: Clip | null;
  export let selectedClipElement: Element | null;
  export let selectedAnimation: Animation | null;
  export let selectedKeyframeOffset: number | null;
  export let selectedKeyframeEasingValue: string;
  export let moreOptionsOpen: boolean;
  export let assets: Map<string, LoadedAsset>;
  export let scene: Scene | null;
  export let sourceElements: Element[];
  export let totalDuration: number;
  export let currentTime: number;
  export let onApplyTransition: (boundary: ClipTransitionBoundary, duration: number) => void;
  export let onRemoveTransition: () => void;
  export let onAlignSelected: (alignment: Alignment) => void;
  export let selectedVisualProperty: (key: string, fallback: number) => number;
  export let onUpdateElementProperty: (key: string, value: string | number | boolean) => void;
  export let onBeginPropertyScrub: (event: PointerEvent, key: string, fallback: number, minimum?: number) => void;
  export let onPropertyScrubKey: (event: KeyboardEvent, key: string, fallback: number, minimum?: number) => void;
  export let timelineRange: (id: string) => { start: number; end: number };
  export let onSetClipBoundary: (id: string, edge: 'start' | 'end', time: number) => void;
  export let onResetElementSize: () => void;
  export let estimateElementWidth: (element: Element) => number;
  export let onAddKeyframe: () => void;
  export let onMoveKeyframe: (offset: number) => void;
  export let onDeleteKeyframe: () => void;
  export let onSetKeyframeEasing: (value: string) => void;
  export let onApplyPreset: (preset: string) => void;
  export let isBasicPreset: (preset: string) => boolean;
  export let onUpdateAnimationProperty: (key: keyof AnimationNode, value: string | number) => void;
  export let onMoveSelectedClip: (trackId: string, start: number) => void;
  export let onResizeSelectedClip: (duration: number) => void;
  export let onUpdateClip: (id: string, updates: Record<string, string | number | boolean>) => void;
  export let onSplitSelectedClip: () => void;
</script>

<aside class="me-properties-panel">
      <div class="me-panel-title">Properties</div>
      {#if selectedTransition}
        <div class="me-selection-summary">
          <span class="me-layer-icon"><Wand2 size={15} /></span>
          <span><strong>Crossfade</strong><small>{selectedTransition.outgoing.assetName} → {selectedTransition.incoming.assetName}</small></span>
        </div>
        <div class="me-property-group">
          <div class="me-property-label">Duration</div>
          <div class="me-number-input-wrapper">
            <input
              class="me-number-input"
              type="number"
              min="0.05"
              max={Math.min(selectedTransition.outgoing.duration, selectedTransition.incoming.duration)}
              step="0.05"
              value={selectedTransition.duration}
              on:change={(event) => onApplyTransition(selectedTransition, Number(event.currentTarget.value))}
            />
            <span class="me-input-suffix">s</span>
          </div>
        </div>
        <div class="me-transition-pair-copy">
          <span><small>Outgoing</small><strong>{selectedTransition.outgoing.assetName}</strong></span>
          <span class="me-transition-pair-arrow">→</span>
          <span><small>Incoming</small><strong>{selectedTransition.incoming.assetName}</strong></span>
        </div>
        <button type="button" class="me-timeline-command me-transition-remove" on:click={onRemoveTransition}>
          Remove transition
        </button>
      {:else if selectedElement}
        <div class="me-selection-summary">
          <span class="me-layer-icon">
            {#if selectedElement.kind === 'asset' && selectedElement.asset?.type === 'video'}<Video size={15} />
            {:else if selectedElement.kind === 'asset' && selectedElement.asset?.path}<img src={assetPreviewSource(assets.get(selectedElement.assetName ?? ''), selectedElement.asset.path)} alt="" />
            {:else if selectedElement.kind === 'text'}<Type size={15} />
            {:else if selectedElement.kind === 'asset'}<FileImage size={15} />
            {:else if selectedElement.kind === 'effect'}<Sparkles size={15} />
            {:else}<Square size={15} />{/if}
          </span>
          <span><strong>{selectedElement.id}</strong><small>{elementDetail(selectedElement)}</small></span>
        </div>

        <div class="me-primary-properties" aria-label="Primary properties">
          {#if selectedElement.kind === 'asset' || selectedElement.kind === 'text'}
          <div class="me-property-group me-primary-align-group">
            <div class="me-property-label">Align to canvas</div>
            <div class="me-property-align-actions me-flat-align-actions" aria-label="Align selected layer to canvas">
              <button type="button" on:click={() => onAlignSelected('left')} title="Align left" aria-label="Align left" data-tooltip="Align left"><AlignHorizontalJustifyStart size={15} /></button>
              <button type="button" on:click={() => onAlignSelected('center-x')} title="Align horizontal center" aria-label="Align horizontal center" data-tooltip="Center horizontally"><AlignHorizontalJustifyCenter size={15} /></button>
              <button type="button" on:click={() => onAlignSelected('right')} title="Align right" aria-label="Align right" data-tooltip="Align right"><AlignHorizontalJustifyEnd size={15} /></button>
              <button type="button" on:click={() => onAlignSelected('top')} title="Align top" aria-label="Align top" data-tooltip="Align top"><AlignVerticalJustifyStart size={15} /></button>
              <button type="button" on:click={() => onAlignSelected('center-y')} title="Align vertical center" aria-label="Align vertical center" data-tooltip="Center vertically"><AlignVerticalJustifyCenter size={15} /></button>
              <button type="button" on:click={() => onAlignSelected('bottom')} title="Align bottom" aria-label="Align bottom" data-tooltip="Align bottom"><AlignVerticalJustifyEnd size={15} /></button>
            </div>
          </div>
          {/if}
          <div class="me-property-group">
            <div class="me-property-label">Position</div>
            <div class="me-property-row">
              <div class="me-number-input-wrapper">
                <input class="me-number-input" type="number" value={selectedVisualProperty('x', 0)} on:input={(event) => onUpdateElementProperty('x', Number(event.currentTarget.value))} />
                <button type="button" class="me-input-suffix me-scrubbable-suffix" on:pointerdown={(event) => onBeginPropertyScrub(event, 'x', 0)} on:keydown={(event) => onPropertyScrubKey(event, 'x', 0)} aria-label="X position: drag up or down to adjust" title="Drag up or down to adjust X position">x</button>
              </div>
              <div class="me-number-input-wrapper">
                <input class="me-number-input" type="number" value={selectedVisualProperty('y', 0)} on:input={(event) => onUpdateElementProperty('y', Number(event.currentTarget.value))} />
                <button type="button" class="me-input-suffix me-scrubbable-suffix" on:pointerdown={(event) => onBeginPropertyScrub(event, 'y', 0)} on:keydown={(event) => onPropertyScrubKey(event, 'y', 0)} aria-label="Y position: drag up or down to adjust" title="Drag up or down to adjust Y position">y</button>
              </div>
            </div>
          </div>
          <div class="me-property-group me-rotation-property">
            <div class="me-property-label">Rotation</div>
            <RotationDial value={selectedVisualProperty('rotation', 0)} onChange={(angle) => onUpdateElementProperty('rotation', angle)} />
          </div>
          {#if selectedElement.kind === 'text'}
            <div class="me-property-group">
              <div class="me-property-label">Text</div>
              <textarea class="me-text-input" rows="3" value={stringProperty(selectedElement, 'value', '')} on:input={(event) => onUpdateElementProperty('value', event.currentTarget.value)}></textarea>
            </div>
            <div class="me-property-group">
              <div class="me-property-label">Font Size</div>
              <div class="me-number-input-wrapper">
                <input class="me-number-input" type="number" min="1" value={numericProperty(selectedElement, 'size', 72)} on:input={(event) => onUpdateElementProperty('size', Number(event.currentTarget.value))} />
                <button type="button" class="me-input-suffix me-scrubbable-suffix" on:pointerdown={(event) => onBeginPropertyScrub(event, 'size', 72, 1)} on:keydown={(event) => onPropertyScrubKey(event, 'size', 72, 1)} aria-label="Font size: drag up or down to adjust" title="Drag up or down to adjust font size">px</button>
              </div>
            </div>
          {/if}
          <div class="me-property-group">
            <div class="me-property-label">Scale</div>
            <div class="me-slider-control">
              <input class="me-custom-slider" type="range" min="0" max="3" step="0.01" value={numericProperty(selectedElement, 'scale', 1)} on:input={(event) => onUpdateElementProperty('scale', Number(event.currentTarget.value))} aria-label="Scale" />
              <input class="me-slider-value-input" type="number" min="0" step="0.01" value={numericProperty(selectedElement, 'scale', 1).toFixed(2)} on:input={(event) => onUpdateElementProperty('scale', Number(event.currentTarget.value))} aria-label="Scale value" />
            </div>
          </div>
          <div class="me-property-group">
            <div class="me-property-label">Opacity</div>
            <div class="me-slider-control">
              <input class="me-custom-slider" type="range" min="0" max="1" step="0.01" value={numericProperty(selectedElement, 'opacity', 1)} on:input={(event) => onUpdateElementProperty('opacity', Number(event.currentTarget.value))} aria-label="Opacity" />
              <input class="me-slider-value-input" type="number" min="0" max="100" value={Math.round(numericProperty(selectedElement, 'opacity', 1) * 100)} on:input={(event) => onUpdateElementProperty('opacity', Number(event.currentTarget.value) / 100)} aria-label="Opacity percentage" />
            </div>
          </div>
          <div class="me-property-group">
            <div class="me-property-label">Color</div>
            {#if selectedElement.kind === 'text'}
              <ColorPicker
                value={stringProperty(selectedElement, 'color', '#ffffff')}
                ariaLabel="Text color"
                onChange={(color) => onUpdateElementProperty('color', color)}
              />
            {:else if selectedElement.kind === 'overlay' || selectedElement.asset?.type === 'svg'}
              <ColorPicker
                value={stringProperty(selectedElement, 'fill', '#ffffff')}
                ariaLabel="Layer color"
                onChange={(color) => onUpdateElementProperty('fill', color)}
              />
            {:else}
              <div class="me-property-unavailable">Uses source media colors</div>
            {/if}
          </div>
          <div class="me-property-row me-timing-row">
            <div class="me-property-group">
              <div class="me-property-label">Start Time</div>
              <div class="me-number-input-wrapper">
                <input class="me-number-input" type="number" min="0" max={totalDuration} step="0.01" value={timelineRange(selectedElement.id).start} on:change={(event) => onSetClipBoundary(selectedElement.id, 'start', Number(event.currentTarget.value))} />
                <span class="me-input-suffix">s</span>
              </div>
            </div>
            <div class="me-property-group">
              <div class="me-property-label">Duration</div>
              <div class="me-number-input-wrapper">
                <input class="me-number-input" type="number" min={1 / (scene?.canvas.fps ?? 60)} max={totalDuration} step="0.01" value={timelineRange(selectedElement.id).end - timelineRange(selectedElement.id).start} on:change={(event) => onSetClipBoundary(selectedElement.id, 'end', timelineRange(selectedElement.id).start + Number(event.currentTarget.value))} />
                <span class="me-input-suffix">s</span>
              </div>
            </div>
          </div>
        </div>

        <details class="me-more-options" bind:open={moreOptionsOpen}>
          <summary>More Options</summary>
          <div class="me-more-options-content">
        {#if selectedElement.kind === 'asset'}
          <div class="me-property-group">
            <div class="me-property-label-row">
              <div class="me-property-label">Width</div>
              <button type="button" class="me-property-action" on:click={onResetElementSize}>Original size</button>
            </div>
            <div class="me-number-input-wrapper">
              <input class="me-number-input" type="number" min="1" step="1" value={numericProperty(selectedElement, 'width', estimateElementWidth(selectedElement))} on:input={(e) => onUpdateElementProperty('width', Number(e.currentTarget.value))} />
              <span class="me-input-suffix">px</span>
            </div>
          </div>
        {/if}

        {#if selectedElement.kind === 'asset'}
          <div class="me-property-group">
            <div class="me-property-label">Transform Origin</div>
            <div class="me-property-row">
              <div class="me-number-input-wrapper">
                <input class="me-number-input" type="number" min="0" max="1" step="0.05" value={numericProperty(selectedElement, 'originX', 0.5)} on:input={(e) => onUpdateElementProperty('originX', Number(e.currentTarget.value))} />
                <span class="me-input-suffix">x</span>
              </div>
              <div class="me-number-input-wrapper">
                <input class="me-number-input" type="number" min="0" max="1" step="0.05" value={numericProperty(selectedElement, 'originY', 0.5)} on:input={(e) => onUpdateElementProperty('originY', Number(e.currentTarget.value))} />
                <span class="me-input-suffix">y</span>
              </div>
            </div>
          </div>

          <div class="me-property-group">
            <div class="me-property-label">Skew</div>
            <div class="me-property-row">
              <div class="me-number-input-wrapper">
                <input class="me-number-input" type="number" step="1" value={numericProperty(selectedElement, 'skewX', 0)} on:input={(e) => onUpdateElementProperty('skewX', Number(e.currentTarget.value))} />
                <span class="me-input-suffix">x°</span>
              </div>
              <div class="me-number-input-wrapper">
                <input class="me-number-input" type="number" step="1" value={numericProperty(selectedElement, 'skewY', 0)} on:input={(e) => onUpdateElementProperty('skewY', Number(e.currentTarget.value))} />
                <span class="me-input-suffix">y°</span>
              </div>
            </div>
          </div>

          {#if selectedElement.asset?.type === 'svg' && !assets.get(selectedElement.assetName ?? '')?.motionlySvg?.animated}
            <div class="me-property-group">
              <div class="me-property-label">SVG Stroke Override</div>
              <ColorPicker
                value={stringProperty(selectedElement, 'stroke', '#ffffff')}
                ariaLabel="SVG stroke color"
                onChange={(color) => onUpdateElementProperty('stroke', color)}
              />
            </div>
          {/if}
        {/if}

        <div class="me-section-title">Layer Mask</div>
        <div class="me-property-group">
          <div class="me-property-label">Use layer as alpha</div>
          <select
            class="me-text-input me-mask-select"
            value={stringProperty(selectedElement, 'mask', 'none')}
            on:change={(event) => onUpdateElementProperty('mask', event.currentTarget.value)}
          >
            <option value="none">None</option>
            {#each sourceElements.filter((candidate) => candidate.id !== selectedElement?.id) as candidate}
              <option value={candidate.id}>{candidate.id}</option>
            {/each}
          </select>
        </div>
        {#if stringProperty(selectedElement, 'mask', 'none') !== 'none'}
          <label class="me-toggle-row">
            <input type="checkbox" checked={Boolean(propertiesOf(selectedElement)['maskInvert'])} on:change={(event) => onUpdateElementProperty('maskInvert', event.currentTarget.checked)} />
            <span>Invert alpha</span>
          </label>
          <label class="me-toggle-row">
            <input type="checkbox" checked={Boolean(propertiesOf(selectedElement)['maskVisible'])} on:change={(event) => onUpdateElementProperty('maskVisible', event.currentTarget.checked)} />
            <span>Show mask layer</span>
          </label>
        {/if}

        {#if selectedElement.kind === 'asset'}
          <div class="me-section-title">Adjustments</div>
          {#each ADJUSTMENT_CONTROLS as control}
            <div class="me-property-group">
              <div class="me-property-label">{control.label}</div>
              <div class="me-slider-control">
                <input
                  class="me-custom-slider"
                  type="range"
                  min={control.min}
                  max={control.max}
                  step={control.step}
                  value={numericProperty(selectedElement, control.property, control.fallback)}
                  on:input={(event) => onUpdateElementProperty(control.property, Number(event.currentTarget.value))}
                />
                <input
                  class="me-slider-value-input"
                  type="number"
                  min={control.min}
                  max={control.max}
                  step={control.step}
                  value={numericProperty(selectedElement, control.property, control.fallback)}
                  on:input={(event) => onUpdateElementProperty(control.property, Number(event.currentTarget.value))}
                />
              </div>
            </div>
          {/each}
        {/if}

        <div class="me-section-title">Keyframes</div>
        <div class="me-property-group me-keyframe-controls">
          <button type="button" class="me-timeline-command" on:click={onAddKeyframe}>◆ Add at playhead</button>
          {#if selectedKeyframeOffset !== null}
            <div class="me-number-input-wrapper">
              <input
                class="me-number-input"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={Number((selectedKeyframeOffset * 100).toFixed(1))}
                on:change={(event) => onMoveKeyframe(Math.min(1, Math.max(0, Number(event.currentTarget.value) / 100)))}
              />
              <span class="me-input-suffix">%</span>
            </div>
            <button type="button" class="me-icon-btn me-danger-btn" on:click={onDeleteKeyframe} title="Delete selected keyframe"><Trash2 size={14} /></button>
          {/if}
        </div>
        {#if selectedKeyframeOffset !== null}
          <div class="me-property-group">
            <div class="me-property-label">Keyframe easing (into this keyframe)</div>
            <select
              class="me-text-input"
              value={selectedKeyframeEasingValue}
              on:change={(event) => onSetKeyframeEasing(event.currentTarget.value)}
            >
              <option value="">Animation default</option>
              {#each KEYFRAME_EASINGS as option}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </div>
        {/if}

        <div class="me-section-title">Animation</div>
        
        <div class="me-property-group">
          <div class="me-property-label">Preset</div>
          <div class="me-preset-cards">
            <button 
              type="button" 
              class="me-preset-option" 
              class:me-active={!selectedAnimation}
              on:click={() => onApplyPreset('none')}
            >
              None
            </button>
            <button 
              type="button" 
              class="me-preset-option" 
              class:me-active={isBasicPreset('fade')}
              on:click={() => onApplyPreset('fade')}
            >
              Fade
            </button>
            <button 
              type="button" 
              class="me-preset-option" 
              class:me-active={isBasicPreset('rise')}
              on:click={() => onApplyPreset('rise')}
            >
              Rise
            </button>
            <button 
              type="button" 
              class="me-preset-option" 
              class:me-active={isBasicPreset('scale')}
              on:click={() => onApplyPreset('scale')}
            >
              Scale
            </button>
            <button 
              type="button" 
              class="me-preset-option" 
              class:me-active={isBasicPreset('blur')}
              on:click={() => onApplyPreset('blur')}
            >
              Blur
            </button>
            <button 
              type="button" 
              class="me-preset-option" 
              class:me-active={isBasicPreset('drift')}
              on:click={() => onApplyPreset('drift')}
            >
              Drift
            </button>
          </div>
        </div>

        <div class="me-property-group">
          <div class="me-property-label">Animation Duration</div>
          <div class="me-number-input-wrapper">
            <input class="me-number-input" type="number" min="0.1" step="0.1" value={selectedAnimation?.duration ?? 1} on:input={(e) => onUpdateAnimationProperty('duration', Number(e.currentTarget.value))} />
            <span class="me-input-suffix">s</span>
          </div>
        </div>

        <div class="me-property-group">
          <div class="me-property-label">Animation Delay</div>
          <div class="me-number-input-wrapper">
            <input class="me-number-input" type="number" min="0" step="0.1" value={selectedAnimation?.delay ?? 0} on:input={(e) => onUpdateAnimationProperty('delay', Number(e.currentTarget.value))} />
            <span class="me-input-suffix">s</span>
          </div>
        </div>

        <div class="me-property-group">
          <div class="me-property-label">Easing</div>
          <div class="me-easing-options">
            {#each ['soft', 'power3.out', 'linear', 'ease-out', 'spring', 'smooth'] as easingOption}
              <button 
                type="button" 
                class="me-easing-option" 
                class:me-active={(selectedAnimation?.easing ?? 'soft') === easingOption}
                on:click={() => onUpdateAnimationProperty('easing', easingOption)}
              >
                {easingOption}
              </button>
            {/each}
          </div>
          <input
            class="me-text-input me-easing-input"
            type="text"
            value={String(selectedAnimation?.easing ?? 'soft')}
            placeholder="power3.out or cubic-bezier(...)"
            on:change={(event) => onUpdateAnimationProperty('easing', event.currentTarget.value)}
            aria-label="Custom animation easing"
          />
        </div>
          </div>
        </details>
      {:else if selectedClip}
        <div class="me-selection-summary">
          <span class="me-layer-icon">
            {#if selectedClip.asset?.type === 'video'}<Video size={15} />
            {:else if selectedClip.asset?.path}<img src={assetPreviewSource(assets.get(selectedClip.assetName), selectedClip.asset.path)} alt="" />
            {:else}<FileImage size={15} />{/if}
          </span>
          <span><strong>{selectedClip.assetName}</strong><small>Timeline clip</small></span>
        </div>
        <div class="me-primary-properties" aria-label="Primary properties">
          <div class="me-property-group me-primary-align-group">
            <div class="me-property-label">Align to canvas</div>
            <div class="me-property-align-actions me-flat-align-actions" aria-label="Align selected layer to canvas">
              <button type="button" on:click={() => onAlignSelected('left')} title="Align left" aria-label="Align left" data-tooltip="Align left"><AlignHorizontalJustifyStart size={15} /></button>
              <button type="button" on:click={() => onAlignSelected('center-x')} title="Align horizontal center" aria-label="Align horizontal center" data-tooltip="Center horizontally"><AlignHorizontalJustifyCenter size={15} /></button>
              <button type="button" on:click={() => onAlignSelected('right')} title="Align right" aria-label="Align right" data-tooltip="Align right"><AlignHorizontalJustifyEnd size={15} /></button>
              <button type="button" on:click={() => onAlignSelected('top')} title="Align top" aria-label="Align top" data-tooltip="Align top"><AlignVerticalJustifyStart size={15} /></button>
              <button type="button" on:click={() => onAlignSelected('center-y')} title="Align vertical center" aria-label="Align vertical center" data-tooltip="Center vertically"><AlignVerticalJustifyCenter size={15} /></button>
              <button type="button" on:click={() => onAlignSelected('bottom')} title="Align bottom" aria-label="Align bottom" data-tooltip="Align bottom"><AlignVerticalJustifyEnd size={15} /></button>
            </div>
          </div>
          <div class="me-property-group">
            <div class="me-property-label">Position</div>
            <div class="me-property-row">
              <div class="me-number-input-wrapper">
                <input class="me-number-input" type="number" value={selectedVisualProperty('x', 0)} on:input={(event) => onUpdateElementProperty('x', Number(event.currentTarget.value))} />
                <button type="button" class="me-input-suffix me-scrubbable-suffix" on:pointerdown={(event) => onBeginPropertyScrub(event, 'x', 0)} on:keydown={(event) => onPropertyScrubKey(event, 'x', 0)} aria-label="X position: drag up or down to adjust" title="Drag up or down to adjust X position">x</button>
              </div>
              <div class="me-number-input-wrapper">
                <input class="me-number-input" type="number" value={selectedVisualProperty('y', 0)} on:input={(event) => onUpdateElementProperty('y', Number(event.currentTarget.value))} />
                <button type="button" class="me-input-suffix me-scrubbable-suffix" on:pointerdown={(event) => onBeginPropertyScrub(event, 'y', 0)} on:keydown={(event) => onPropertyScrubKey(event, 'y', 0)} aria-label="Y position: drag up or down to adjust" title="Drag up or down to adjust Y position">y</button>
              </div>
            </div>
          </div>
          <div class="me-property-group me-rotation-property">
            <div class="me-property-label">Rotation</div>
            <RotationDial value={selectedVisualProperty('rotation', 0)} onChange={(angle) => onUpdateElementProperty('rotation', angle)} />
          </div>
          <p class="me-shared-property-note">Visual changes apply to every clip using this source asset.</p>
          <div class="me-property-group">
            <div class="me-property-label">Scale</div>
            <div class="me-slider-control">
              <input class="me-custom-slider" type="range" min="0.05" max="3" step="0.01" value={numericProperty(selectedClipElement, 'scale', 1)} on:input={(event) => onUpdateElementProperty('scale', Number(event.currentTarget.value))} aria-label="Scale" />
              <input class="me-slider-value-input" type="number" min="0.05" step="0.01" value={numericProperty(selectedClipElement, 'scale', 1).toFixed(2)} on:input={(event) => onUpdateElementProperty('scale', Number(event.currentTarget.value))} aria-label="Scale value" />
            </div>
          </div>
          <div class="me-property-group">
            <div class="me-property-label">Opacity</div>
            <div class="me-slider-control">
              <input class="me-custom-slider" type="range" min="0" max="1" step="0.01" value={numericProperty(selectedClipElement, 'opacity', 1)} on:input={(event) => onUpdateElementProperty('opacity', Number(event.currentTarget.value))} aria-label="Opacity" />
              <input class="me-slider-value-input" type="number" min="0" max="100" value={Math.round(numericProperty(selectedClipElement, 'opacity', 1) * 100)} on:input={(event) => onUpdateElementProperty('opacity', Number(event.currentTarget.value) / 100)} aria-label="Opacity percentage" />
            </div>
          </div>
          <div class="me-property-group">
            <div class="me-property-label">Color</div>
            {#if selectedClipElement?.asset?.type === 'svg'}
              <ColorPicker
                value={stringProperty(selectedClipElement, 'fill', '#ffffff')}
                ariaLabel="Clip color"
                onChange={(color) => onUpdateElementProperty('fill', color)}
              />
            {:else}
              <div class="me-property-unavailable">Uses source media colors</div>
            {/if}
          </div>
          <div class="me-property-row me-timing-row">
            <div class="me-property-group">
              <div class="me-property-label">Start Time</div>
              <div class="me-number-input-wrapper">
                <input class="me-number-input" type="number" min="0" max={totalDuration} step="0.01" value={selectedClip.start} on:change={(event) => onMoveSelectedClip(String(selectedClip.track), Number(event.currentTarget.value))} />
                <span class="me-input-suffix">s</span>
              </div>
            </div>
            <div class="me-property-group">
              <div class="me-property-label">Duration</div>
              <div class="me-number-input-wrapper">
                <input class="me-number-input" type="number" min="0.05" max={totalDuration} step="0.05" value={selectedClip.duration} on:change={(event) => onResizeSelectedClip(Number(event.currentTarget.value))} />
                <span class="me-input-suffix">s</span>
              </div>
            </div>
          </div>
        </div>
        <details class="me-more-options" bind:open={moreOptionsOpen}>
          <summary>More Options</summary>
          <div class="me-more-options-content">
        <button type="button" class="me-timeline-command me-clip-original-size" on:click={onResetElementSize}>Original size</button>
        <div class="me-property-group">
          <div class="me-property-label">Width</div>
          <div class="me-number-input-wrapper">
            <input class="me-number-input" type="number" min="1" step="1" value={selectedClipElement ? estimateElementWidth(selectedClipElement) : (assets.get(selectedClip.assetName)?.width ?? 200)} on:input={(event) => onUpdateElementProperty('width', Number(event.currentTarget.value))} />
            <span class="me-input-suffix">px</span>
          </div>
        </div>
        <div class="me-property-group">
          <div class="me-property-label">Track</div>
          <select class="me-text-input" value={String(selectedClip.track)} on:change={(event) => onMoveSelectedClip(event.currentTarget.value, selectedClip.start)}>
            {#each (scene?.tracks ?? []).filter((track) => track.role !== 'audio' && (track.role === 'main' || track.content === (selectedClip.asset?.type === 'video' ? 'video' : 'image') || track.content === 'mixed')) as track}
              <option value={track.id}>{track.label} · {track.role}</option>
            {/each}
          </select>
        </div>
        <div class="me-property-group">
          <div class="me-property-label">Trim In</div>
          <div class="me-number-input-wrapper">
            <input class="me-number-input" type="number" min="0" step="0.01" value={selectedClip.trimIn} on:input={(event) => onUpdateClip(selectedClip.id, { trimIn: `${Math.max(0, Number(event.currentTarget.value))}s` })} />
            <span class="me-input-suffix">s</span>
          </div>
        </div>
        <div class="me-property-group">
          <div class="me-property-label">Trim Out</div>
          <div class="me-number-input-wrapper">
            <input class="me-number-input" type="number" min="0" step="0.01" value={selectedClip.trimOut} on:input={(event) => onUpdateClip(selectedClip.id, { trimOut: `${Math.max(0, Number(event.currentTarget.value))}s` })} />
            <span class="me-input-suffix">s</span>
          </div>
        </div>
        <button
          type="button"
          class="me-timeline-command"
          disabled={currentTime <= selectedClip.start || currentTime >= selectedClip.start + selectedClip.duration}
          on:click={onSplitSelectedClip}
        >Split at playhead</button>
          </div>
        </details>
      {:else}
        <div class="me-properties-empty"><Sparkles size={20} /><strong>Select a layer</strong><span>Choose an object on the canvas or timeline to edit its properties.</span></div>
      {/if}
    </aside>
