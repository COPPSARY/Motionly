<script lang="ts">
  import { onMount } from 'svelte';
  import { Bot, Eye, EyeOff, PanelLeftClose, Send, Settings, Sparkles, Trash2 } from 'lucide-svelte';
  import {
    detectProvider,
    AI_HISTORY_KEY,
    AI_SETTINGS_KEY,
    extractMotion,
    restoreEmbeddedAssetPaths,
    requestAssistant,
    resolveChatEndpoint,
    type AiMessage,
    type AiProvider,
    type AiSettings,
  } from '../../ai/chat';
  import type { Asset } from '../../types/scene';
  import { buildAiKnowledge, loadBrand, loadSkillState, MOTIONLY_PROMPT_TEMPLATE } from '../../ai/config';

  export let project = '';
  export let assetList: Asset[] = [];
  export let onLoadMotion: (source: string) => string | null = () => null;
  export let onCollapse: () => void = () => undefined;

  let apiKey = '';
  let provider: AiProvider = 'openai';
  let baseUrl = '';
  let model = '';
  let customEnabled = false;
  let showKey = false;
  let showSettings = true;
  let messages: AiMessage[] = [];
  let draft = '';
  let sending = false;
  let error = '';
  let loadedMessageId = '';
  let invalidMessageId = '';
  let invalidMotionError = '';
  let hasSavedSettings = false;
  let promptCopied = false;
  let composerInput: HTMLTextAreaElement;
  let messageList: HTMLDivElement;

  const promptSuggestions = [
    'Product intro',
    'Soft text reveal',
    'Scene transition',
  ];

  $: detectedProvider = detectProvider(apiKey);
  $: isKiroKey = apiKey.trim().startsWith('ksk_');
  $: isHuggingFaceKey = apiKey.trim().startsWith('hf_');

  onMount(() => {
    try {
      const storedSettings = localStorage.getItem(AI_SETTINGS_KEY);
      if (storedSettings) {
        const saved = JSON.parse(storedSettings) as AiSettings;
        apiKey = saved.apiKey ?? '';
        provider = detectProvider(apiKey) ?? saved.provider ?? 'openai';
        baseUrl = saved.baseUrl ?? '';
        model = saved.model ?? '';
        customEnabled = provider === 'custom';
        showSettings = !apiKey || (saved.provider !== 'custom' && !detectProvider(apiKey));
        hasSavedSettings = Boolean(apiKey);
        if (apiKey && saved.provider !== 'custom' && !detectProvider(apiKey)) {
          error = apiKey.startsWith('ksk_')
            ? 'Kiro API keys work with Kiro CLI, not a documented browser chat endpoint.'
            : 'Choose Custom endpoint for this unrecognized key format.';
        }
      }
      const storedHistory = localStorage.getItem(AI_HISTORY_KEY);
      if (storedHistory) messages = JSON.parse(storedHistory) as AiMessage[];
    } catch {
      error = 'Saved assistant settings could not be read.';
    }
  });

  function handleKeyInput() {
    const detected = detectProvider(apiKey);
    if (detected) {
      if (provider !== detected) model = '';
      provider = detected;
      customEnabled = false;
    }
  }

  function handleProviderChange(event: Event) {
    const next = (event.currentTarget as HTMLSelectElement).value as AiProvider;
    if (provider !== next) model = '';
    provider = next;
    customEnabled = provider === 'custom';
  }

  function toggleCustom(event: Event) {
    customEnabled = (event.currentTarget as HTMLInputElement).checked;
    provider = customEnabled ? 'custom' : detectedProvider ?? 'openai';
  }

  async function copyPromptTemplate() {
    try {
      await navigator.clipboard.writeText(MOTIONLY_PROMPT_TEMPLATE);
      promptCopied = true;
      setTimeout(() => (promptCopied = false), 1800);
    } catch {
      error = 'Your browser blocked clipboard access. Open the prompt guide and copy the template there.';
    }
  }

  function saveSettings() {
    error = '';
    if (!apiKey.trim()) {
      error = 'Enter an API key to continue.';
      return;
    }
    if (!detectedProvider && provider !== 'custom') {
      error = isKiroKey
        ? 'Kiro API keys work with Kiro CLI. Use a supported provider key or configure a compatible gateway under Custom endpoint.'
        : 'Choose Custom endpoint and enter a compatible Base URL for this key format.';
      return;
    }
    if (provider === 'custom') {
      if (!baseUrl.trim()) {
        error = 'Enter the custom endpoint base URL.';
        return;
      }
      try {
        resolveChatEndpoint(baseUrl);
      } catch (cause) {
        error = cause instanceof Error ? cause.message : 'Enter a valid base URL.';
        return;
      }
    }
    localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(currentSettings()));
    hasSavedSettings = true;
    showSettings = false;
  }

  function removeKey() {
    localStorage.removeItem(AI_SETTINGS_KEY);
    apiKey = '';
    baseUrl = '';
    model = '';
    provider = 'openai';
    customEnabled = false;
    hasSavedSettings = false;
    showSettings = true;
    error = '';
  }

  function clearHistory() {
    messages = [];
    loadedMessageId = '';
    localStorage.removeItem(AI_HISTORY_KEY);
  }

  function currentSettings(): AiSettings {
    return { apiKey: apiKey.trim(), provider, baseUrl: baseUrl.trim(), model: model.trim() };
  }

  async function sendMessage() {
    const content = draft.trim();
    if (!content || sending) return;
    error = '';
    const userMessage: AiMessage = { id: crypto.randomUUID(), role: 'user', content };
    messages = [...messages, userMessage];
    draft = '';
    resizeComposer();
    scrollToLatest();
    persistHistory();
    sending = true;
    try {
      const knowledge = buildAiKnowledge({
        brand: loadBrand(),
        skillState: loadSkillState(),
        assets: assetList,
      });
      const response = await requestAssistant(currentSettings(), messages, project, assetList, knowledge);
      messages = [...messages, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response,
        motion: extractMotion(response),
      }];
      scrollToLatest();
      persistHistory();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'The assistant request failed.';
    } finally {
      sending = false;
    }
  }

  function resizeComposer() {
    requestAnimationFrame(() => {
      if (!composerInput) return;
      composerInput.style.height = 'auto';
      const height = Math.min(120, Math.max(38, composerInput.scrollHeight));
      composerInput.style.height = `${height}px`;
      composerInput.style.overflowY = composerInput.scrollHeight > 120 ? 'auto' : 'hidden';
    });
  }

  function scrollToLatest() {
    requestAnimationFrame(() => {
      if (messageList) messageList.scrollTop = messageList.scrollHeight;
    });
  }

  function useSuggestion(suggestion: string) {
    draft = suggestion;
    resizeComposer();
    requestAnimationFrame(() => composerInput?.focus());
  }

  function handleComposerKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  function loadMotion(message: AiMessage) {
    if (!message.motion) return;
    const issue = onLoadMotion(restoreEmbeddedAssetPaths(message.motion, assetList));
    error = issue ?? '';
    invalidMessageId = issue ? message.id : '';
    invalidMotionError = issue ?? '';
    if (!issue) loadedMessageId = message.id;
  }

  function repairMotion() {
    draft = `Repair your last generated .motion project. Motionly's parser reported: ${invalidMotionError}. Return the corrected complete project using only the system prompt syntax.`;
    invalidMessageId = '';
    void sendMessage();
  }

  function persistHistory() {
    localStorage.setItem(AI_HISTORY_KEY, JSON.stringify(messages));
  }

  function explanation(content: string): string {
    return content.replace(/```motion\s*[\s\S]*?```/gi, '').trim();
  }
