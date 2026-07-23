<script lang="ts">
  import './editor-feedback.css';
  import { X } from 'lucide-svelte';

  export let deleteToast: string;
  export let showConfirmDialog: boolean;
  export let onUndoDelete: () => void;
  export let onCancelPreset: () => void;
  export let onConfirmPreset: () => void | Promise<void>;
</script>

{#if deleteToast}
  <div class="me-delete-toast" role="status" aria-live="polite">
    <span>{deleteToast}</span>
    <span class="me-toast-separator" aria-hidden="true">·</span>
    <button type="button" on:click={onUndoDelete}>Undo</button>
  </div>
{/if}

{#if showConfirmDialog}
  <div class="me-dialog-overlay" on:click={onCancelPreset} on:keydown={(event) => event.key === 'Escape' && onCancelPreset()} role="button" tabindex="-1">
    <div class="me-dialog" on:click|stopPropagation on:keydown={(event) => event.key === 'Enter' && onConfirmPreset()} role="dialog" aria-labelledby="dialog-title" aria-modal="true" tabindex="0">
      <div class="me-dialog-header">
        <h3 id="dialog-title">Load Preset</h3>
        <button type="button" class="me-dialog-close" on:click={onCancelPreset} aria-label="Cancel loading preset">
          <X size={18} />
        </button>
      </div>
      <div class="me-dialog-body">
        <p>Loading this preset will replace your current project and assets. Continue?</p>
      </div>
      <div class="me-dialog-footer">
        <button type="button" class="me-dialog-btn me-secondary" on:click={onCancelPreset}>Cancel</button>
        <button type="button" class="me-dialog-btn me-danger" on:click={onConfirmPreset}>Load Preset</button>
      </div>
    </div>
  </div>
{/if}
