<script lang="ts">
  import { Sparkles, Eye, BookOpen } from 'lucide-svelte';
  import type { Asset } from '../../types/scene';
  import {
    AVAILABLE_SKILLS,
    describeAiContext,
    loadBrand,
    loadSkillState,
    saveSkillState,
    type SkillState,
  } from '../../ai/config';

  export let assetList: Asset[] = [];
  export let projectInfo: {
    width: number;
    height: number;
    fps: number;
    duration: number;
    elementCount: number;
  } | null = null;

  type ConfigView = 'skills' | 'context';
  let view: ConfigView = 'skills';

  let skillState: SkillState = loadSkillState();
  let openSkillId = '';

  // Brand lives under Settings; the AI context preview still reflects it.
  $: contextSummary = describeAiContext({
    brand: loadBrand(),
    skillState,
    assets: assetList,
    project: projectInfo,
  });

  function toggleSkill(id: string) {
    skillState = { ...skillState, [id]: !skillState[id] };
    saveSkillState(skillState);
  }
</script>

<div class="ai-config">
  <nav class="config-nav" aria-label="AI configuration sections">
    <button type="button" class:active={view === 'skills'} on:click={() => (view = 'skills')}>
      <Sparkles size={14} /> Skills
    </button>
    <button type="button" class:active={view === 'context'} on:click={() => (view = 'context')}>
      <Eye size={14} /> Context
    </button>
  </nav>

  <div class="config-body">
    {#if view === 'skills'}
      <div class="config-section">
        <h4 class="config-title">Skills</h4>
        <p class="config-desc">Enable the skills the assistant should follow. Enabled skills load their instructions into the assistant, replacing per-project AGENTS.md.</p>
        {#each AVAILABLE_SKILLS as skill}
          <div class="skill-row">
            <div class="skill-main">
              <label class="skill-toggle">
                <input type="checkbox" checked={skillState[skill.id]} on:change={() => toggleSkill(skill.id)} />
                <span class="skill-name">{skill.name}</span>
              </label>
              <button type="button" class="config-link" on:click={() => (openSkillId = openSkillId === skill.id ? '' : skill.id)}>
                <BookOpen size={13} /> {openSkillId === skill.id ? 'Hide' : 'Open instructions'}
              </button>
            </div>
            <p class="skill-desc">{skill.description}</p>
            {#if openSkillId === skill.id}
              <div class="skill-detail">
                <pre>{skill.instructions}</pre>
                {#if skill.path}<div><strong>File:</strong> <code>{skill.path}</code></div>{/if}
                {#if skill.reference}<div><strong>Reference:</strong> <code>{skill.reference}</code></div>{/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {:else if view === 'context'}
      <div class="config-section">
        <h4 class="config-title">AI Context Preview</h4>
        <p class="config-desc">What the assistant currently knows about this project.</p>
        <div class="context-card">
          <div class="context-heading">AI knows:</div>
          {#each contextSummary.lines as line}
            <div class="context-line" class:ok={line.startsWith('✓')} class:missing={line.startsWith('✗')}>{line}</div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .ai-config { display: flex; flex-direction: column; flex: 1; min-height: 0; }
  .config-nav {
    display: flex;
    gap: 2px;
    padding: 8px 10px 0;
    border-bottom: 1px solid #1d1f22;
    flex-wrap: wrap;
  }
  .config-nav button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 7px 10px;
    border: 0;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: #8e939b;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }
  .config-nav button.active { color: #f1f2f4; border-bottom-color: #7cf7c5; }
  .config-nav button:hover { color: #dce1e6; }

  .config-body { flex: 1; min-height: 0; overflow-y: auto; padding: 14px; }
  .config-section { display: flex; flex-direction: column; gap: 12px; }
  .config-title { margin: 0; font-size: 13px; font-weight: 700; color: #f1f2f4; }
  .config-desc { margin: 0; font-size: 11px; line-height: 1.5; color: #8e939b; }

  .config-link {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    align-self: flex-start;
    padding: 0;
    border: 0;
    background: transparent;
    color: #7cf7c5;
    font-size: 11px;
    cursor: pointer;
  }
  .config-link:hover { text-decoration: underline; }

  .skill-row { display: flex; flex-direction: column; gap: 6px; padding: 10px 0; border-bottom: 1px solid #1a1c1f; }
  .skill-main { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .skill-toggle { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; }
  .skill-name { font-size: 12px; font-weight: 600; color: #f1f2f4; }
  .skill-desc { margin: 0; font-size: 11px; line-height: 1.5; color: #8e939b; }
  .skill-detail { display: flex; flex-direction: column; gap: 6px; font-size: 11px; color: #b8bec6; }
  .skill-detail code { color: #7cf7c5; word-break: break-all; }
  .skill-detail pre {
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

  .context-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px;
    border: 1px solid #2c3138;
    border-radius: 8px;
    background: #0d0e10;
  }
  .context-heading { font-size: 12px; font-weight: 700; color: #f1f2f4; margin-bottom: 2px; }
  .context-line { font-size: 12px; color: #b8bec6; }
  .context-line.ok { color: #b8ffe4; }
  .context-line.missing { color: #f0b26d; }
</style>
