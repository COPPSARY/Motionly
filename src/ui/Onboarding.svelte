<script lang="ts">
  import { onMount } from 'svelte';
  import { ArrowRight, Eye, EyeOff } from 'lucide-svelte';
  import {
    AI_SETTINGS_KEY,
    detectProvider,
    resolveChatEndpoint,
    type AiProvider,
    type AiSettings,
  } from '../ai/chat';
  import { appUrl, ONBOARDING_COMPLETE_KEY } from '../app/routing';

  const logoUrl = appUrl('logo.svg');
  const githubIconUrl = appUrl('github.svg');
  const presetPreviewUrl = appUrl('preset/motionly/motionly-preset.gif');

  let step = 1;
  let apiKey = '';
  let provider: AiProvider = 'openai';
  let baseUrl = '';
  let model = '';
  let customEnabled = false;
  let showKey = false;
  let error = '';

  $: detectedProvider = detectProvider(apiKey);
  $: isKiroKey = apiKey.trim().startsWith('ksk_');

  onMount(() => {
    try {
      const stored = localStorage.getItem(AI_SETTINGS_KEY);
      if (!stored) return;
      const saved = JSON.parse(stored) as AiSettings;
      apiKey = saved.apiKey ?? '';
      provider = detectProvider(apiKey) ?? saved.provider ?? 'openai';
      baseUrl = saved.baseUrl ?? '';
      model = saved.model ?? '';
      customEnabled = provider === 'custom';
    } catch {
      error = 'Saved provider settings could not be read.';
    }
  });

  function handleKeyInput() {
    const detected = detectProvider(apiKey);
    if (!detected) return;
    if (provider !== detected) model = '';
    provider = detected;
    customEnabled = false;
  }

  function handleProviderChange(event: Event) {
    const next = (event.currentTarget as HTMLSelectElement).value as AiProvider;
    if (next !== provider) model = '';
    provider = next;
    customEnabled = provider === 'custom';
  }

  function toggleCustom(event: Event) {
    customEnabled = (event.currentTarget as HTMLInputElement).checked;
    provider = customEnabled ? 'custom' : detectedProvider ?? 'openai';
  }

  function continueWithKey() {
    error = '';
    if (!apiKey.trim()) {
      error = 'Paste an API key or skip this step for now.';
      return;
    }
    if (!detectedProvider && provider !== 'custom') {
      error = isKiroKey
        ? 'Kiro keys authenticate Kiro CLI, not a documented browser chat endpoint.'
        : 'Choose Custom endpoint for this key format.';
      return;
    }
    if (provider === 'custom') {
      try {
        resolveChatEndpoint(baseUrl);
      } catch (cause) {
        error = cause instanceof Error ? cause.message : 'Enter a valid Base URL.';
        return;
      }
    }
    localStorage.setItem(
      AI_SETTINGS_KEY,
      JSON.stringify({ apiKey: apiKey.trim(), provider, baseUrl: baseUrl.trim(), model: model.trim() } satisfies AiSettings)
    );
    step = 3;
  }

  function finish() {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    window.location.assign(appUrl('editor'));
  }
</script>

