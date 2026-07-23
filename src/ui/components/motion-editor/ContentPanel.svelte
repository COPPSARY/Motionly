<script lang="ts">
  import './content-panel.css';
  import { FileImage, Maximize2, Music2, Plus, Sparkles, Square, Trash2, Type, Upload, Wand2 } from 'lucide-svelte';
  import type { LoadedAsset } from '../../../assets/asset-loader';
  import type { Asset, Element, Scene } from '../../../types/scene';
  import AiConfigPanel from '../AiConfigPanel.svelte';
  import BrandConfigPanel from '../BrandConfigPanel.svelte';
  import { ANIMATION_PRESETS, AVAILABLE_PRESETS } from './constants';
  import { assetPreviewSource, elementDetail } from './helpers';
  import type { AnimationPresetDef, EditorNavTab } from './types';

  export let activeNavTab: EditorNavTab;
  export let mediaSubTab: 'assets' | 'presets';
  export let assetInput: HTMLInputElement;
  export let audioInput: HTMLInputElement;
  export let scene: Scene | null;
  export let assets: Map<string, LoadedAsset>;
  export let assetsReady: boolean;
  export let isDraggingUpload: boolean;
  export let assetError: string;
  export let audioError: string;
  export let audioName: string;
  export let sourceElements: Element[];
  export let selectedElementId: string;
  export let assistantAssets: Asset[];
  export let aiProjectInfo: { width: number; height: number; duration: number; fps: number; elementCount: number };
  export let onAssetUpload: (event: Event) => void | Promise<void>;
  export let onAssetFileDrag: (event: DragEvent) => void;
  export let onAssetFileDragLeave: (event: DragEvent) => void;
  export let onAssetFileDrop: (event: DragEvent) => void | Promise<void>;
  export let onAudioFileDrop: (event: DragEvent) => void | Promise<void>;
  export let onAudioDragStart: (event: DragEvent) => void;
  export let onAudioDragEnd: () => void;
  export let onAssetDragStart: (event: DragEvent, asset: Asset) => void;
  export let onAssetDragEnd: () => void;
  export let onPreviewAsset: (asset: Asset) => void;
  export let onRequestPresetLoad: (path: string) => void;
  export let onRemoveAudio: () => void;
  export let onAddTextElement: () => void;
  export let onSelectElement: (id: string) => void;
  export let canApplyLibraryPreset: (preset: AnimationPresetDef) => boolean;
  export let onApplyLibraryPreset: (preset: AnimationPresetDef) => void;
  export let onTransitionDragStart: (event: DragEvent) => void;
  export let onTransitionDragEnd: () => void;
</script>

