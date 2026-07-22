<script lang="ts">
  import { Plus, X, FileCode } from 'lucide-svelte';
  import type { Asset } from '../../types/scene';
  import {
    emptyBrandProfile,
    generateBrandMarkdown,
    loadBrand,
    saveBrand,
    type BrandProfile,
  } from '../../ai/config';

  export let assetList: Asset[] = [];

  let brand: BrandProfile = loadBrand() ?? emptyBrandProfile();
  let brandMarkdownMode = false;
  let brandSaved = false;
  let styleDraft = '';
  let motionDraft = '';
  let avoidDraft = '';
  let colorDraft = '#4F8CFF';

  $: brandMarkdown = generateBrandMarkdown(brand);

  function persistBrand() {
    brand = { ...brand };
    saveBrand(brand);
    brandSaved = true;
    setTimeout(() => (brandSaved = false), 1600);
  }

  function addColor() {
    const value = colorDraft.trim();
    if (!value || brand.colors.includes(value)) return;
    brand.colors = [...brand.colors, value];
    persistBrand();
  }

  function removeColor(color: string) {
    brand.colors = brand.colors.filter((item) => item !== color);
    persistBrand();
  }

  function addTag(list: 'visualStyle' | 'motionStyle' | 'avoid', value: string) {
    const tag = value.trim();
    if (!tag || brand[list].includes(tag)) return;
    brand[list] = [...brand[list], tag];
    persistBrand();
  }

  function removeTag(list: 'visualStyle' | 'motionStyle' | 'avoid', tag: string) {
    brand[list] = brand[list].filter((item) => item !== tag);
    persistBrand();
  }

  function handleTagKey(
    event: KeyboardEvent,
    list: 'visualStyle' | 'motionStyle' | 'avoid',
    reset: () => void
  ) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    addTag(list, (event.currentTarget as HTMLInputElement).value);
    reset();
  }

  function toggleMarkdownMode() {
    if (!brandMarkdownMode) {
      brand.markdownOverride = generateBrandMarkdown({ ...brand, markdownOverride: '' });
    }
    brandMarkdownMode = !brandMarkdownMode;
    persistBrand();
  }

  function clearMarkdownOverride() {
    brand.markdownOverride = '';
    brandMarkdownMode = false;
    persistBrand();
  }
</script>

