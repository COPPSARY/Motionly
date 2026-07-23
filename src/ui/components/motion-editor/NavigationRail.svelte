<script lang="ts">
  import './navigation-rail.css';
  import { Bot, FolderOpen, Headphones, Layers3, Settings, Type, Wand2 } from 'lucide-svelte';
  import type { EditorNavTab } from './types';

  export let activeTab: EditorNavTab;
  export let onSelect: (tab: EditorNavTab) => void;

  const items = [
    { tab: 'media', label: 'Media / Assets', tooltip: 'Media', icon: FolderOpen },
    { tab: 'audio', label: 'Audio', tooltip: 'Audio', icon: Headphones },
    { tab: 'text', label: 'Text', tooltip: 'Text', icon: Type },
    { tab: 'effects', label: 'Effects', tooltip: 'Effects', icon: Wand2 },
    { tab: 'scenes', label: 'Scenes', tooltip: 'Scenes', icon: Layers3 },
    { tab: 'ai', label: 'AI Config', tooltip: 'AI Config', icon: Bot },
  ] satisfies Array<{
    tab: EditorNavTab;
    label: string;
    tooltip: string;
    icon: typeof FolderOpen;
  }>;
</script>

<nav class="me-nav-rail">
  {#each items as item}
    <button
      type="button"
      class="me-nav-item"
      class:me-active={activeTab === item.tab}
      on:click={() => onSelect(item.tab)}
      title={item.label}
      aria-label={item.label}
      data-tooltip={item.tooltip}
    >
      <svelte:component this={item.icon} size={20} />
    </button>
  {/each}
  <button
    type="button"
    class="me-nav-item me-nav-settings"
    class:me-active={activeTab === 'settings'}
    on:click={() => onSelect('settings')}
    title="Settings"
    aria-label="Settings"
    data-tooltip="Settings"
  >
    <Settings size={20} />
  </button>
</nav>