<main class="onboarding">
  <div class="brand"><img src={logoUrl} alt="" /><span>Motionly</span></div>

  <section class="step-card" aria-live="polite">
    <div class="progress" aria-label={`Step ${step} of 5`}>
      <span>Step {step} of 5</span>
      <div class="dots">
        {#each [1, 2, 3, 4, 5] as item}
          <i class:active={item === step} class:complete={item < step}></i>
        {/each}
      </div>
    </div>

    {#key step}
      <div class="step-content">
        {#if step === 1}
          <div class="title-row"><h1>Welcome to Motionly</h1><span class="beta">Beta</span></div>
          <p class="notice">We're early in beta—you may run into bugs or rough edges. Thanks for being here while we sort them out.</p>
          <p>Motionly is an AI-native motion graphics editor. AI generates an editable project instead of a finished video, then you refine it visually—drag, scale, tune timing, scrub, and export.</p>
          <p>Underneath, every project is a plain, readable <code>.motion</code> file. What AI makes is a starting point you can actually direct.</p>
          <div class="actions end"><button class="primary" type="button" on:click={() => step = 2}>Continue <ArrowRight size={15} /></button></div>
        {:else if step === 2}
          <h1>Connect your AI provider</h1>
          <p>AI features are Bring Your Own Key (BYOK). Motionly does not host or proxy AI requests; your browser sends prompts directly to your chosen provider.</p>

          <div class="field">
            <label for="welcome-api-key">API key</label>
            <div class="key-field">
              <input id="welcome-api-key" type={showKey ? 'text' : 'password'} bind:value={apiKey} on:input={handleKeyInput} placeholder="Paste API key" autocomplete="off" />
              <button type="button" on:click={() => showKey = !showKey} title={showKey ? 'Hide key' : 'Show key'}>{#if showKey}<EyeOff size={15} />{:else}<Eye size={15} />{/if}</button>
            </div>
          </div>

          {#if apiKey.trim()}
            {#if detectedProvider || customEnabled}
              <select class="provider-chip" value={provider} on:change={handleProviderChange} aria-label="AI provider">
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="openrouter">OpenRouter</option>
                <option value="gemini">Google Gemini</option>
                <option value="huggingface">Hugging Face</option>
                <option value="custom">Custom endpoint</option>
              </select>
            {:else}
              <label class="custom-toggle"><input type="checkbox" checked={customEnabled} on:change={toggleCustom} /> Custom endpoint</label>
            {/if}
          {/if}

          {#if isKiroKey}<p class="warning">Kiro keys work with Kiro CLI, not a documented browser chat endpoint. Use another provider or a compatible custom gateway.</p>{/if}

          {#if customEnabled}
            <div class="field"><label for="welcome-base-url">Base URL</label><input id="welcome-base-url" bind:value={baseUrl} placeholder="http://localhost:11434/v1" /></div>
          {/if}
          {#if apiKey.trim() && (detectedProvider || customEnabled)}
            <div class="field"><label for="welcome-model">Model <span>(optional)</span></label><input id="welcome-model" bind:value={model} placeholder="Exact model ID" /><small>Leave blank to use Motionly's default for this provider.</small></div>
          {/if}

          <p class="privacy">Your key is stored locally in your browser and never sent to our servers.</p>
          {#if error}<p class="error">{error}</p>{/if}
          <div class="actions split"><button class="text-button" type="button" on:click={() => step = 1}>Back</button><button class="primary" type="button" on:click={continueWithKey}>Continue <ArrowRight size={15} /></button></div>
          <button class="skip" type="button" on:click={() => step = 3}>Skip for now</button>
          <small class="skip-note">You can always add this later from the AI Assistant panel in the editor.</small>
        {:else if step === 3}
          <h1>Start with one solid preset</h1>
          <p>Motionly currently ships with one preset to explore while the editor is in beta. More purposeful presets are coming.</p>
          <div class="preset"><img src={presetPreviewUrl} alt="Motionly preset preview" /><div><strong>Motionly</strong><span>A complete editable project to inspect, remix, and learn from.</span></div></div>
          <div class="loop"><span>Describe or choose a preset</span><ArrowRight size={14} /><span>Get editable `.motion`</span><ArrowRight size={14} /><span>Refine visually</span><ArrowRight size={14} /><span>Export</span></div>
          <div class="actions split"><button class="text-button" type="button" on:click={() => step = 2}>Back</button><button class="primary" type="button" on:click={() => step = 4}>Continue <ArrowRight size={15} /></button></div>
        {:else if step === 4}
          <img class="hero-icon" src={githubIconUrl} alt="" />
          <h1>Build Motionly with us</h1>
          <p>Motionly is open source. Follow progress, report rough edges, or contribute directly on GitHub.</p>
          <a class="github" href="https://github.com/COPPSARY/Motionly" target="_blank" rel="noreferrer"><img src={githubIconUrl} alt="" /> Open Motionly on GitHub</a>
          <div class="actions split"><button class="text-button" type="button" on:click={() => step = 3}>Back</button><button class="primary" type="button" on:click={() => step = 5}>Continue <ArrowRight size={15} /></button></div>
        {:else}
          <img class="final-logo" src={logoUrl} alt="" />
          <h1>Ready when you are.</h1>
          <p>Start from the preset, describe an idea to the Assistant, or build visually from scratch.</p>
          <button class="primary final" type="button" on:click={finish}>Let's create something together <ArrowRight size={15} /></button>
        {/if}
      </div>
    {/key}
  </section>
</main>

<style>
  :global(html), :global(body) { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #0b0c0e; }
  :global(body) { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  * { box-sizing: border-box; }
  .onboarding { width: 100%; height: 100dvh; overflow: auto; display: grid; place-items: center; padding: 72px 24px 32px; color: #e4e6ea; background: linear-gradient(90deg, rgba(255,255,255,.026) 1px, transparent 1px), linear-gradient(rgba(255,255,255,.026) 1px, transparent 1px), #0b0c0e; background-size: 32px 32px; }
  .brand { position: fixed; top: 20px; left: 24px; display: flex; align-items: center; gap: 9px; color: #f2f3f5; font-size: 14px; font-weight: 650; }
  .brand img { width: 28px; height: 28px; border-radius: 7px; }
  .step-card { width: min(640px, 100%); min-height: 520px; display: flex; flex-direction: column; padding: 22px 26px 26px; border: 1px solid #292c31; border-radius: 14px; background: rgba(15,16,18,.96); box-shadow: 0 24px 70px rgba(0,0,0,.42); }
  .progress { display: flex; align-items: center; justify-content: space-between; padding-bottom: 18px; border-bottom: 1px solid #22252a; color: #686e77; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; }
  .dots { display: flex; gap: 6px; }
  .dots i { width: 6px; height: 6px; border-radius: 999px; background: #33373d; }
  .dots i.active { width: 18px; background: #7cf7c5; }
  .dots i.complete { background: #477565; }
  .step-content { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 14px; padding: 26px 16px 4px; animation: enter .2s ease-out; }
  @keyframes enter { from { opacity: 0; transform: translateY(5px); } }
  h1 { margin: 0; color: #f3f4f6; font-size: clamp(24px, 4vw, 34px); line-height: 1.12; letter-spacing: -.025em; }
  p { margin: 0; color: #9ca1aa; font-size: 14px; line-height: 1.65; }
  code { color: #b8e9d7; font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; }
  .title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .beta { padding: 4px 8px; border: 1px solid #426e5e; border-radius: 999px; background: #17251f; color: #8ff0ca; font-size: 10px; font-weight: 700; text-transform: uppercase; }
  .notice { padding: 10px 12px; border-left: 2px solid #6bc9a8; background: #151a18; color: #aeb5b0; font-size: 12px; }
  .field { display: flex; flex-direction: column; gap: 7px; }
  .field label { color: #c5c9cf; font-size: 11px; font-weight: 600; }
  .field label span, .field small { color: #686e77; font-weight: 400; font-size: 10px; }
  input, select { width: 100%; height: 38px; padding: 0 11px; border: 1px solid #2d3137; border-radius: 7px; outline: none; background: #17191c; color: #e4e6ea; font: inherit; font-size: 12px; }
  input:focus, select:focus { border-color: #477565; }
  .key-field { position: relative; }
  .key-field input { padding-right: 42px; }
  .key-field button { position: absolute; top: 4px; right: 4px; width: 30px; height: 30px; display: grid; place-items: center; padding: 0; border: 0; background: transparent; color: #8e939b; cursor: pointer; }
  .provider-chip { width: auto; max-width: 220px; border-color: #355e4f; border-radius: 999px; color: #9af8d1; }
  .custom-toggle { display: flex; align-items: center; gap: 8px; color: #b6bac1; font-size: 12px; }
  .custom-toggle input { width: 14px; height: 14px; accent-color: #7cf7c5; }
  .privacy, .skip-note { color: #6e747d; font-size: 11px; }
  .warning, .error { padding: 9px 10px; border-radius: 7px; font-size: 11px; line-height: 1.45; }
  .warning { border: 1px solid #55452b; background: #241f17; color: #d9bd85; }
  .error { border: 1px solid #5c3030; background: #251919; color: #eea2a2; }
  .actions { display: flex; align-items: center; margin-top: auto; padding-top: 16px; }
  .actions.end { justify-content: flex-end; }
  .actions.split { justify-content: space-between; }
  button, .github { font: inherit; }
  button.primary, .github { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 38px; padding: 0 15px; border: 1px solid #4d8c75; border-radius: 7px; background: #1a3b30; color: #a4f8d5; font-size: 12px; font-weight: 650; cursor: pointer; text-decoration: none; }
  button.primary:hover, .github:hover { background: #214a3d; }
  .text-button, .skip { border: 0; background: transparent; color: #8e939b; font-size: 12px; cursor: pointer; }
  .skip { align-self: center; margin-top: 4px; text-decoration: underline; text-underline-offset: 3px; }
  .skip-note { align-self: center; text-align: center; }
  .preset { display: grid; grid-template-columns: 180px 1fr; gap: 16px; align-items: center; padding: 12px; border: 1px solid #292d32; border-radius: 10px; background: #131518; }
  .preset img { width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 6px; background: #070809; }
  .preset div { display: flex; flex-direction: column; gap: 6px; }
  .preset strong { font-size: 13px; }
  .preset span { color: #858b94; font-size: 11px; line-height: 1.45; }
  .loop { display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap; padding: 12px; color: #727982; font-size: 10px; text-align: center; }
  .loop span { color: #aeb3ba; }
  .hero-icon { width: 30px; height: 30px; }
  .github { align-self: flex-start; }
  .github img { width: 17px; height: 17px; }
  .final-logo { width: 56px; height: 56px; align-self: center; border-radius: 13px; }
  .final-logo + h1, .final-logo + h1 + p { text-align: center; }
  button.final { align-self: center; margin-top: 14px; }
  @media (max-width: 600px) { .onboarding { padding: 64px 12px 12px; } .brand { left: 16px; top: 16px; } .step-card { min-height: calc(100dvh - 76px); padding: 18px 14px; } .step-content { padding: 22px 4px 2px; } .preset { grid-template-columns: 1fr; } }
</style>
