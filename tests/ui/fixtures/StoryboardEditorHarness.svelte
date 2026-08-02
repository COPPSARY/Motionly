<script lang="ts">
  /**
   * Harness that binds MotionEditor's `code`, so a test can assert on the source
   * the editor produced rather than on when it chose to save.
   */
  import MotionEditor from '../../../src/ui/components/MotionEditor.svelte';

  export let initial: string;

  let source = initial;

  export function getSource() {
    return source;
  }
</script>

<MotionEditor bind:code={source} onSave={() => undefined} />
