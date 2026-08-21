<script lang="ts">
  /**
   * The storyboard strip: the editor's top-level timeline.
   *
   * It lists scenes, never objects, so its size is a function of the story rather
   * than of the project. Selecting a scene is what opens that scene's timeline
   * below; everything here is structure.
   *
   * The strip is a view over the parsed program. Every action calls a pure
   * operation from `src/ui/storyboard.ts` and hands the new program back to the
   * editor, which serializes it — so each edit is one readable `.motion` diff and
   * one undo step.
   */
  import './storyboard-strip.css';
  import {
    ArrowLeft,
    ArrowLeftRight,
    ArrowRight,
    Copy,
    Layers,
    Plus,
    Scissors,
    Trash2,
    Wand2,
    ZoomIn,
  } from 'lucide-svelte';
  import type { ScenePlan } from '../../../motion-system/scenes';
  import type { SceneTransitionKind } from '../../../motion-system/scenes';
  import type { StoryboardEntry } from '../../storyboard';

  export let storyboard: readonly ScenePlan[] = [];
  export let entries: readonly StoryboardEntry[] = [];
  /** Name of the scene whose timeline is open, or '' for the whole storyboard. */
  export let activeScene = '';
  export let onSelectScene: (name: string) => void;
  export let onCreateScene: (after: string) => void;
  export let onDuplicateScene: (name: string) => void;
  export let onDeleteScene: (name: string) => void;
  export let onReorderScene: (name: string, toIndex: number) => void;
  export let onRenameScene: (name: string, label: string) => void;
  export let onCycleTransition: (name: string) => void;
  /** Present only while the project has no storyboard yet. */
  export let onOrganizeIntoScenes: (() => void) | null = null;

  let renaming = '';
  let draft = '';

  /**
   * Boundary summary. The participation counts are the whole point of the badge:
   * a boundary that carries nothing is a jump cut, and the strip should say so
   * before the user has to watch for it.
   */
  interface Boundary {
    scene: string;
    kind: SceneTransitionKind;
    shared: number;
    exit: number;
    enter: number;
  }

  const KIND_LABEL: Record<SceneTransitionKind, string> = {
    sharedElement: 'Shared',
    cameraMove: 'Camera',
    continuous: 'Continuous',
    cut: 'Cut',
  };

  $: planByName = new Map(storyboard.map((plan) => [plan.name, plan]));
  $: activeEntry = entries.find((entry) => entry.name === activeScene);
  $: total = storyboard.reduce((longest, plan) => Math.max(longest, plan.end), 0);

  function boundaryBefore(name: string): Boundary | null {
    const plan = planByName.get(name);
    if (!plan?.transition) return null;
    const { participation, kind } = plan.transition;
    return {
      scene: name,
      kind,
      shared: participation.shared.length,
      exit: participation.exit.length,
      enter: participation.enter.length,
    };
  }

  function boundaryTitle(boundary: Boundary): string {
    const parts = [`${KIND_LABEL[boundary.kind]} boundary`];
    parts.push(
      boundary.shared
        ? `${boundary.shared} shared`
        : 'nothing shared — give a recurring component the same identity'
    );
    if (boundary.exit) parts.push(`${boundary.exit} exit`);
    if (boundary.enter) parts.push(`${boundary.enter} enter`);
    return `${parts.join(', ')}. Click to change.`;
  }

  function startRename(entry: StoryboardEntry) {
    renaming = entry.name;
    draft = entry.label;
  }

  function commitRename() {
    if (!renaming) return;
    const name = renaming;
    const label = draft;
    renaming = '';
    draft = '';
    if (label.trim()) onRenameScene(name, label);
  }

  function onRenameKey(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitRename();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      renaming = '';
      draft = '';
    }
  }

  /** Arrow keys move a scene, matching the drag the strip also supports. */
  function onSceneKey(event: KeyboardEvent, entry: StoryboardEntry) {
    if (!event.altKey) return;
    if (event.key === 'ArrowLeft' && entry.index > 0) {
      event.preventDefault();
      onReorderScene(entry.name, entry.index - 1);
    }
    if (event.key === 'ArrowRight' && entry.index < entries.length - 1) {
      event.preventDefault();
      onReorderScene(entry.name, entry.index + 1);
    }
  }

  function seconds(value: number): string {
    return `${Number(value.toFixed(2))}s`;
  }
</script>