<div class="panel-content">
  <div class="config-section">
    <div class="config-title-row">
      <h4 class="config-title">Brand Profile</h4>
      <button type="button" class="config-link" on:click={toggleMarkdownMode}>
        <FileCode size={13} /> {brandMarkdownMode ? 'Visual editor' : 'Edit Markdown'}
      </button>
    </div>
    <p class="config-desc">Define brand identity for AI-generated animations. Saved as BRAND.md and loaded into the assistant context.</p>

    {#if brandMarkdownMode}
      <textarea class="config-textarea" rows="16" bind:value={brand.markdownOverride} on:input={persistBrand} spellcheck="false"></textarea>
      <button type="button" class="config-link danger" on:click={clearMarkdownOverride}>Discard override & return to visual editor</button>
    {:else}
      <label class="field">
        <span class="field-label">Brand name</span>
        <input class="config-input" type="text" bind:value={brand.name} on:input={persistBrand} placeholder="Motionly" />
      </label>

      <label class="field">
        <span class="field-label">Logo</span>
        <select class="config-input" bind:value={brand.logo} on:change={persistBrand}>
          <option value="">None</option>
          {#each assetList as asset}
            <option value={asset.name}>{asset.name} ({asset.type})</option>
          {/each}
        </select>
      </label>

      <div class="field">
        <span class="field-label">Brand colors</span>
        <div class="chip-row">
          {#each brand.colors as color}
            <span class="chip color-chip">
              <span class="swatch" style={`background:${color}`}></span>{color}
              <button type="button" on:click={() => removeColor(color)} aria-label={`Remove ${color}`}><X size={11} /></button>
            </span>
          {/each}
        </div>
        <div class="inline-add">
          <input class="color-input" type="color" bind:value={colorDraft} aria-label="Pick brand color" />
          <input class="config-input" type="text" bind:value={colorDraft} placeholder="#4F8CFF" />
          <button type="button" class="config-btn" on:click={addColor}><Plus size={13} /></button>
        </div>
      </div>

      <label class="field">
        <span class="field-label">Typography</span>
        <input class="config-input" type="text" bind:value={brand.typography} on:input={persistBrand} placeholder="Inter, Geist, system-ui" />
      </label>

      <div class="field">
        <span class="field-label">Visual style</span>
        <div class="chip-row">
          {#each brand.visualStyle as tag}
            <span class="chip">{tag}<button type="button" on:click={() => removeTag('visualStyle', tag)} aria-label={`Remove ${tag}`}><X size={11} /></button></span>
          {/each}
        </div>
        <input class="config-input" type="text" bind:value={styleDraft} on:keydown={(e) => handleTagKey(e, 'visualStyle', () => (styleDraft = ''))} placeholder="Minimal, Premium, Modern — press Enter" />
      </div>

      <div class="field">
        <span class="field-label">Motion style</span>
        <div class="chip-row">
          {#each brand.motionStyle as tag}
            <span class="chip">{tag}<button type="button" on:click={() => removeTag('motionStyle', tag)} aria-label={`Remove ${tag}`}><X size={11} /></button></span>
          {/each}
        </div>
        <input class="config-input" type="text" bind:value={motionDraft} on:keydown={(e) => handleTagKey(e, 'motionStyle', () => (motionDraft = ''))} placeholder="Smooth, Cinematic — press Enter" />
      </div>

      <div class="field">
        <span class="field-label">Things to avoid</span>
        <div class="chip-row">
          {#each brand.avoid as tag}
            <span class="chip avoid-chip">{tag}<button type="button" on:click={() => removeTag('avoid', tag)} aria-label={`Remove ${tag}`}><X size={11} /></button></span>
          {/each}
        </div>
        <input class="config-input" type="text" bind:value={avoidDraft} on:keydown={(e) => handleTagKey(e, 'avoid', () => (avoidDraft = ''))} placeholder="Overly flashy effects — press Enter" />
      </div>

      <div class="brand-preview">
        <span class="field-label">BRAND.md preview {brandSaved ? '· saved' : ''}</span>
        <pre>{brandMarkdown}</pre>
      </div>
    {/if}
  </div>
</div>

<style>
  .panel-content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 14px;
    scrollbar-width: thin;
    scrollbar-color: #34373d #111214;
  }
  .config-section { display: flex; flex-direction: column; gap: 12px; }
  .config-title { margin: 0; font-size: 13px; font-weight: 700; color: #f1f2f4; }
  .config-title-row { display: flex; align-items: center; justify-content: space-between; }
  .config-desc { margin: 0; font-size: 11px; line-height: 1.5; color: #8e939b; }

  .config-textarea {
    width: 100%;
    box-sizing: border-box;
    resize: vertical;
    padding: 10px;
    border: 1px solid #2c3138;
    border-radius: 6px;
    background: #0d0e10;
    color: #e7eaee;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    line-height: 1.5;
  }

  .field { display: flex; flex-direction: column; gap: 6px; }
  .field-label {
    color: #8e939b;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .config-input {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 10px;
    border: 1px solid #2c3138;
    border-radius: 6px;
    background: #0d0e10;
    color: #e7eaee;
    font-size: 12px;
  }
  .config-input:focus { outline: none; border-color: #4a5563; }

  .inline-add { display: flex; gap: 6px; align-items: center; }
  .inline-add .config-input { flex: 1; }
  .color-input { width: 34px; height: 34px; padding: 0; border: 1px solid #2c3138; border-radius: 6px; background: #0d0e10; cursor: pointer; }

  .chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 6px 4px 9px;
    border: 1px solid #2c3138;
    border-radius: 20px;
    background: #16181c;
    color: #dce1e6;
    font-size: 11px;
  }
  .chip button { display: inline-flex; padding: 0; border: 0; background: transparent; color: #8e939b; cursor: pointer; }
  .chip button:hover { color: #ff9da5; }
  .color-chip .swatch { width: 12px; height: 12px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.15); }
  .avoid-chip { border-color: #5a3a3d; background: #241a1b; }

  .config-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 12px;
    border: 1px solid #2c3138;
    border-radius: 6px;
    background: #16181c;
    color: #dce1e6;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .config-btn:hover { background: #202329; }

  .config-link {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    align-self: flex-start;
    padding: 0;
    border: 0;
    background: transparent;
    color: #0a84ff;
    font-size: 11px;
    cursor: pointer;
  }
  .config-link:hover { text-decoration: underline; }
  .config-link.danger { color: #ff9da5; }

  .brand-preview { display: flex; flex-direction: column; gap: 6px; }
  .brand-preview pre {
    margin: 0;
    padding: 10px;
    border: 1px solid #2c3138;
    border-radius: 6px;
    background: #0d0e10;
    color: #b8bec6;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 10.5px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }
</style>