<aside class="me-content-panel">
      {#if activeNavTab === 'media'}
        <div class="me-panel-header">
          <div class="me-panel-tabs">
            <button 
              type="button" 
              class="me-panel-tab" 
              class:me-active={mediaSubTab === 'assets'}
              on:click={() => mediaSubTab = 'assets'}
            >
              Assets
            </button>
            <button 
              type="button" 
              class="me-panel-tab" 
              class:me-active={mediaSubTab === 'presets'}
              on:click={() => mediaSubTab = 'presets'}
            >
              Presets
            </button>
          </div>
          {#if mediaSubTab === 'assets'}
            <div class="me-panel-header-actions">
              <input bind:this={assetInput} class="me-file-input" type="file" accept="image/*,video/*,.svg,.gif,.mp4,.webm,.mov,.m4v,.lottie" multiple on:change={onAssetUpload} />
              <button type="button" class="me-header-icon-btn" on:click={() => assetInput.click()} title="Import media" aria-label="Import media">
                <Plus size={15} />
              </button>
            </div>
          {/if}
        </div>
        <div class="me-panel-content">
          {#if mediaSubTab === 'assets'}
            <div
              class="me-media-dropzone"
              class:me-drag-active={isDraggingUpload}
              role="region"
              aria-label="Import media by dropping files"
              on:dragenter={onAssetFileDrag}
              on:dragover|preventDefault={onAssetFileDrag}
              on:dragleave={onAssetFileDragLeave}
              on:drop={onAssetFileDrop}
            >
              {#if assetError}<p class="me-asset-error">{assetError}</p>{/if}
              {#if !assetsReady}<p class="me-status-label" role="status"><span></span> Loading media previews…</p>{/if}
              {#if !scene?.audio && scene?.imports.length === 0}
                <div class="me-library-empty-state">
                  <span class="me-library-empty-icon"><Upload size={18} /></span>
                  <strong>Add your first asset</strong>
                  <span>Drop files here or choose them from your device.</span>
                  <button type="button" class="me-import-media-button" on:click={() => assetInput.click()}>
                    Choose files
                  </button>
                  <small>Images, video, SVG, GIF and Lottie</small>
                </div>
              {/if}
            <!-- Audio Section -->
            {#if scene?.audio}
              <div class="me-asset-folder">
                <div class="me-folder-header">
                  <Music2 size={14} />
                  <span class="me-folder-title">Audio</span>
                </div>
                <div class="me-folder-content">
                  <div
                    class="me-asset-item me-audio-asset"
                    role="button"
                    tabindex="0"
                    draggable="true"
                    aria-label={`Drag ${audioName || 'audio'} to the timeline`}
                    on:dragstart={onAudioDragStart}
                    on:dragend={onAudioDragEnd}
                  >
                    <div class="me-asset-item-icon">
                      <Music2 size={16} />
                    </div>
                    <div class="me-asset-item-info">
                      <div class="me-asset-item-name">{scene.audio.substring(scene.audio.lastIndexOf('/') + 1)}</div>
                      <div class="me-asset-item-path">{scene.audio}</div>
                    </div>
                  </div>
                </div>
              </div>
            {/if}

            <!-- Visual Assets Section -->
            {#if scene && scene.imports.length > 0}
              <div class="me-asset-folder">
                <div class="me-folder-header">
                  <FileImage size={14} />
                  <span class="me-folder-title">Media</span>
                  <span class="me-folder-count">{scene.imports.length}</span>
                </div>
                <div class="me-asset-grid">
                  {#each scene.imports as asset}
                    <button
                      type="button"
                      class="me-asset-card"
                      draggable={assets.has(asset.name)}
                      on:click={() => onPreviewAsset(asset)}
                      on:dragstart={(e) => onAssetDragStart(e, asset)}
                      on:dragend={onAssetDragEnd}
                    >
                      <div class="me-asset-thumbnail">
                        {#if asset.type === 'video'}
                          <video src={assetPreviewSource(assets.get(asset.name), asset.path)} muted playsinline preload="metadata"></video>
                        {:else if asset.path}
                          <img src={assetPreviewSource(assets.get(asset.name), asset.path)} alt={asset.name} />
                        {:else}
                          <FileImage size={24} />
                        {/if}
                      </div>
                      <div class="me-asset-info">
                        <div class="me-asset-name">{asset.name}</div>
                      </div>
                    </button>
                  {/each}
                </div>
              </div>
            {/if}

            </div>
          {:else if mediaSubTab === 'presets'}
            <div class="me-preset-grid">
              {#each AVAILABLE_PRESETS as preset}
                <button
                  type="button"
                  class="me-preset-card"
                  on:click={() => onRequestPresetLoad(preset.path)}
                >
                  <div class="me-preset-thumbnail">
                    <img src={preset.gifPath} alt={preset.name} />
                  </div>
                  <div class="me-preset-info">
                    <div class="me-preset-name">{preset.name}</div>
                  </div>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {:else if activeNavTab === 'audio'}
        <div class="me-panel-header">
          <h3 class="me-panel-heading-title">Audio</h3>
          <div class="me-panel-header-actions">
            <button type="button" class="me-header-icon-btn" on:click={() => audioInput.click()} title="Import audio">
              <Upload size={16} />
            </button>
          </div>
        </div>
        <div class="me-panel-content">
          <div
            class="me-media-dropzone"
            class:me-drag-active={isDraggingUpload}
            role="region"
            aria-label="Import audio by dropping a file"
            on:dragenter={onAssetFileDrag}
            on:dragover|preventDefault={onAssetFileDrag}
            on:dragleave={onAssetFileDragLeave}
            on:drop={onAudioFileDrop}
          >
            {#if audioError}<p class="me-asset-error">{audioError}</p>{/if}
            {#if audioName}
              <div
                class="me-audio-item me-audio-asset"
                role="button"
                tabindex="0"
                draggable="true"
                aria-label={`Drag ${audioName} to the timeline`}
                on:dragstart={onAudioDragStart}
                on:dragend={onAudioDragEnd}
              >
                <Music2 size={18} />
                <span>{audioName}</span>
                <button class="me-icon-btn" on:click={onRemoveAudio} title="Remove audio"><Trash2 size={14} /></button>
              </div>
            {:else}
              <div class="me-library-empty-state">
                <span class="me-library-empty-icon"><Music2 size={18} /></span>
                <strong>Add an audio track</strong>
                <span>Drop audio here or choose a file from your device.</span>
                <button type="button" class="me-import-media-button" on:click={() => audioInput.click()}>
                  Choose audio
                </button>
                <small>MP3, WAV, M4A, AAC, FLAC, OGG and Opus · 50 MB max</small>
              </div>
            {/if}
          </div>
        </div>
      {:else if activeNavTab === 'text'}
        <div class="me-panel-header">
          <h3 class="me-panel-heading-title">Text</h3>
          <div class="me-panel-header-actions">
            <button type="button" class="me-header-icon-btn" on:click={onAddTextElement} title="Add text">
              <Plus size={16} />
            </button>
          </div>
        </div>
        <div class="me-panel-content">
          <div class="me-layer-list">
            {#each sourceElements.filter(el => el.kind === 'text') as element}
              <button
                type="button"
                class="me-layer-row"
                class:me-selected={selectedElementId === element.id}
                on:click={() => onSelectElement(element.id)}
              >
                <span class="me-layer-icon">
                  <Type size={14} />
                </span>
                <span class="me-layer-copy">
                  <strong>{element.id}</strong>
                  <small>{elementDetail(element)}</small>
                </span>
              </button>
            {/each}
          </div>
        </div>
      {:else if activeNavTab === 'effects'}
        <div class="me-panel-header">
          <h3 class="me-panel-heading-title">Effects</h3>
        </div>
        <div class="me-panel-content">
          <div class="me-effects-categories">
            <div class="me-effects-category">
              <div class="me-category-title">Text Effects</div>
              <div class="me-effects-list">
                {#each ANIMATION_PRESETS.filter(p => p.category === 'text') as preset}
                  <button type="button" class="me-effect-item" title={preset.description} disabled={!canApplyLibraryPreset(preset)} on:click={() => onApplyLibraryPreset(preset)}>
                    <Sparkles size={14} />
                    <span>{preset.name}</span>
                  </button>
                {/each}
              </div>
            </div>
            <div class="me-effects-category">
              <div class="me-category-title">Object Effects</div>
              <div class="me-effects-list">
                {#each ANIMATION_PRESETS.filter(p => p.category === 'object') as preset}
                  <button type="button" class="me-effect-item" title={preset.description} disabled={!canApplyLibraryPreset(preset)} on:click={() => onApplyLibraryPreset(preset)}>
                    <Sparkles size={14} />
                    <span>{preset.name}</span>
                  </button>
                {/each}
              </div>
            </div>
            <div class="me-effects-category">
              <div class="me-category-title">Clip Transitions</div>
              <p class="me-category-hint">Drag onto a cut between two touching clips.</p>
              <div class="me-effects-list">
                <button
                  type="button"
                  class="me-effect-item me-transition-effect-item"
                  draggable="true"
                  title="Fade the outgoing clip into the incoming clip"
                  on:dragstart={onTransitionDragStart}
                  on:dragend={onTransitionDragEnd}
                >
                  <Wand2 size={14} />
                  <span><strong>Crossfade</strong><small>Fade both clips</small></span>
                </button>
              </div>
            </div>
            <div class="me-effects-category">
              <div class="me-category-title">Scene Transitions</div>
              <div class="me-effects-list">
                {#each ANIMATION_PRESETS.filter(p => p.category === 'transition') as preset}
                  <button type="button" class="me-effect-item" title={preset.description} disabled={!canApplyLibraryPreset(preset)} on:click={() => onApplyLibraryPreset(preset)}>
                    <Wand2 size={14} />
                    <span>{preset.name}</span>
                  </button>
                {/each}
              </div>
            </div>
            <div class="me-effects-category">
              <div class="me-category-title">Camera</div>
              <div class="me-effects-list">
                {#each ANIMATION_PRESETS.filter(p => p.category === 'camera') as preset}
                  <button type="button" class="me-effect-item" title={preset.description} disabled={!canApplyLibraryPreset(preset)} on:click={() => onApplyLibraryPreset(preset)}>
                    <Maximize2 size={14} />
                    <span>{preset.name}</span>
                  </button>
                {/each}
              </div>
            </div>
          </div>
        </div>
      {:else if activeNavTab === 'scenes'}
        <div class="me-panel-header">
          <h3 class="me-panel-heading-title">Scenes</h3>
        </div>
        <div class="me-panel-content">
          <p class="me-panel-description">
            Backgrounds, overlays, and full-canvas effects that define the visual context of your animation. Use scenes to create atmosphere, transitions, and environmental layers.
          </p>
          <div class="me-layer-list">
            {#each sourceElements.filter(el => el.kind === 'effect' || el.kind === 'overlay') as element}
              <button
                type="button"
                class="me-layer-row"
                class:me-selected={selectedElementId === element.id}
                on:click={() => onSelectElement(element.id)}
              >
                <span class="me-layer-icon">
                  <Square size={14} />
                </span>
                <span class="me-layer-copy">
                  <strong>{element.id}</strong>
                  <small>{elementDetail(element)}</small>
                </span>
              </button>
            {/each}
          </div>
        </div>
      {:else if activeNavTab === 'ai'}
        <div class="me-panel-header">
          <h3 class="me-panel-heading-title">AI Config</h3>
        </div>
        <AiConfigPanel assetList={assistantAssets} projectInfo={aiProjectInfo} />
      {:else if activeNavTab === 'settings'}
        <div class="me-panel-header">
          <h3 class="me-panel-heading-title">Settings</h3>
        </div>
        <BrandConfigPanel assetList={assistantAssets} />
      {/if}
    </aside>

