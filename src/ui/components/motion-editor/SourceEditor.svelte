<script lang="ts">
  import './source-editor.css';
  import { X } from 'lucide-svelte';

  export let code: string;
  export let open: boolean;
  export let parseError: string | null;
  export let onToggle: () => void;
</script>

<button on:click={onToggle} class="me-source-toggle" title={open ? 'Hide .motion source' : 'Show .motion source'}>
  .motion
</button>

{#if open}
  <div class="me-code-overlay">
    <div class="me-code-panel">
      <div class="me-code-header">
        <h3>.motion source</h3>
        <button on:click={onToggle} class="me-close-btn" aria-label="Close .motion source editor">
          <X size={20} />
        </button>
      </div>

      <textarea
        bind:value={code}
        placeholder=".motion source"
        spellcheck="false"
        class="me-code-textarea"
      ></textarea>

      {#if parseError}
        <div class="me-error-banner">⚠️ {parseError}</div>
      {/if}
    </div>
  </div>
{/if}
