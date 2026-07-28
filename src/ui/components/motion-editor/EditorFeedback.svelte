<script lang="ts">
  import './editor-feedback.css';
  import { LoaderCircle, X } from 'lucide-svelte';

  export let deleteToast: string;
  export let keyframeNotice: string;
  export let showConfirmDialog: boolean;
  export let dialogTitle: string;
  export let dialogMessage: string;
  export let dialogConfirmLabel: string;
  export let dialogBusy = false;
  export let onUndoDelete: () => void;
  export let onCancelDialog: () => void;
  export let onConfirmDialog: () => void | Promise<void>;

  function handleWindowKeydown(event: KeyboardEvent) {
    if (showConfirmDialog && !dialogBusy && event.key === 'Escape') {
      event.preventDefault();
      onCancelDialog();
    }
  }
</script>

<svelte:window on:keydown={handleWindowKeydown} />

{#if deleteToast}
  <div class="me-delete-toast" role="status" aria-live="polite">
    <span>{deleteToast}</span>
    <span class="me-toast-separator" aria-hidden="true">·</span>
    <button type="button" on:click={onUndoDelete}>Undo</button>
  </div>
{/if}

{#if keyframeNotice}
  <div class="me-keyframe-toast" role="status" aria-live="polite">{keyframeNotice}</div>
{/if}

{#if showConfirmDialog}
  <div class="me-dialog-overlay" on:click={() => !dialogBusy && onCancelDialog()} on:keydown={() => undefined} role="button" tabindex="-1">
    <div class="me-dialog" on:click|stopPropagation on:keydown={(event) => event.key === 'Enter' && !dialogBusy && onConfirmDialog()} role="dialog" aria-labelledby="dialog-title" aria-modal="true" aria-busy={dialogBusy} tabindex="0">
      <div class="me-dialog-header">
        <h3 id="dialog-title">{dialogTitle}</h3>
        <button type="button" class="me-dialog-close" on:click={onCancelDialog} aria-label="Cancel" disabled={dialogBusy}>
          <X size={18} />
        </button>
      </div>
      <div class="me-dialog-body">
        <p>{dialogMessage}</p>
      </div>
      <div class="me-dialog-footer">
        <button type="button" class="me-dialog-btn me-secondary" on:click={onCancelDialog} disabled={dialogBusy}>Cancel</button>
        <button type="button" class="me-dialog-btn me-danger" on:click={onConfirmDialog} disabled={dialogBusy}>
          {#if dialogBusy}
            <LoaderCircle class="me-dialog-spinner" size={15} aria-hidden="true" />
            Installing…
          {:else}
            {dialogConfirmLabel}
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}
