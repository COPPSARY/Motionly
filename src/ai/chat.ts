import type { Asset } from '../types/scene';
import { assetFilename } from '../assets/asset-resolution';

export const AI_SETTINGS_KEY = 'motionly.ai.settings.v1';
export const AI_HISTORY_KEY = 'motionly.ai.history.v1';

export type AiProvider =
  'openai' | 'anthropic' | 'openrouter' | 'gemini' | 'huggingface' | 'custom';

export interface AiSettings {
  apiKey: string;
  provider: AiProvider;
  baseUrl: string;
  model: string;
}

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  motion?: string;
}

const SYSTEM_PROMPT = `Context:
You are Motionly Assistant inside a browser-based motion graphics editor. You cannot open repository files or links. The syntax contract below is the authoritative subset of AGENTS.md and the write-motionly skill. Motionly saves editable projects as plain .motion source.

Objective:
Given the request, conversation, current project, and available assets, plan distinct shots and return one complete valid .motion project. When refining, update the full current project instead of returning a fragment. Use one focal subject per shot, deliberate exits, and restrained motion. Avoid accidental overlap, repeated fade-only scenes, and constant camera drift.

Mandatory syntax contract:
- A project has one canvas block: canvas { ... }. Optional camera uses camera { ... }.
- Import assets exactly as: import "path" as alias
- Render an imported asset with its alias directly: alias { ... }
- Text is: text name { ... }. Other built-in elements are only: overlay name { ... } and effect name { ... }.
- NEVER write image name { ... }, asset name { ... }, video name { ... }, scene name { ... }, group name { ... }, rect name { ... }, or layer name { ... }. Those block types do not exist.
- Explicit animations use a top-level animate TARGET block with nested from and to blocks, followed by duration, delay, and easing properties.
- Put every block body on multiple lines and every property on its own line. Do not use JSON, CSS syntax, colons, semicolons, commas, arrays, or equals signs.
- Quote text values and import paths. Names and aliases are single words without spaces.
- Use size, never fontSize. Explicit animate blocks use easing. Preset option lists use ease.
- Valid common properties: value, center, cover, x, y, width, height, scale, rotation, opacity, blur, brightness, contrast, saturation, hue, grayscale, sepia, invert, mask, maskInvert, maskVisible, shadow, size, weight, tracking, color, fill, layer, animation, textAnimation, backgroundEffect.
- Valid layers: background, hero, supporting, content, details, text, effects.
- Preserve asset aspect ratio by setting width OR height, not both.
- Use only paths listed under Available local assets. Do not invent imports or placeholder paths.
- Paths beginning motionly-local: are uploaded browser assets. Copy those paths and aliases exactly; Motionly restores their encoded bytes when loading.
- Presets are string property values, for example: animation "maskReveal(delay 1s duration 800ms direction down exitAt 5s exitDuration 450ms ease power3.out)"
- Text presets: keynoteText, wordReveal, charReveal, splitReveal, blurReveal, fadeUp, slideIn, scaleText, typewriter, maskReveal, gradientReveal.
- Object and transition presets: softReveal, maskReveal, dynamicSlide, shapeWipe, irisWipe, drawSVG, sceneExit, scaleReveal. Use drawSVG only for simple stroked SVG artwork.
- Camera presets go inside camera as cameraAnimation. Prefer slowPush, pan, pull, or one speedZoom at a meaningful transition.
- Keyframes must be percentage blocks nested inside a keyframes block, which is nested inside animate TARGET.
- Project audio is audio "path" { start 0s }. Keep it on the bottom audio track and preserve its start offset.
- Persistent timeline rows use track NAME { ... }; imported media clips use clip ALIAS { track NAME start 0s duration 5s trimIn 0s trimOut 0s }.
- Every visual track behaves as a simple layer: content types do not restrict placement, gaps/overlaps are allowed, and edits do not ripple neighboring clips.
- Preserve existing track, start, duration, mask, and keyframe data unless the requested change requires editing it.

Minimal valid example:
canvas {
  size 1920x1080
  fps 60
  duration 5s
  background #050608
}

import "/assets/logo.svg" as logo

logo {
  center
  layer hero
  width 240
  opacity 0
}

text title {
  value "Make it move."
  center
  layer text
  y 180
  size 72
  color #ffffff
  opacity 1
  textAnimation "keynoteText(split words stagger 80ms duration 750ms delay 1s ease power3.out)"
}

animate logo {
  from {
    opacity 0
    y 80
  }
  to {
    opacity 1
    y 0
  }
  duration 800ms
  delay 0s
  easing power3.out
}

Before answering, silently verify balanced braces, one property per line, every imported visual uses alias { ... }, every animate target exists, no forbidden block keyword appears, required copy is exact, timing covers the complete canvas, and tracks/keyframes survive as editable source.

Style and tone:
Concise, clean, helpful, and collaborative for users who may not know .motion syntax. Prefer power3.out and entrances around 650ms to 1s.

Response format:
Give one short explanation, then exactly one fenced \`\`\`motion code block containing the complete project. Do not emit any other fenced blocks.`;

export function detectProvider(key: string): Exclude<AiProvider, 'custom'> | null {
  const value = key.trim();
  if (value.startsWith('sk-ant-')) return 'anthropic';
  if (value.startsWith('sk-or-')) return 'openrouter';
  if (value.startsWith('AIza') || value.startsWith('AQ.')) return 'gemini';
  if (value.startsWith('hf_')) return 'huggingface';
  if (value.startsWith('sk-proj-') || value.startsWith('sk-')) return 'openai';
  return null;
}

export function providerLabel(provider: AiProvider): string {
  return {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    openrouter: 'OpenRouter',
    gemini: 'Google Gemini',
    huggingface: 'Hugging Face',
    custom: 'Custom endpoint',
  }[provider];
}

