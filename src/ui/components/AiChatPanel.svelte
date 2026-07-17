<script lang="ts">
  import { onMount } from 'svelte';
  import { Bot, Eye, EyeOff, PanelLeftClose, Send, Settings, Trash2 } from 'lucide-svelte';
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
        <div class="empty-state">
          <strong>What are we making today?</strong>
          <span>
            See the <a href="https://motionly.mintlify.app/agents/ai-authoring" target="_blank" rel="noreferrer">prompt guide</a>
            for templates and an introduction to the <code>write-motionly</code> skill.
          </span>
          <button type="button" class="copy-prompt-button" on:click={copyPromptTemplate}>
            {promptCopied ? 'Prompt Template Copied' : 'Copy Prompt Template'}
          </button>
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
      <div class="composer">
        <textarea bind:this={composerInput} rows="1" bind:value={draft} on:input={resizeComposer} on:keydown={handleComposerKeydown} placeholder="Describe the animation you want..." aria-label="Message Motionly Assistant"></textarea>
        <button type="button" on:click={sendMessage} disabled={!draft.trim() || sending} title="Send message"><Send size={15} /></button>
      </div>
    </div>
  {/if}
</section>

<style>
  .ai-chat-panel { height: 100%; min-height: 0; display: flex; flex-direction: column; background: #111214; color: #e4e6ea; }
  .chat-header { min-height: 57px; padding: 0 14px 0 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1c1d20; background: #0d0e10; }
  .chat-title, .header-actions { display: flex; align-items: center; gap: 8px; }
  .chat-title { font-size: 13px; font-weight: 600; }
  .chat-title :global(svg) { color: #7cf7c5; }
  button { font: inherit; }
  .icon-button { width: 28px; height: 28px; padding: 0; display: grid; place-items: center; border: 1px solid #2a2d33; border-radius: 6px; color: #8e939b; background: #17191c; cursor: pointer; }
  .icon-button:hover, .icon-button.active { color: #7cf7c5; border-color: #355e4f; }
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
  input:focus, select:focus, textarea:focus { border-color: #437263; }
  .key-input { position: relative; }
  .key-input input { padding-right: 38px; }
  .key-input button { position: absolute; top: 4px; right: 4px; width: 28px; height: 28px; display: grid; place-items: center; padding: 0; border: 0; background: transparent; color: #8e939b; cursor: pointer; }
  .provider-chip { width: auto; height: 28px; padding: 0 26px 0 9px; border-color: #355e4f; border-radius: 999px; color: #9af8d1; font-size: 11px; }
  .custom-toggle { display: flex; align-items: center; gap: 8px; color: #b6bac1; font-size: 12px; }
  .custom-toggle input { width: 14px; height: 14px; accent-color: #7cf7c5; }
  .privacy-note { margin: 0; color: #777d86; font-size: 11px; line-height: 1.45; }
  .provider-warning { margin: 0; padding: 9px; border: 1px solid #55452b; border-radius: 6px; background: #241f17; color: #d9bd85; font-size: 11px; line-height: 1.45; }
  .provider-note { margin: 0; padding: 9px; border: 1px solid #29483d; border-radius: 6px; background: #17231f; color: #9bcbb9; font-size: 11px; line-height: 1.45; }
  .guide-note { margin: 0; color: #777d86; font-size: 11px; line-height: 1.45; }
  .guide-note a { color: #7cf7c5; text-decoration: none; }
  .guide-note a:hover { text-decoration: underline; }
  .guide-note code { color: #a9b0b9; font-size: 10px; }
  .copy-prompt-button { align-self: flex-start; padding: 7px 10px; border: 1px solid #355e4f; border-radius: 6px; background: #17231f; color: #9af8d1; cursor: pointer; font-size: 11px; font-weight: 600; }
  .copy-prompt-button:hover { border-color: #4d8c75; background: #1a3028; }
  .empty-state .copy-prompt-button { align-self: center; }
  .error-message { margin: 0; color: #f09b9b; font-size: 11px; line-height: 1.4; }
  .settings-actions { margin-top: auto; display: flex; justify-content: flex-end; gap: 8px; }
  .primary-button, .secondary-button, .load-button, .repair-button { padding: 7px 10px; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600; }
  .primary-button, .load-button { border: 1px solid #4d8c75; background: #1a3b30; color: #9af8d1; }
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
  .empty-state a { color: #7cf7c5; text-decoration: none; }
  .empty-state a:hover { text-decoration: underline; }
  .empty-state code { color: #a9b0b9; font-size: 10px; }
  .message { align-self: stretch; padding: 11px; border: 1px solid #24262a; border-radius: 9px; background: #151619; }
  .message.user { align-self: flex-end; max-width: 86%; background: #19221f; border-color: #293d36; }
  .message-role { margin-bottom: 6px; color: #7cf7c5; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
  .message.user .message-role { color: #9ca3af; }
  .message p { margin: 0; color: #c8cbd0; font-size: 12px; line-height: 1.5; white-space: pre-wrap; }
  pre { margin: 9px 0; padding: 10px; overflow: visible; border: 1px solid #25282d; border-radius: 6px; background: #0d0e10; color: #b9e8d7; font: 10px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }
  .thinking { color: #777d86; font-size: 11px; }
  .composer-wrap { padding: 10px 12px 12px; border-top: 1px solid #1c1d20; background: #0d0e10; }
  .composer-wrap .error-message { margin-bottom: 8px; }
  .composer { display: flex; align-items: flex-end; gap: 7px; padding: 7px; border: 1px solid #2a2d33; border-radius: 10px; background: #17191c; }
  textarea { min-height: 38px; max-height: 120px; padding: 4px; resize: none; overflow-y: hidden; scrollbar-width: thin; scrollbar-color: #34383e transparent; border: 0; background: transparent; font-size: 12px; line-height: 1.4; }
  .composer button { flex: 0 0 auto; width: 30px; height: 30px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 50%; background: transparent; color: #9af8d1; cursor: pointer; transition: color .15s ease, background .15s ease, transform .15s ease; }
  .composer button:hover:not(:disabled) { background: rgba(124, 247, 197, .1); color: #c4ffe7; transform: translateY(-1px); }
  .composer button:focus-visible { outline: 2px solid #437263; outline-offset: 1px; }
  .composer button:disabled { border: 0; background: transparent; color: #4c5158; cursor: default; }
</style>