{#if !entries.length}
  <div class="storyboard-strip storyboard-strip--empty">
    <div class="storyboard-strip__head">
      <span class="storyboard-strip__title">Storyboard</span>
      <span class="storyboard-strip__meta">No scenes</span>
    </div>
    <p class="storyboard-strip__hint">
      This project is one long composition. Organizing it into scenes keeps the top timeline
      readable and lets recurring components carry across boundaries.
    </p>
    {#if onOrganizeIntoScenes}
      <button
        class="storyboard-strip__cta"
        type="button"
        on:click={onOrganizeIntoScenes}
        title="Split this project into scenes, keeping every animation"
      >
        <Wand2 size={14} aria-hidden="true" />
        Organize into scenes
      </button>
    {/if}
  </div>
{:else}
  <div class="storyboard-strip" role="group" aria-label="Storyboard">
    <div class="storyboard-strip__head">
      {#if activeEntry}
        <button
          class="storyboard-strip__back"
          type="button"
          aria-label="Back to all scenes"
          title="Back to the whole storyboard"
          on:click={() => onSelectScene('')}
        >
          <ArrowLeft size={14} aria-hidden="true" />
          All scenes
        </button>
        <span class="storyboard-strip__meta">{activeEntry.label} timeline</span>
      {:else}
        <span class="storyboard-strip__title">Storyboard</span>
        <span class="storyboard-strip__meta">
          {entries.length} scene{entries.length === 1 ? '' : 's'} · {seconds(total)}
        </span>
      {/if}
    </div>

    <ol class="storyboard-strip__scenes">
      {#each entries as entry (entry.name)}
        {@const boundary = boundaryBefore(entry.name)}
        {#if boundary}
          <li class="storyboard-boundary">
            <button
              class="storyboard-boundary__button"
              type="button"
              data-kind={boundary.kind}
              title={boundaryTitle(boundary)}
              aria-label={`Boundary into ${entry.label}: ${KIND_LABEL[boundary.kind]}. ${boundary.shared} shared, ${boundary.exit} exiting, ${boundary.enter} entering. Change transition.`}
              on:click={() => onCycleTransition(entry.name)}
            >
              {#if boundary.kind === 'sharedElement'}
                <ArrowLeftRight size={16} aria-hidden="true" />
              {:else if boundary.kind === 'cameraMove'}
                <ZoomIn size={16} aria-hidden="true" />
              {:else if boundary.kind === 'cut'}
                <Scissors size={16} aria-hidden="true" />
              {:else}
                <ArrowRight size={16} aria-hidden="true" />
              {/if}
            </button>
            <span class="storyboard-boundary__label">{KIND_LABEL[boundary.kind]}</span>
          </li>
        {/if}

        <li>
          <button
            class="storyboard-scene"
            type="button"
            aria-current={activeScene === entry.name}
            style={entry.background ? `--storyboard-scene-color: ${entry.background}` : ''}
            title={`${entry.label} — ${seconds(entry.duration)}, ${entry.members.length} object${entry.members.length === 1 ? '' : 's'}. Double-click to rename, Alt+Arrow to reorder.`}
            on:click={() => onSelectScene(entry.name)}
            on:dblclick={() => startRename(entry)}
            on:keydown={(event) => onSceneKey(event, entry)}
          >
            {#if entry.background}
              <span class="storyboard-scene__swatch" aria-hidden="true"></span>
            {/if}
            {#if renaming === entry.name}
              <!-- svelte-ignore a11y-autofocus -->
              <input
                class="storyboard-scene__rename"
                type="text"
                autofocus
                aria-label={`Rename ${entry.label}`}
                bind:value={draft}
                on:blur={commitRename}
                on:keydown={onRenameKey}
                on:click|stopPropagation
              />
            {:else}
              <span class="storyboard-scene__label">{entry.label}</span>
            {/if}
            <span class="storyboard-scene__facts">
              <span>{seconds(entry.duration)}</span>
              <span class="storyboard-scene__members">
                <Layers size={11} aria-hidden="true" />
                {entry.members.length}
              </span>
            </span>
          </button>
        </li>
      {/each}
    </ol>

    <div class="storyboard-strip__tools">
      <button
        class="storyboard-icon-button"
        type="button"
        aria-label="Add a scene after the selected one"
        title="Add a scene"
        on:click={() => onCreateScene(activeScene)}
      >
        <Plus size={16} aria-hidden="true" />
      </button>
      <button
        class="storyboard-icon-button"
        type="button"
        disabled={!activeScene}
        aria-label="Duplicate the selected scene"
        title="Duplicate scene"
        on:click={() => activeScene && onDuplicateScene(activeScene)}
      >
        <Copy size={16} aria-hidden="true" />
      </button>
      <button
        class="storyboard-icon-button"
        type="button"
        disabled={!activeScene || entries.length < 2}
        aria-label="Delete the selected scene and its contents"
        title="Delete scene"
        on:click={() => activeScene && onDeleteScene(activeScene)}
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </div>
  </div>
{/if}