export function extractMotion(source: string): string | undefined {
  return /```motion\s*([\s\S]*?)```/i.exec(source)?.[1]?.trim() || undefined;
}

export function maskEmbeddedAssetPaths(source: string, assets: Asset[]): string {
  return replaceEmbeddedAssetPaths(
    source,
    assets,
    (asset) => `motionly-local:${encodeURIComponent(assetFilename(asset.path) || asset.name)}`
  );
}

export function restoreEmbeddedAssetPaths(source: string, assets: Asset[]): string {
  for (const asset of assets.filter((item) => item.path.startsWith('data:'))) {
    const references = new Set([
      asset.name,
      encodeURIComponent(assetFilename(asset.path) || asset.name),
    ]);
    for (const reference of references) {
      source = source.replaceAll(`"motionly-local:${reference}"`, `"${asset.path}"`);
    }
  }
  return replaceEmbeddedAssetPaths(source, assets, (asset) => asset.path);
}

function replaceEmbeddedAssetPaths(
  source: string,
  assets: Asset[],
  pathFor: (asset: Asset) => string
): string {
  for (const asset of assets.filter((item) => item.path.startsWith('data:'))) {
    const name = asset.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    source = source.replace(
      new RegExp(`(import\\s+)"[^"\\n]*"(\\s+as\\s+${name}(?=\\s|$))`, 'g'),
      (_, start: string, end: string) => `${start}"${pathFor(asset)}"${end}`
    );
  }
  return source;
}

export function resolveChatEndpoint(baseUrl: string): string {
  const url = new URL(baseUrl);
  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    throw new Error('Base URL must use http or https.');
  return /\/chat\/completions\/?$/.test(url.pathname)
    ? url.href.replace(/\/$/, '')
    : `${url.href.replace(/\/$/, '')}/chat/completions`;
}

export async function requestAssistant(
  settings: AiSettings,
  messages: AiMessage[],
  project: string,
  assets: Asset[],
  knowledge = ''
): Promise<string> {
  const context = `${SYSTEM_PROMPT}\n\nCurrent project:\n\`\`\`motion\n${maskEmbeddedAssetPaths(project, assets)}\n\`\`\`\n\nAvailable local assets:\n${
    assets.length
      ? assets
          .map(
            (asset) =>
              `- ${asset.name}: ${asset.path.startsWith('data:') ? `motionly-local:${asset.name}` : asset.path} (${asset.type})`
          )
          .join('\n')
      : '- None'
  }${knowledge.trim() ? `\n\n${knowledge.trim()}` : ''}`;
  return settings.provider === 'anthropic'
    ? requestAnthropic(settings, messages, context)
    : requestOpenAiCompatible(settings, messages, context);
}

async function requestOpenAiCompatible(
  settings: AiSettings,
  messages: AiMessage[],
  system: string
): Promise<string> {
  const endpoints: Record<Exclude<AiProvider, 'anthropic' | 'custom'>, string> = {
    openai: 'https://api.openai.com/v1/chat/completions',
    openrouter: 'https://openrouter.ai/api/v1/chat/completions',
    gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    huggingface: 'https://router.huggingface.co/v1/chat/completions',
  };
  const models: Record<Exclude<AiProvider, 'anthropic' | 'custom'>, string> = {
    openai: 'gpt-5.4-mini',
    openrouter: 'openrouter/auto',
    gemini: 'gemini-2.5-flash',
    huggingface: 'openai/gpt-oss-120b:fastest',
  };
  const provider =
    settings.provider === 'openai' ||
    settings.provider === 'openrouter' ||
    settings.provider === 'gemini' ||
    settings.provider === 'huggingface'
      ? settings.provider
      : null;
  const endpoint = provider ? endpoints[provider] : resolveChatEndpoint(settings.baseUrl);
  const model = settings.model.trim() || (provider ? models[provider] : '');
  const request: RequestInit = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json',
      ...(settings.provider === 'openrouter' ? { 'X-OpenRouter-Title': 'Motionly' } : {}),
    },
    body: JSON.stringify({
      ...(model ? { model } : {}),
      messages: [
        { role: 'system', content: system },
        ...messages.map(({ role, content }) => ({ role, content })),
      ],
    }),
  };
  let response = await fetch(endpoint, request);
  if (settings.provider === 'gemini' && response.status === 503) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    response = await fetch(endpoint, request);
  }
  const raw = await response.text();
  let body: {
    error?: { message?: string } | string;
    message?: string;
    choices?: Array<{ message?: { content?: string } }>;
  } = {};
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    body.message = raw;
  }
  if (!response.ok) {
    const fallback =
      settings.provider === 'gemini' && response.status === 503
        ? 'Google Gemini is temporarily unavailable (503). Try again shortly or switch providers.'
        : `Provider request failed (${response.status}).`;
    const detail = typeof body.error === 'string' ? body.error : body.error?.message;
    throw new Error(detail || body.message || fallback);
  }
  const content = body.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('The provider returned an empty response.');
  return content;
}

async function requestAnthropic(
  settings: AiSettings,
  messages: AiMessage[],
  system: string
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': settings.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.model.trim() || 'claude-sonnet-4-6',
      max_tokens: 8192,
      system,
      messages: messages.map(({ role, content }) => ({ role, content })),
    }),
  });
  const body = (await response.json()) as {
    error?: { message?: string };
    content?: Array<{ type?: string; text?: string }>;
  };
  if (!response.ok)
    throw new Error(body.error?.message || `Anthropic request failed (${response.status}).`);
  const content = body.content
    ?.filter((part) => part.type === 'text')
    .map((part) => part.text ?? '')
    .join('\n')
    .trim();
  if (!content) throw new Error('Anthropic returned an empty response.');
  return content;
}
