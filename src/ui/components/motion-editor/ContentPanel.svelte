<script lang="ts">
  import './content-panel.css';
  import { CloudUpload, FileImage, LayoutGrid, List, Maximize2, Music2, Plus, Sparkles, Square, Trash2, Type, Upload, Wand2 } from 'lucide-svelte';
  import type { LoadedAsset } from '../../../assets/asset-loader';
  import type { Asset, Element, Scene } from '../../../types/scene';
  import AiConfigPanel from '../AiConfigPanel.svelte';
  import BrandConfigPanel from '../BrandConfigPanel.svelte';
  import { ANIMATION_PRESETS, AVAILABLE_PRESETS, EFFECT_PRESETS } from './constants';
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
  export let sourceElements: Element[];
  export let selectedElementId: string;
  export let assistantAssets: Asset[];
  export let aiProjectInfo: { width: number; height: number; duration: number; fps: number; elementCount: number };
  export let onAssetUpload: (event: Event) => void | Promise<void>;
  export let onAssetFileDrag: (event: DragEvent) => void;
  export let onAssetFileDragLeave: (event: DragEvent) => void;
  export let onAssetFileDrop: (event: DragEvent) => void | Promise<void>;
  export let onAudioFileDrop: (event: DragEvent) => void | Promise<void>;
  export let onAssetDragStart: (event: DragEvent, asset: Asset) => void;
  export let onAssetDragEnd: () => void;
  export let onPreviewAsset: (asset: Asset) => void;
  export let onRemoveAssets: (assets: Asset[]) => void;
  export let onRequestPresetLoad: (path: string) => void;
  export let onAddTextElement: () => void;
  export let onSelectElement: (id: string) => void;
  export let onRemoveElements: (ids: string[]) => void;
  export let canApplyLibraryPreset: (preset: AnimationPresetDef) => boolean;
  export let onApplyLibraryPreset: (preset: AnimationPresetDef) => void;
  export let onTransitionDragStart: (event: DragEvent) => void;
  export let onTransitionDragEnd: () => void;
  export let onResizeStart: (event: PointerEvent) => void;

  let selectedAssetNames = new Set<string>();
  let assetView: 'grid' | 'list' = 'grid';
  let selectedTextIds = new Set<string>();
  let assetSelectionAnchor = '';
  let textSelectionAnchor = '';
  let selectionContext = '';
  $: selectedAssets = scene?.imports.filter((asset) => selectedAssetNames.has(asset.name)) ?? [];
  $: audioAssets = scene?.imports.filter((asset) => asset.type === 'audio') ?? [];
  $: selectedAudioAssets = audioAssets.filter((asset) => selectedAssetNames.has(asset.name));
  $: textElements = sourceElements.filter((element) => element.kind === 'text');
  $: selectedTextElements = textElements.filter((element) => selectedTextIds.has(element.id));
  $: {
    const nextContext = `${activeNavTab}:${mediaSubTab}`;
    if (selectionContext && selectionContext !== nextContext) clearSelections();
    selectionContext = nextContext;
  }

  function clearSelections() {
    selectedAssetNames = new Set();
    assetSelectionAnchor = '';
    selectedTextIds = new Set();
    textSelectionAnchor = '';
  }

  function handleSelectionKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') clearSelections();
  }

  function selectAsset(asset: Asset, event: MouseEvent | KeyboardEvent) {
    if (event.shiftKey) {
      selectAssetRange(asset, event);
      return;
    }
    if (event.ctrlKey || event.metaKey) {
      selectedAssetNames = new Set(selectedAssetNames);
      if (selectedAssetNames.has(asset.name)) selectedAssetNames.delete(asset.name);
      else selectedAssetNames.add(asset.name);
    } else {
      selectedAssetNames = new Set([asset.name]);
    }
    assetSelectionAnchor = asset.name;
    onPreviewAsset(asset);
  }

  function selectAssetRange(asset: Asset, event: MouseEvent | KeyboardEvent) {
    if (!event.shiftKey) return;
    event.preventDefault();
    const imports = scene?.imports ?? [];
    const anchorIndex = imports.findIndex((item) => item.name === assetSelectionAnchor);
    const targetIndex = imports.findIndex((item) => item.name === asset.name);
    if (anchorIndex < 0 || targetIndex < 0) {
      selectedAssetNames = new Set([asset.name]);
      assetSelectionAnchor = asset.name;
    } else {
      const start = Math.min(anchorIndex, targetIndex);
      const end = Math.max(anchorIndex, targetIndex);
      selectedAssetNames = new Set(imports.slice(start, end + 1).map((item) => item.name));
    }
    onPreviewAsset(asset);
  }

  function removeSelectedText() {
    onRemoveElements(selectedTextElements.map((element) => element.id));
    selectedTextIds = new Set();
  }

  function selectText(element: Element, event: MouseEvent) {
    if (event.shiftKey) {
      selectTextRange(element, event);
      return;
    }
    if (event.ctrlKey || event.metaKey) {
      selectedTextIds = new Set(selectedTextIds);
      if (selectedTextIds.has(element.id)) selectedTextIds.delete(element.id);
      else selectedTextIds.add(element.id);
    } else {
      selectedTextIds = new Set([element.id]);
    }
    textSelectionAnchor = element.id;
    onSelectElement(element.id);
  }

  function selectTextRange(element: Element, event: MouseEvent) {
    if (!event.shiftKey) return;
    event.preventDefault();
    const anchorIndex = textElements.findIndex((item) => item.id === textSelectionAnchor);
    const targetIndex = textElements.findIndex((item) => item.id === element.id);
    if (anchorIndex < 0 || targetIndex < 0) {
      selectedTextIds = new Set([element.id]);
      textSelectionAnchor = element.id;
    } else {
      const start = Math.min(anchorIndex, targetIndex);
      const end = Math.max(anchorIndex, targetIndex);
      selectedTextIds = new Set(textElements.slice(start, end + 1).map((item) => item.id));
    }
    onSelectElement(element.id);
  }

  function hierarchyDepth(element: Element): number {
    const byId = new Map(sourceElements.map((item) => [item.id, item]));
    let depth = 0;
    let parent = String(propertiesOfElement(element)['parent'] ?? '');
    const seen = new Set<string>();
    while (parent && !seen.has(parent) && depth < 12) {
      seen.add(parent);
      depth += 1;
      parent = String(propertiesOfElement(byId.get(parent))['parent'] ?? '');
    }
    return depth;
  }

  function propertiesOfElement(element: Element | undefined): Record<string, unknown> {
    return (element?.properties ?? {}) as unknown as Record<string, unknown>;
  }