</script>

<section class="ai-chat-panel" aria-label="Motionly Assistant">
  <header class="chat-header">
    <div class="chat-title"><Bot size={16} /><span>Motionly Assistant</span></div>
    <div class="header-actions">
      {#if messages.length && !showSettings}
        <button type="button" class="icon-button" on:click={clearHistory} title="Clear chat"><Trash2 size={14} /></button>
      {/if}
      <button type="button" class="icon-button" class:active={showSettings} on:click={() => showSettings = !showSettings} title="Assistant settings"><Settings size={15} /></button>
      <button type="button" class="icon-button" on:click={onCollapse} title="Collapse assistant"><PanelLeftClose size={15} /></button>
    </div>
  </header>

  {#if showSettings}
    <div class="settings-view">
      <div>
        <h3>Connect AI to Motionly</h3>
        <p>Motionly does not host or proxy AI requests. Your key lets this browser contact your provider directly and turn prompts into editable <code>.motion</code> projects. Any usage is billed by your provider.</p>
      </div>

      <div class="field">
        <label for="motionly-ai-key">API key</label>
        <div class="key-input">
          <input id="motionly-ai-key" type={showKey ? 'text' : 'password'} bind:value={apiKey} on:input={handleKeyInput} placeholder="Paste API key" autocomplete="off" />
          <button type="button" on:click={() => showKey = !showKey} title={showKey ? 'Hide key' : 'Show key'}>
            {#if showKey}<EyeOff size={15} />{:else}<Eye size={15} />{/if}
          </button>
        </div>
      </div>

      {#if apiKey.trim()}
        {#if detectedProvider || customEnabled}
          <select class="provider-chip" value={provider} on:change={handleProviderChange} aria-label="AI provider">
            <option value="openai">Detected: OpenAI</option>
            <option value="anthropic">Detected: Anthropic</option>
            <option value="openrouter">Detected: OpenRouter</option>
            <option value="gemini">Detected: Google Gemini</option>
            <option value="huggingface">Detected: Hugging Face</option>
            <option value="custom">Custom endpoint</option>
          </select>
        {:else}
          <label class="custom-toggle">
            <input type="checkbox" checked={customEnabled} on:change={toggleCustom} />
            <span>Custom endpoint</span>
          </label>
        {/if}
      {/if}

      {#if isKiroKey}
        <p class="provider-warning">
          Detected: Kiro CLI key. Kiro does not document a direct browser/OpenAI-compatible chat endpoint, so this key cannot be sent directly. Use another provider key, or enable Custom endpoint if you have a compatible gateway.
        </p>
      {/if}

      {#if isHuggingFaceKey}
        <p class="provider-note">Hugging Face tokens need “Make calls to Inference Providers” permission. Enter any compatible chat model ID below.</p>
      {/if}

      {#if customEnabled}
        <div class="field">
          <label for="motionly-ai-url">Base URL</label>
          <input id="motionly-ai-url" bind:value={baseUrl} placeholder="http://localhost:11434/v1" />
        </div>
      {/if}

      {#if apiKey.trim() && (detectedProvider || customEnabled)}
        <div class="field">
          <label for="motionly-ai-model">Model <span>(optional)</span></label>
          <input id="motionly-ai-model" bind:value={model} placeholder="Exact model ID" />
          <small>Leave blank to use Motionly's provider default.</small>
        </div>
      {/if}

      <p class="privacy-note">Your key is stored locally in your browser and never sent to our servers.</p>
      <p class="guide-note">
        See the <a href="https://motionly.mintlify.app/agents/ai-authoring" target="_blank" rel="noreferrer">prompt guide</a>
        for templates and an introduction to the <code>write-motionly</code> skill.
      </p>
      <button type="button" class="copy-prompt-button" on:click={copyPromptTemplate}>
        {promptCopied ? 'Prompt Template Copied' : 'Copy Prompt Template'}
      </button>
      {#if error}<p class="error-message">{error}</p>{/if}
      <div class="settings-actions">
        {#if hasSavedSettings}
          <button type="button" class="secondary-button danger" on:click={removeKey}>Remove key</button>
        {/if}
        <button type="button" class="primary-button" on:click={saveSettings}>Save &amp; continue</button>
      </div>
    </div>
  {:else}
    <div bind:this={messageList} class="message-list" aria-live="polite">
      {#if messages.length === 0}
        <div class="empty-state assistant-empty-state">
          <span class="assistant-empty-icon"><Sparkles size={18} /></span>
          <strong>Start with an idea</strong>
          <span>Describe a scene, animation, or change. Every result stays editable in Motionly.</span>
          <a class="assistant-guide-link" href="https://motionly.mintlify.app/agents/ai-authoring" target="_blank" rel="noreferrer">View prompting guide</a>
        </div>
      {:else}
        {#each messages as message (message.id)}
          <article class="message" class:user={message.role === 'user'}>
            <div class="message-role">{message.role === 'user' ? 'You' : 'Assistant'}</div>
            {#if explanation(message.content)}<p>{explanation(message.content)}</p>{/if}
            {#if message.motion}
              <pre><code>{message.motion}</code></pre>
              <button type="button" class="load-button" on:click={() => loadMotion(message)}>
                {loadedMessageId === message.id ? 'Loaded' : 'Load into Editor'}
              </button>
              {#if invalidMessageId === message.id}
                <button type="button" class="repair-button" on:click={repairMotion}>Ask Assistant to Fix</button>
              {/if}
            {/if}
          </article>
        {/each}
        {#if sending}<div class="thinking">Drafting your project…</div>{/if}
      {/if}
    </div>

    <div class="composer-wrap">
      {#if error}<p class="error-message">{error}</p>{/if}
      <div class="suggestion-chips" aria-label="Prompt suggestions">
        {#each promptSuggestions as suggestion}
          <button type="button" on:click={() => useSuggestion(suggestion)}>{suggestion}</button>
        {/each}
      </div>
      <div class="composer" class:has-draft={Boolean(draft.trim())}>
        <span class="command-mark"><Sparkles size={15} /></span>
        <textarea bind:this={composerInput} rows="1" bind:value={draft} on:input={resizeComposer} on:keydown={handleComposerKeydown} placeholder="Ask Motionly to create or refine…" aria-label="Message Motionly Assistant"></textarea>
        <button type="button" class="send-button" on:click={sendMessage} disabled={!draft.trim() || sending} title="Send prompt (Enter)" aria-label="Send prompt"><Send size={15} /></button>
      </div>
      <span class="composer-hint">Enter to send · Shift+Enter for a new line</span>
    </div>
  {/if}
</section>

<style>
  .ai-chat-panel { height: 100%; min-height: 0; display: flex; flex-direction: column; background: #111214; color: #e4e6ea; }
  .chat-header { min-height: 57px; padding: 0 14px 0 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1c1d20; background: #0d0e10; }
  .chat-title, .header-actions { display: flex; align-items: center; gap: 8px; }
  .chat-title { font-size: 13px; font-weight: 600; }
  .chat-title :global(svg) { color: #0a84ff; }
  button { font: inherit; }
  .icon-button { width: 28px; height: 28px; padding: 0; display: grid; place-items: center; border: 1px solid #2a2d33; border-radius: 6px; color: #8e939b; background: #17191c; cursor: pointer; }
  .icon-button:hover, .icon-button.active { color: #0a84ff; border-color: #244f78; }
  .settings-view { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: #34383e transparent; padding: 20px 16px; display: flex; flex-direction: column; gap: 16px; }
  h3 { margin: 0 0 6px; font-size: 14px; }
  .settings-view > div > p { margin: 0; color: #8e939b; font-size: 12px; line-height: 1.5; }
  .settings-view > div > p code { color: #a9b0b9; font-size: 11px; }
  .field { display: flex; flex-direction: column; gap: 7px; }
  .field label { color: #b6bac1; font-size: 11px; font-weight: 600; }
  .field label span { color: #6b7280; font-weight: 400; }
  .field small { color: #6b7280; font-size: 10px; line-height: 1.35; }
  input, select, textarea { box-sizing: border-box; width: 100%; border: 1px solid #2a2d33; border-radius: 7px; outline: none; background: #17191c; color: #e4e6ea; }
  input { height: 36px; padding: 0 10px; font-size: 12px; }
  input:focus, select:focus, textarea:focus { border-color: #0a84ff; }
  .key-input { position: relative; }
  .key-input input { padding-right: 38px; }
  .key-input button { position: absolute; top: 4px; right: 4px; width: 28px; height: 28px; display: grid; place-items: center; padding: 0; border: 0; background: transparent; color: #8e939b; cursor: pointer; }
  .provider-chip { width: auto; height: 28px; padding: 0 26px 0 9px; border-color: #244f78; border-radius: 999px; color: #66b5ff; font-size: 11px; }
  .custom-toggle { display: flex; align-items: center; gap: 8px; color: #b6bac1; font-size: 12px; }
  .custom-toggle input { width: 14px; height: 14px; accent-color: #0a84ff; }
  .privacy-note { margin: 0; color: #777d86; font-size: 11px; line-height: 1.45; }
  .provider-warning { margin: 0; padding: 9px; border: 1px solid #55452b; border-radius: 6px; background: #241f17; color: #d9bd85; font-size: 11px; line-height: 1.45; }
  .provider-note { margin: 0; padding: 9px; border: 1px solid #1e4e76; border-radius: 6px; background: #111f2c; color: #9bcfff; font-size: 11px; line-height: 1.45; }
  .guide-note { margin: 0; color: #777d86; font-size: 11px; line-height: 1.45; }
  .guide-note a { color: #0a84ff; text-decoration: none; }
  .guide-note a:hover { text-decoration: underline; }
  .guide-note code { color: #a9b0b9; font-size: 10px; }
  .copy-prompt-button { align-self: flex-start; padding: 7px 10px; border: 1px solid #244f78; border-radius: 6px; background: #111f2c; color: #66b5ff; cursor: pointer; font-size: 11px; font-weight: 600; }
  .copy-prompt-button:hover { border-color: #0a84ff; background: #102a42; }
  .error-message { margin: 0; color: #f09b9b; font-size: 11px; line-height: 1.4; }
  .settings-actions { margin-top: auto; display: flex; justify-content: flex-end; gap: 8px; }
  .primary-button, .secondary-button, .load-button, .repair-button { padding: 7px 10px; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600; }
  .primary-button, .load-button { border: 1px solid #0a84ff; background: #10345a; color: #66b5ff; }
  .secondary-button { border: 1px solid #2a2d33; background: #17191c; color: #a5aab2; }
  .repair-button { margin-left: 6px; border: 1px solid #59472c; background: #251f17; color: #d9bd85; }
  .secondary-button.danger { margin-right: auto; color: #dc9494; }
  .message-list { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; scrollbar-width: none; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
  .message-list::-webkit-scrollbar { display: none; width: 0; height: 0; }
  .settings-view::-webkit-scrollbar, .message-list::-webkit-scrollbar, textarea::-webkit-scrollbar { width: 6px; height: 6px; }
  .settings-view::-webkit-scrollbar-track, .message-list::-webkit-scrollbar-track, textarea::-webkit-scrollbar-track { background: transparent; }
  .settings-view::-webkit-scrollbar-thumb, .message-list::-webkit-scrollbar-thumb, textarea::-webkit-scrollbar-thumb { border-radius: 999px; background: #34383e; }
  .settings-view::-webkit-scrollbar-thumb:hover, .message-list::-webkit-scrollbar-thumb:hover, textarea::-webkit-scrollbar-thumb:hover { background: #484d55; }
  .empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: #6f747c; font-size: 11px; line-height: 1.5; text-align: center; }
  .empty-state strong { color: #8e939b; font-size: 12px; font-weight: 500; }
  .empty-state span { max-width: 230px; }
  .empty-state a { color: #0a84ff; text-decoration: none; }
  .empty-state a:hover { text-decoration: underline; }
  .message { align-self: stretch; padding: 11px; border: 1px solid #24262a; border-radius: 9px; background: #151619; }
  .message.user { align-self: flex-end; max-width: 86%; background: #101e2c; border-color: #183a5c; }
  .message-role { margin-bottom: 6px; color: #0a84ff; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
  .message.user .message-role { color: #9ca3af; }
  .message p { margin: 0; color: #c8cbd0; font-size: 12px; line-height: 1.5; white-space: pre-wrap; }
  pre { margin: 9px 0; padding: 10px; overflow: visible; border: 1px solid #25282d; border-radius: 6px; background: #0d0e10; color: #a8d5ff; font: 10px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }
  .thinking { color: #777d86; font-size: 11px; }
  .composer-wrap { padding: 10px 12px 12px; border-top: 1px solid #1c1d20; background: #0d0e10; }
  .composer-wrap .error-message { margin-bottom: 8px; }
  .composer { display: flex; align-items: flex-end; gap: 7px; padding: 7px; border: 1px solid #2a2d33; border-radius: 10px; background: #17191c; }
  textarea { min-height: 38px; max-height: 120px; padding: 4px; resize: none; overflow-y: hidden; scrollbar-width: thin; scrollbar-color: #34383e transparent; border: 0; background: transparent; font-size: 12px; line-height: 1.4; }
  .composer button { flex: 0 0 auto; width: 30px; height: 30px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 50%; background: transparent; color: #66b5ff; cursor: pointer; transition: color .15s ease, background .15s ease, transform .15s ease; }
  .composer button:hover:not(:disabled) { background: rgba(10, 132, 255, .1); color: #d8ecff; transform: translateY(-1px); }
  .composer button:focus-visible { outline: 2px solid #0a84ff; outline-offset: 1px; }
  .composer button:disabled { border: 0; background: transparent; color: #4c5158; cursor: default; }

  .ai-chat-panel { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif; background: rgba(20,20,23,.96); }
  .chat-header, .composer-wrap { background: rgba(14,14,16,.96); border-color: rgba(255,255,255,.08); }
  .suggestion-chips { display: flex; gap: 6px; padding-bottom: 8px; overflow-x: auto; scrollbar-width: none; }
  .suggestion-chips::-webkit-scrollbar { display: none; }
  .suggestion-chips button { flex: 0 0 auto; height: 26px; padding: 0 9px; border: 1px solid rgba(255,255,255,.08); border-radius: 999px; background: rgba(255,255,255,.04); color: #9999a1; font-size: 10px; cursor: pointer; }
  .suggestion-chips button:hover { border-color: rgba(10,132,255,.42); color: #dceeff; background: rgba(10,132,255,.1); }
  .composer { align-items: center; min-height: 48px; padding: 5px 6px 5px 10px; border-color: rgba(255,255,255,.1); border-radius: 12px; background: #19191c; box-shadow: 0 8px 24px rgba(0,0,0,.18); transition: border-color .15s ease, box-shadow .15s ease; }
  .composer:focus-within { border-color: rgba(10,132,255,.7); box-shadow: 0 0 0 3px rgba(10,132,255,.1), 0 10px 30px rgba(0,0,0,.22); }
  .command-mark { flex: 0 0 auto; width: 20px; color: #6d6d75; font-size: 13px; font-weight: 700; }
  .composer textarea { min-height: 34px; padding: 7px 2px; color: #f2f2f5; }
  .composer .send-button { width: 32px; height: 32px; border-radius: 8px; background: #0a84ff; color: #fff; }
  .composer .send-button:hover:not(:disabled) { background: #2997ff; color: #fff; transform: none; }
  .composer .send-button:disabled { background: rgba(255,255,255,.05); color: #55555c; }
  .composer-hint { display: block; margin-top: 6px; color: #5f5f67; font-size: 9px; text-align: right; }
  .empty-state strong { color: #d4d4d8; font-size: 13px; }
  .message { border-color: rgba(255,255,255,.08); background: rgba(255,255,255,.035); }

  /* Matte command surface: tonal depth, no glow or floating elevation. */
  .ai-chat-panel { background: #151517; }
  .chat-header,
  .composer-wrap { background: #131315; backdrop-filter: none; }
  .icon-button,
  .secondary-button,
  .copy-prompt-button {
    border-color: rgba(255,255,255,.08);
    background: #1b1b1e;
    color: #aaaab1;
  }
  .icon-button:hover,
  .icon-button.active,
  .copy-prompt-button:hover { border-color: rgba(255,255,255,.13); background: #232327; color: #f2f2f4; }
  .provider-chip { border-color: rgba(255,255,255,.1); background: #1a1a1d; color: #b9b9c0; }
  .message,
  .message.user { border-color: rgba(255,255,255,.08); background: #1a1a1d; }
  .suggestion-chips button { border-radius: 7px; background: #1a1a1d; }
  .suggestion-chips button:hover { border-color: rgba(255,255,255,.13); background: #222226; color: #ededf0; }
  .composer {
    min-height: 46px;
    border-radius: 8px;
    border-color: rgba(255,255,255,.1);
    background: #1b1b1e;
    box-shadow: none;
  }
  .composer:focus-within { border-color: rgba(10,132,255,.65); box-shadow: none; }
  .composer button:hover:not(:disabled) { transform: none; }
  .composer .send-button { border-radius: 7px; }


  /* Inter command bar with compact, fully visible suggestions. */
  .ai-chat-panel {
    font-family: 'Inter Variable', Inter, -apple-system, BlinkMacSystemFont, sans-serif;
    font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11';
  }
  .assistant-empty-state { gap: 9px; padding: 24px; }
  .assistant-empty-icon {
    width: 38px;
    height: 38px;
    display: grid;
    place-items: center;
    margin-bottom: 3px;
    border: 1px solid rgba(255,255,255,.09);
    border-radius: 9px;
    background: #1d1d20;
    color: #78a8ff;
    box-shadow: none;
  }
  .assistant-empty-state > span:not(.assistant-empty-icon) { max-width: 240px; color: #777780; font-size: 11px; line-height: 1.5; }
  .assistant-guide-link { color: #91b5f4; font-size: 10px; text-decoration: none; }
  .assistant-guide-link:hover { color: #b6cef7; text-decoration: underline; }
  .composer-wrap { padding: 11px 12px 12px; }
  .suggestion-chips {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 5px;
    overflow: visible;
    padding-bottom: 8px;
  }
  .suggestion-chips button {
    min-width: 0;
    width: 100%;
    height: 27px;
    overflow: hidden;
    padding: 0 7px;
    border-color: rgba(255,255,255,.09);
    border-radius: 7px;
    background: #1d1d20;
    color: #9a9aa2;
    box-shadow: none;
    font-size: 9.5px;
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .suggestion-chips button:hover {
    border-color: rgba(255,255,255,.15);
    background: #252529;
    color: #e5e5e8;
  }
  .composer {
    min-height: 52px;
    padding: 6px 7px 6px 10px;
    border-color: rgba(255,255,255,.11);
    border-radius: 9px;
    background: #1b1b1e;
    box-shadow: none;
  }
  .composer:focus-within {
    border-color: rgba(120,168,255,.52);
    box-shadow: none;
  }
  .command-mark { width: 18px; color: #73737c; }
  .composer textarea {
    min-width: 0;
    min-height: 38px;
    padding: 8px 3px;
    font-family: 'Inter Variable', Inter, -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 11.5px;
    font-weight: 450;
    line-height: 1.45;
    letter-spacing: -.01em;
  }
  .composer textarea::placeholder { color: #777780; opacity: 1; }
  .composer .send-button {
    width: 34px;
    height: 34px;
    border: 1px solid rgba(255,255,255,.14);
    border-radius: 8px;
    background: #0a84ff;
    color: #fff;
    box-shadow: none;
  }
  .composer .send-button:hover:not(:disabled) { background: #2997ff; }
  .composer .send-button:disabled {
    border-color: rgba(255,255,255,.07);
    background: #242428;
    color: #56565e;
    box-shadow: none;
  }
  .composer-hint { margin-top: 7px; color: #55555d; font-size: 9px; }

  /* Flat assistant surfaces with logo-gradient interaction states. */
  .icon-button:hover,
  .icon-button.active,
  .suggestion-chips button:hover {
    border-color: rgba(138, 180, 255, 0.3);
    background: linear-gradient(135deg, rgba(138, 180, 255, 0.16), rgba(124, 247, 197, 0.09));
    color: #eef7f4;
  }
  .composer .send-button,
  .composer .send-button:hover:not(:disabled) {
    border-color: rgba(255, 255, 255, 0.18);
    background: linear-gradient(135deg, #8ab4ff 0%, #7cf7c5 100%);
    color: #fff;
  }

</style>