</script>

<svelte:window on:keydown={handleSelectionKeydown} />

<aside class="me-content-panel">
      <button
        type="button"
        class="me-panel-resize-handle"
        aria-label="Resize asset panel"
        title="Drag to resize panel"
        on:pointerdown={onResizeStart}
      ></button>
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
              <input bind:this={assetInput} class="me-file-input" type="file" accept="image/*,video/*,audio/*,.svg,.gif,.mp4,.webm,.mov,.m4v,.lottie,.mp3,.wav,.m4a,.aac,.flac,.ogg,.opus" multiple on:change={onAssetUpload} />
              <button
                type="button"
                class="me-header-icon-btn"
                title={`Show ${assetView === 'grid' ? 'list' : 'grid'} view`}
                aria-label={`Show ${assetView === 'grid' ? 'list' : 'grid'} view`}
                on:click={() => (assetView = assetView === 'grid' ? 'list' : 'grid')}
              >
                {#if assetView === 'grid'}<List size={15} />{:else}<LayoutGrid size={15} />{/if}
              </button>
              <button type="button" class="me-import-header-btn" on:click={() => assetInput.click()} title="Import media" aria-label="Import media">
                <CloudUpload size={14} />
                <span>Import</span>
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
              {#if scene?.imports.length === 0}
                <div class="me-library-empty-state">
                  <span class="me-library-empty-icon"><Upload size={18} /></span>
                  <strong>Add your first asset</strong>
                  <span>Drop files here or choose them from your device.</span>
                  <button type="button" class="me-import-media-button" on:click={() => assetInput.click()}>
                    Choose files
                  </button>
                  <small>Images, video, audio, SVG, GIF and Lottie</small>
                </div>
              {/if}
            <!-- Visual Assets Section -->
            {#if scene && scene.imports.length > 0}
              <div class="me-asset-folder">
                <div class="me-folder-header">
                  <FileImage size={14} />
                  <span class="me-folder-title">Media</span>
                  <span class="me-folder-count">{scene.imports.length}</span>
                  {#if selectedAssets.length}
                    <button
                      type="button"
                      class="me-folder-delete"
                      title={`Delete selected asset${selectedAssets.length === 1 ? '' : 's'}`}
                      aria-label={`Delete selected asset${selectedAssets.length === 1 ? '' : 's'}`}
                      on:click={() => {
                        onRemoveAssets(selectedAssets);
                        selectedAssetNames = new Set();
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  {/if}
                </div>
                <div class="me-asset-grid" class:me-list-view={assetView === 'list'}>
                  {#each scene.imports as asset}
                    <div
                      class="me-asset-card-wrap"
                      class:me-selected={selectedAssetNames.has(asset.name)}
                    >
                      <button
                        type="button"
                        class="me-asset-card"
                        draggable={assets.has(asset.name)}
                        aria-label={`Select and preview ${asset.name}`}
                        on:click={(event) => selectAsset(asset, event)}
                        on:contextmenu={(event) => selectAssetRange(asset, event)}
                        on:dragstart={(e) => onAssetDragStart(e, asset)}
                        on:dragend={onAssetDragEnd}
                      >
                        <div class="me-asset-thumbnail">
                          {#if asset.type === 'audio'}
                            <Music2 size={24} />
                          {:else if asset.type === 'video'}
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
                    </div>
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
            {#if selectedAudioAssets.length}
              <button
                type="button"
                class="me-folder-delete"
                title={`Delete selected audio${selectedAudioAssets.length === 1 ? '' : ' files'}`}
                aria-label={`Delete selected audio${selectedAudioAssets.length === 1 ? '' : ' files'}`}
                on:click={() => {
                  onRemoveAssets(selectedAudioAssets);
                  selectedAssetNames = new Set();
                }}
              >
                <Trash2 size={14} />
              </button>
            {/if}
            <button type="button" class="me-header-icon-btn" on:click={() => audioInput.click()} title="Import audio" aria-label="Import audio">
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
            {#if assetError}<p class="me-asset-error">{assetError}</p>{/if}
            {#if audioAssets.length}
              <!-- Audio behaves like any other asset: it lives in the library
                   and is only on the timeline once you drag it there. -->
              {#each audioAssets as asset}
                <div
                  class="me-audio-item me-audio-asset"
                  class:me-selected={selectedAssetNames.has(asset.name)}
                  role="button"
                  tabindex="0"
                  draggable={assets.has(asset.name)}
                  aria-label={`Select or drag ${asset.name}`}
                  on:click={(event) => selectAsset(asset, event)}
                  on:contextmenu={(event) => selectAssetRange(asset, event)}
                  on:keydown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') selectAsset(asset, event);
                  }}
                  on:dragstart={(event) => onAssetDragStart(event, asset)}
                  on:dragend={onAssetDragEnd}
                >
                  <Music2 size={18} />
                  <span>{asset.name}</span>
                </div>
              {/each}
            {:else}
              <div class="me-library-empty-state">
                <span class="me-library-empty-icon"><Music2 size={18} /></span>
                <strong>Add audio</strong>
                <span>Drop audio here or choose files from your device.</span>
                <button type="button" class="me-import-media-button" on:click={() => audioInput.click()}>
                  Choose audio
                </button>
                <small>MP3, WAV, M4A, AAC, FLAC, OGG and Opus · 50 MB max · drag onto the timeline to use</small>
              </div>
            {/if}
          </div>
        </div>
      {:else if activeNavTab === 'text'}
        <div class="me-panel-header">
          <h3 class="me-panel-heading-title">Text</h3>
          <div class="me-panel-header-actions">
            {#if selectedTextElements.length}
              <button
                type="button"
                class="me-folder-delete"
                title={`Delete selected text${selectedTextElements.length === 1 ? '' : ' layers'}`}
                aria-label={`Delete selected text${selectedTextElements.length === 1 ? '' : ' layers'}`}
                on:click={removeSelectedText}
              >
                <Trash2 size={14} />
              </button>
            {/if}
            <button type="button" class="me-header-icon-btn" on:click={onAddTextElement} title="Add text">
              <Plus size={16} />
            </button>
          </div>
        </div>
        <div class="me-panel-content">
          <div class="me-layer-list">
            {#each textElements as element}
              <div
                class="me-layer-row-wrap"
                class:me-checked={selectedTextIds.has(element.id)}
              >
                <button
                  type="button"
                  class="me-layer-row"
                  class:me-selected={selectedElementId === element.id}
                  aria-label={`Select ${element.id}`}
                  on:click={(event) => selectText(element, event)}
                  on:contextmenu={(event) => selectTextRange(element, event)}
                >
                  <span class="me-layer-icon">
                    <Type size={14} />
                  </span>
                  <span class="me-layer-copy">
                    <strong>{element.id}</strong>
                    <small>{elementDetail(element)}</small>
                  </span>
                </button>
              </div>
            {/each}
          </div>
        </div>
      {:else if activeNavTab === 'effects'}
        <div class="me-panel-header">
          <h3 class="me-panel-heading-title">Effects</h3>
        </div>
        <div class="me-panel-content">
          <div class="me-effects-categories">
            {#each ['background', 'atmosphere', 'surface'] as category}
              <div class="me-effects-category">
                <div class="me-category-title">{category[0]?.toUpperCase()}{category.slice(1)} Effects</div>
                <div class="me-effects-list">
                  {#each EFFECT_PRESETS.filter(p => p.category === category) as preset}
                    <button type="button" class="me-effect-item" title={preset.description} disabled={!canApplyLibraryPreset(preset)} on:click={() => onApplyLibraryPreset(preset)}>
                      <Sparkles size={14} />
                      <span>{preset.name}</span>
                    </button>
                  {/each}
                </div>
              </div>
            {/each}
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
          <p class="me-panel-description">Select scenes, groups, SVG paths, and ordinary layers. Child transforms stay local to their parent.</p>
          <div class="me-layer-list">
            {#each sourceElements as element}
              <button
                type="button"
                class="me-layer-row"
                class:me-selected={selectedElementId === element.id}
                style={`padding-left: ${12 + hierarchyDepth(element) * 14}px`}
                on:click={() => onSelectElement(element.id)}
              >
                <span class="me-layer-icon">
                  {#if element.kind === 'scene' || element.kind === 'group'}<LayoutGrid size={14} />{:else}<Square size={14} />{/if}
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
