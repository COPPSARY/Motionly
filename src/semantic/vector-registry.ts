export const BASE_SEMANTIC_COMPONENT_TYPES = [
  'cloud',
  'database',
  'server',
  'arrow',
  'button',
  'dashboard',
  'phone',
  'browser',
  'logo',
  'chart',
  'notification',
  'cursor',
  'codeeditor',
  'website',
  'terminal',
  'pricingcard',
  'laptop',
  'editor',
  'card',
  'form',
  'chat',
  'modal',
  'navigation',
  'loader',
] as const;

export type BaseSemanticComponentType = (typeof BASE_SEMANTIC_COMPONENT_TYPES)[number];

/** ReactBits catalog names mapped to the nearest editable Motionly component recipe. */
export const REACTBITS_COMPONENT_ALIASES = {
  'animated-list': 'chat',
  'bounce-cards': 'card',
  'card-swap': 'card',
  carousel: 'card',
  'chroma-grid': 'card',
  'circular-gallery': 'card',
  counter: 'chart',
  'decay-card': 'card',
  dock: 'navigation',
  'elastic-slider': 'button',
  'flowing-menu': 'navigation',
  'fluid-glass': 'card',
  'flying-posters': 'card',
  folder: 'card',
  'glass-icons': 'navigation',
  'glass-surface': 'card',
  'gooey-nav': 'navigation',
  'infinite-menu': 'navigation',
  'infinite-scroll': 'card',
  lanyard: 'card',
  'magic-bento': 'card',
  masonry: 'card',
  'media-card': 'card',
  'metric-card': 'card',
  'model-viewer': 'card',
  'pixel-card': 'card',
  'rolling-gallery': 'card',
  'scroll-stack': 'card',
  'spotlight-card': 'card',
  stack: 'card',
  stepper: 'navigation',
  'tilted-card': 'card',
  'button-1': 'button',
  'button-2': 'button',
  'button-3': 'button',
  'button-4': 'button',
  'button-5': 'button',
  'button-6': 'button',
  'button-7': 'button',
  'button-8': 'button',
  'form-1': 'form',
  'form-2': 'form',
  'form-3': 'form',
  'form-4': 'form',
  'form-5': 'form',
  'form-6': 'form',
  'form-7': 'form',
  'form-8': 'form',
  'form-9': 'form',
  'form-10': 'form',
  'form-11': 'form',
  'form-12': 'form',
  'form-13': 'form',
  'form-14': 'form',
  'form-15': 'form',
  'form-16': 'form',
  'form-17': 'form',
  'form-18': 'form',
  'form-19': 'form',
  'form-20': 'form',
  'loader-1': 'loader',
  'loader-2': 'loader',
  'loader-3': 'loader',
  'loader-4': 'loader',
  'loader-5': 'loader',
  'loader-6': 'loader',
  'loader-7': 'loader',
  'loader-8': 'loader',
  'loader-9': 'loader',
} as const satisfies Record<string, BaseSemanticComponentType>;

export type ReactBitsComponentType = keyof typeof REACTBITS_COMPONENT_ALIASES;
export type SemanticComponentType = BaseSemanticComponentType | ReactBitsComponentType;
export const SEMANTIC_COMPONENT_TYPES: readonly SemanticComponentType[] = [
  ...BASE_SEMANTIC_COMPONENT_TYPES,
  ...(Object.keys(REACTBITS_COMPONENT_ALIASES) as ReactBitsComponentType[]),
];
export const SPECIALIZED_SEMANTIC_COMPONENT_TYPES = [
  'tilted-card',
  'magic-bento',
  'fluid-glass',
  'spotlight-card',
  'metric-card',
  'media-card',
] as const satisfies readonly ReactBitsComponentType[];
export const PUBLISHED_SEMANTIC_COMPONENT_TYPES: readonly SemanticComponentType[] = [
  ...BASE_SEMANTIC_COMPONENT_TYPES,
  ...SPECIALIZED_SEMANTIC_COMPONENT_TYPES,
];

export const VECTOR_PROVIDERS = ['phosphor', 'lucide', 'heroicons', 'tabler', 'motionly'] as const;

export type VectorProvider = (typeof VECTOR_PROVIDERS)[number];
export type VectorStyle = 'filled' | 'outline';
export type SemanticComponentCategory =
  | 'layout'
  | 'input'
  | 'feedback'
  | 'communication'
  | 'data'
  | 'media'
  | 'mobile'
  | 'infrastructure';

export interface SemanticComponentMetadata {
  category: SemanticComponentCategory;
  purpose: string;
  useCases: readonly string[];
  inputs: readonly string[];
  interaction: string;
  recommendedSpacing: number;
  variants: readonly string[];
  motionPresets: readonly string[];
  accessibility: string;
  responsive: string;
}

export interface SemanticVectorDefinition {
  type: SemanticComponentType;
  provider: VectorProvider;
  icon: string;
  source: string;
  license: 'MIT' | 'ISC' | 'Motionly';
  style: VectorStyle;
  svg: string;
  width: number;
  height: number;
  defaultBehavior: string;
  capabilities: readonly string[];
  layers: readonly string[];
}

const baseDefinitions: Record<BaseSemanticComponentType, SemanticVectorDefinition> = {
  cloud: {
    type: 'cloud',
    provider: 'phosphor',
    icon: 'cloud',
    source: 'https://github.com/phosphor-icons/core/blob/main/assets/regular/cloud.svg',
    license: 'MIT',
    style: 'filled',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M160,40A88.09,88.09,0,0,0,81.29,88.67,64,64,0,1,0,72,216h88a88,88,0,0,0,0-176Zm0,160H72a48,48,0,0,1,0-96c1.1,0,2.2,0,3.29.11A88,88,0,0,0,72,128a8,8,0,0,0,16,0,72,72,0,1,1,72,72Z"/></svg>',
    width: 256,
    height: 176,
    defaultBehavior: 'premiumReveal float',
    capabilities: ['float', 'pulse', 'glow', 'receiveData', 'sendData', 'connect'],
    layers: ['glyph', 'glow'],
  },
  database: {
    type: 'database',
    provider: 'lucide',
    icon: 'database',
    source: 'https://github.com/lucide-icons/lucide/blob/main/icons/database.svg',
    license: 'ISC',
    style: 'outline',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>',
    width: 180,
    height: 180,
    defaultBehavior: 'stackReveal pulse',
    capabilities: ['stackReveal', 'pulse', 'glow', 'receiveData', 'sendData', 'connect'],
    layers: ['stack', 'activity'],
  },
  server: {
    type: 'server',
    provider: 'lucide',
    icon: 'server',
    source: 'https://github.com/lucide-icons/lucide/blob/main/icons/server.svg',
    license: 'ISC',
    style: 'outline',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></svg>',
    width: 180,
    height: 180,
    defaultBehavior: 'premiumReveal',
    capabilities: ['stackReveal', 'pulse', 'glow', 'receiveData', 'sendData', 'connect'],
    layers: ['chassis', 'status'],
  },
  arrow: {
    type: 'arrow',
    provider: 'tabler',
    icon: 'arrow-right',
    source: 'https://github.com/tabler/tabler-icons/blob/main/icons/outline/arrow-right.svg',
    license: 'MIT',
    style: 'outline',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M13 18l6-6"/><path d="M13 6l6 6"/></svg>',
    width: 180,
    height: 120,
    defaultBehavior: 'draw',
    capabilities: ['draw', 'travel', 'connect', 'followPath', 'guideAttention'],
    layers: ['shaft', 'head'],
  },
  phone: {
    type: 'phone',
    provider: 'heroicons',
    icon: 'device-phone-mobile',
    source:
      'https://github.com/tailwindlabs/heroicons/blob/master/optimized/24/outline/device-phone-mobile.svg',
    license: 'MIT',
    style: 'outline',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"/></svg>',
    width: 150,
    height: 260,
    defaultBehavior: 'screenReveal',
    capabilities: ['screenReveal', 'notification', 'tap', 'glow'],
    layers: ['frame', 'screen', 'status'],
  },
  browser: {
    type: 'browser',
    provider: 'heroicons',
    icon: 'window',
    source: 'https://github.com/tailwindlabs/heroicons/blob/master/optimized/24/outline/window.svg',
    license: 'MIT',
    style: 'outline',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8.25V18a2.25 2.25 0 0 0 2.25 2.25h13.5A2.25 2.25 0 0 0 21 18V8.25m-18 0V6a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 6v2.25m-18 0h18M5.25 6h.008v.008H5.25V6ZM7.5 6h.008v.008H7.5V6Zm2.25 0h.008v.008H9.75V6Z"/></svg>',
    width: 360,
    height: 240,
    defaultBehavior: 'screenReveal',
    capabilities: ['screenReveal', 'highlight', 'cursor', 'connect'],
    layers: ['chrome', 'viewport', 'controls'],
  },
  dashboard: {
    type: 'dashboard',
    provider: 'tabler',
    icon: 'dashboard',
    source: 'https://github.com/tabler/tabler-icons/blob/main/icons/outline/dashboard.svg',
    license: 'MIT',
    style: 'outline',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a2 2 0 1 0 4 0a2 2 0 1 0-4 0"/><path d="M13.45 11.55l2.05-2.05"/><path d="M6.4 20a9 9 0 1 1 11.2 0l-11.2 0"/></svg>',
    width: 300,
    height: 220,
    defaultBehavior: 'dashboardReveal',
    capabilities: ['screenReveal', 'cardStagger', 'chartGrowth', 'count', 'highlight'],
    layers: ['frame', 'cards', 'chart', 'metric', 'highlight'],
  },
  button: {
    type: 'button',
    provider: 'motionly',
    icon: 'action-button',
    source: 'Motionly native semantic vector',
    license: 'Motionly',
    style: 'filled',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 72" fill="currentColor"><path d="M36 0h168a36 36 0 0 1 0 72H36A36 36 0 0 1 36 0Z"/><path fill="#ffffff" d="M112 22l18 14-18 14v-9H92V31h20v-9Z"/></svg>',
    width: 240,
    height: 72,
    defaultBehavior: 'buttonPop',
    capabilities: ['popIn', 'hoverLift', 'clickCompression', 'attentionGlow'],
    layers: ['surface', 'label', 'highlight'],
  },
  logo: {
    type: 'logo',
    provider: 'motionly',
    icon: 'brand-mark',
    source: 'Motionly native fallback; set source to use an imported brand SVG',
    license: 'Motionly',
    style: 'outline',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"><path d="M60 8l44 26v52L60 112 16 86V34L60 8Z"/><path d="M16 34l44 28 44-28M60 62v50"/></svg>',
    width: 200,
    height: 200,
    defaultBehavior: 'draw',
    capabilities: ['draw', 'reveal', 'glow', 'morph'],
    layers: ['mark', 'glow'],
  },
  chart: {
    type: 'chart',
    provider: 'lucide',
    icon: 'chart-line',
    source: 'https://github.com/lucide-icons/lucide/blob/main/icons/chart-line.svg',
    license: 'ISC',
    style: 'outline',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m19 9-5 5-4-4-3 3"/></svg>',
    width: 520,
    height: 322,
    defaultBehavior: 'chartGrowth',
    capabilities: ['chartGrowth', 'count', 'highlight', 'connect'],
    layers: ['panel', 'axis', 'bars', 'line', 'metric'],
  },
  notification: {
    type: 'notification',
    provider: 'lucide',
    icon: 'bell',
    source: 'https://github.com/lucide-icons/lucide/blob/main/icons/bell.svg',
    license: 'ISC',
    style: 'outline',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
    width: 420,
    height: 110,
    defaultBehavior: 'popIn',
    capabilities: ['popIn', 'reactsTo', 'glow', 'dismiss'],
    layers: ['card', 'stripe', 'icon', 'copy'],
  },
  cursor: {
    type: 'cursor',
    provider: 'lucide',
    icon: 'mouse-pointer',
    source: 'https://github.com/lucide-icons/lucide/blob/main/icons/mouse-pointer.svg',
    license: 'ISC',
    style: 'outline',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="m13 13 6 6"/></svg>',
    width: 44,
    height: 44,
    defaultBehavior: 'moveTo',
    capabilities: ['moveTo', 'click', 'ripple'],
    layers: ['pointer', 'ripple'],
  },
  codeeditor: {
    type: 'codeeditor',
    provider: 'lucide',
    icon: 'code',
    source: 'https://github.com/lucide-icons/lucide/blob/main/icons/code.svg',
    license: 'ISC',
    style: 'outline',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    width: 680,
    height: 422,
    defaultBehavior: 'typeIn',
    capabilities: ['typeIn', 'screenReveal', 'highlight', 'connect'],
    layers: ['frame', 'titlebar', 'lines', 'status'],
  },
  website: {
    type: 'website',
    provider: 'lucide',
    icon: 'globe',
    source: 'https://github.com/lucide-icons/lucide/blob/main/icons/globe.svg',
    license: 'ISC',
    style: 'outline',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>',
    width: 720,
    height: 460,
    defaultBehavior: 'screenReveal',
    capabilities: ['screenReveal', 'highlight', 'cursor', 'connect'],
    layers: ['frame', 'nav', 'hero', 'cta', 'banner'],
  },
  terminal: {
    type: 'terminal',
    provider: 'lucide',
    icon: 'terminal',
    source: 'https://github.com/lucide-icons/lucide/blob/main/icons/terminal.svg',
    license: 'ISC',
    style: 'outline',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/></svg>',
    width: 640,
    height: 384,
    defaultBehavior: 'typeIn',
    capabilities: ['typeIn', 'progress', 'connect'],
    layers: ['frame', 'titlebar', 'prompt', 'progress', 'status'],
  },
  pricingcard: {
    type: 'pricingcard',
    provider: 'lucide',
    icon: 'gem',
    source: 'https://github.com/lucide-icons/lucide/blob/main/icons/gem.svg',
    license: 'ISC',
    style: 'outline',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/></svg>',
    width: 380,
    height: 470,
    defaultBehavior: 'popIn',
    capabilities: ['popIn', 'count', 'highlight'],
    layers: ['card', 'plan', 'price', 'features', 'cta'],
  },
  laptop: {
    type: 'laptop',
    provider: 'lucide',
    icon: 'laptop',
    source: 'https://github.com/lucide-icons/lucide/blob/main/icons/laptop.svg',
    license: 'ISC',
    style: 'outline',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/></svg>',
    width: 760,
    height: 500,
    defaultBehavior: 'screenReveal',
    capabilities: ['screenReveal', 'highlight', 'cursor', 'connect'],
    layers: ['lid', 'screen', 'nav', 'hero', 'cta', 'base'],
  },
  editor: {
    type: 'editor',
    provider: 'motionly',
    icon: 'motionly-editor',
    source: 'Motionly native workspace component',
    license: 'Motionly',
    style: 'outline',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="M2 8h20"/><path d="M6 12h6"/><path d="M6 16h10"/></svg>',
    width: 1200,
    height: 672,
    defaultBehavior: 'screenReveal',
    capabilities: ['screenReveal', 'typeIn', 'cardStagger', 'chartGrowth', 'count', 'highlight'],
    layers: ['frame', 'rail', 'topbar', 'canvas', 'timeline', 'panel', 'draft'],
  },
  card: {
    type: 'card',
    provider: 'motionly',
    icon: 'ui-card',
    source: 'Motionly native semantic component inspired by spotlight-card interactions',
    license: 'Motionly',
    style: 'filled',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 9h10M7 13h7"/></svg>',
    width: 420,
    height: 280,
    defaultBehavior: 'cardReveal',
    capabilities: ['cardReveal', 'hoverLift', 'spotlight', 'glow'],
    layers: ['surface', 'eyebrow', 'headline', 'detail', 'cta', 'spotlight'],
  },
  form: {
    type: 'form',
    provider: 'motionly',
    icon: 'ui-form',
    source: 'Motionly native semantic form',
    license: 'Motionly',
    style: 'filled',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
    width: 460,
    height: 520,
    defaultBehavior: 'formReveal',
    capabilities: ['formReveal', 'focusField', 'submit', 'validation'],
    layers: ['panel', 'title', 'detail', 'field0', 'field1', 'submit'],
  },
  chat: {
    type: 'chat',
    provider: 'motionly',
    icon: 'ui-chat',
    source: 'Motionly native semantic conversation',
    license: 'Motionly',
    style: 'filled',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>',
    width: 620,
    height: 560,
    defaultBehavior: 'messageCascade',
    capabilities: ['messageCascade', 'typing', 'autoScroll', 'reactsTo'],
    layers: ['frame', 'header', 'avatar', 'bubble0', 'bubble1', 'bubble2', 'typing'],
  },
  modal: {
    type: 'modal',
    provider: 'motionly',
    icon: 'ui-modal',
    source: 'Motionly native semantic dialog',
    license: 'Motionly',
    style: 'filled',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18M16 14h2"/></svg>',
    width: 520,
    height: 320,
    defaultBehavior: 'modalReveal',
    capabilities: ['modalReveal', 'backdrop', 'focus', 'dismiss'],
    layers: ['backdrop', 'panel', 'title', 'detail', 'cancel', 'confirm'],
  },
  navigation: {
    type: 'navigation',
    provider: 'motionly',
    icon: 'ui-navigation',
    source: 'Motionly native semantic navigation inspired by dock interactions',
    license: 'Motionly',
    style: 'filled',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
    width: 760,
    height: 88,
    defaultBehavior: 'dockReveal',
    capabilities: ['dockReveal', 'activeItem', 'hoverLift', 'mobileNavigation'],
    layers: ['bar', 'brand', 'active', 'item0', 'item1', 'item2', 'item3'],
  },
  loader: {
    type: 'loader',
    provider: 'motionly',
    icon: 'ui-loader',
    source: 'Motionly native deterministic loader',
    license: 'Motionly',
    style: 'outline',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a9 9 0 1 1-9 9"/><path d="M3 3v6h6"/></svg>',
    width: 180,
    height: 180,
    defaultBehavior: 'spin',
    capabilities: ['spin', 'pulse', 'progress', 'skeleton'],
    layers: ['track', 'progress', 'label'],
  },
};

const baseMetadata: Record<BaseSemanticComponentType, SemanticComponentMetadata> = {
  cloud: meta(
    'infrastructure',
    'Cloud service node.',
    ['cloud architecture', 'data pipeline'],
    ['label'],
    'Receives and sends data.'
  ),
  database: meta(
    'infrastructure',
    'Persistent data store.',
    ['database', 'storage', 'data pipeline'],
    ['label'],
    'Receives, stores, and sends data.'
  ),
  server: meta(
    'infrastructure',
    'Application server node.',
    ['server', 'api', 'backend architecture'],
    ['label'],
    'Activates and exchanges data.'
  ),
  arrow: meta(
    'infrastructure',
    'Directional relationship.',
    ['flow', 'connection', 'process direction'],
    ['label'],
    'Draws between subjects.'
  ),
  button: meta(
    'input',
    'Primary interactive action.',
    ['button', 'call to action', 'submit control'],
    ['label'],
    'Hover, press, ripple, and click.'
  ),
  dashboard: meta(
    'data',
    'Complete analytics dashboard.',
    ['dashboard', 'analytics', 'productivity workspace', 'kpi overview'],
    ['label', 'values', 'labels'],
    'Cards stagger, metrics count, and charts draw.'
  ),
  phone: meta(
    'mobile',
    'Mobile device interface.',
    ['mobile app', 'phone screen', 'app inbox'],
    ['label', 'values'],
    'Screen and rows reveal in sequence.'
  ),
  browser: meta(
    'layout',
    'Browser-based product screen.',
    ['website', 'browser', 'web app'],
    ['url', 'headline', 'cta'],
    'Chrome and page content reveal.'
  ),
  logo: meta(
    'media',
    'Brand mark.',
    ['logo', 'brand reveal', 'identity'],
    ['source', 'label'],
    'Draws or reveals the real mark.'
  ),
  chart: meta(
    'data',
    'Animated metric chart.',
    ['chart', 'graph', 'data visualization', 'growth'],
    ['label', 'countTo', 'values'],
    'Counts a metric and grows the series.'
  ),
  notification: meta(
    'feedback',
    'Notification or toast card.',
    [
      'notification',
      'notifications',
      'notification stack',
      'toast',
      'alert',
      'success banner',
      'error banner',
    ],
    ['label', 'detail'],
    'Slides, pushes, reacts, and dismisses.',
    ['default', 'success', 'warning', 'error']
  ),
  cursor: meta(
    'input',
    'Visible interaction pointer.',
    ['cursor', 'click', 'product walkthrough'],
    ['clicks', 'clickAt'],
    'Travels, presses, and ripples.'
  ),
  codeeditor: meta(
    'layout',
    'Developer code workspace.',
    ['code editor', 'developer workflow', 'ide'],
    ['label', 'detail', 'values'],
    'Types code and reports status.'
  ),
  website: meta(
    'layout',
    'Structured marketing website.',
    ['landing page', 'hero section', 'website'],
    ['headline', 'cta', 'label'],
    'Navigation, hero, and call to action reveal.'
  ),
  terminal: meta(
    'layout',
    'Command-line workflow.',
    ['terminal', 'cli', 'developer workflow'],
    ['label', 'detail'],
    'Types a command and advances progress.'
  ),
  pricingcard: meta(
    'layout',
    'Pricing plan card.',
    ['pricing table', 'pricing plan', 'subscription'],
    ['label', 'countTo', 'values', 'cta'],
    'Plan, price, features, and CTA cascade.',
    ['default', 'featured']
  ),
  laptop: meta(
    'layout',
    'Laptop product frame.',
    ['desktop app', 'laptop', 'product demo'],
    ['headline', 'cta'],
    'Device and populated screen reveal.'
  ),
  editor: meta(
    'layout',
    'Motionly editing workspace.',
    ['motion editor', 'animation editor', 'creative workflow'],
    ['label', 'detail', 'headline', 'values', 'cta'],
    'Workspace parts assemble and animate.'
  ),
  card: meta(
    'layout',
    'Reusable content or feature card.',
    ['card', 'cards', 'feature card', 'stats card', 'kpi widget'],
    ['label', 'headline', 'detail', 'cta'],
    'Rises, elevates, and sweeps a spotlight.',
    ['default', 'outlined', 'featured']
  ),
  form: meta(
    'input',
    'Complete editable form panel.',
    ['form', 'login screen', 'sign in', 'signup', 'search form', 'password input'],
    ['label', 'detail', 'labels', 'values', 'cta'],
    'Fields focus in order and the submit action settles.',
    ['login', 'signup', 'search']
  ),
  chat: meta(
    'communication',
    'Complete chat conversation.',
    ['chat', 'discord chat', 'conversation', 'assistant response', 'ai chat'],
    ['label', 'values', 'labels'],
    'Messages cascade, typing dots pulse, and content scrolls.',
    ['direct', 'group', 'assistant']
  ),
  modal: meta(
    'feedback',
    'Focused dialog over a backdrop.',
    ['modal', 'dialog', 'confirmation', 'command palette'],
    ['label', 'detail', 'cta'],
    'Backdrop appears, panel scales up, and focus moves to the action.',
    ['default', 'success', 'warning', 'error']
  ),
  navigation: meta(
    'mobile',
    'Responsive navigation bar or dock.',
    ['navigation bar', 'mobile navigation', 'bottom navigation', 'dock', 'sidebar navigation'],
    ['label', 'labels'],
    'Items cascade and the active item lifts.',
    ['desktop', 'mobile', 'bottom', 'dock']
  ),
  loader: meta(
    'feedback',
    'Loading and progress indicator.',
    ['loader', 'loading spinner', 'progress', 'skeleton loader'],
    ['label', 'countTo'],
    'Spins, pulses, or fills deterministically.',
    ['spinner', 'dots', 'progress', 'skeleton']
  ),
};

function meta(
  category: SemanticComponentCategory,
  purpose: string,
  useCases: readonly string[],
  inputs: readonly string[],
  interaction: string,
  variants: readonly string[] = ['default']
): SemanticComponentMetadata {
  return {
    category,
    purpose,
    useCases,
    inputs,
    interaction,
    recommendedSpacing: category === 'mobile' || category === 'input' ? 16 : 24,
    variants,
    motionPresets: ['minimal', 'smooth', 'spring', 'premium'],
    accessibility: 'Preserve readable contrast, labels, focus order, and reduced-motion fallbacks.',
    responsive: 'Scales from its authored width and preserves touch-sized interactive targets.',
  };
}

const definitions = {
  ...baseDefinitions,
  ...Object.fromEntries(
    Object.entries(REACTBITS_COMPONENT_ALIASES).map(([alias, target]) => [
      alias,
      {
        ...baseDefinitions[target],
        type: alias,
        icon: alias,
        source: `ReactBits ${alias} concept adapted to Motionly's deterministic renderer`,
        license: 'Motionly',
      },
    ])
  ),
  'tilted-card': {
    ...baseDefinitions.card,
    type: 'tilted-card',
    icon: 'tilted-card',
    source: 'Motionly native tilted editorial card',
    layers: ['poster', 'stripe', 'index', 'eyebrow', 'headline', 'detail'],
  },
  'magic-bento': {
    ...baseDefinitions.card,
    type: 'magic-bento',
    icon: 'magic-bento',
    source: 'Motionly native asymmetric bento card',
    layers: [
      'surface',
      'mainTile',
      'topTile',
      'bottomTile',
      'eyebrow',
      'headline',
      'detail',
      'stat',
      'status',
    ],
  },
  'fluid-glass': {
    ...baseDefinitions.card,
    type: 'fluid-glass',
    icon: 'fluid-glass',
    source: 'Motionly native layered glass card',
    layers: [
      'backplate',
      'surface',
      'rule',
      'eyebrow',
      'headline',
      'detail',
      'chip0',
      'chip1',
      'chip2',
    ],
  },
  'spotlight-card': {
    ...baseDefinitions.card,
    type: 'spotlight-card',
    icon: 'spotlight-card',
    source: 'Motionly native hard-light focus card',
    layers: ['surface', 'sun', 'eyebrow', 'headline', 'detail', 'footer'],
  },
  'metric-card': {
    ...baseDefinitions.card,
    type: 'metric-card',
    icon: 'metric-card',
    source: 'Motionly native metric card',
    height: 260,
    defaultBehavior: 'count',
    capabilities: ['cardReveal', 'count', 'drawPath'],
    layers: ['surface', 'eyebrow', 'value', 'delta', 'detail', 'sparkline', 'baseline'],
  },
  'media-card': {
    ...baseDefinitions.card,
    type: 'media-card',
    icon: 'media-card',
    source: 'Motionly native image-backed card',
    height: 302,
    defaultBehavior: 'cardReveal',
    capabilities: ['cardReveal', 'screenReveal'],
    layers: ['surface', 'media', 'eyebrow', 'headline', 'detail'],
  },
} as unknown as Record<SemanticComponentType, SemanticVectorDefinition>;

const metadata = {
  ...baseMetadata,
  ...Object.fromEntries(
    Object.entries(REACTBITS_COMPONENT_ALIASES).map(([alias, target]) => {
      const base = baseMetadata[target];
      return [
        alias,
        {
          ...base,
          purpose: `ReactBits ${alias} pattern. ${base.purpose}`,
          useCases: [alias, ...base.useCases],
        },
      ];
    })
  ),
  'tilted-card': {
    ...baseMetadata.card,
    purpose: 'Tilted editorial feature card with a numbered poster hierarchy.',
    useCases: ['tilted card', 'editorial feature', 'opening promise'],
    interaction: 'The poster settles, then its index and accent rail answer in sequence.',
  },
  'magic-bento': {
    ...baseMetadata.card,
    purpose: 'Asymmetric bento composition with one focal tile and two live modules.',
    useCases: ['magic bento', 'feature summary', 'metric card'],
    interaction: 'The focal tile leads while the stat and status modules follow.',
  },
  'fluid-glass': {
    ...baseMetadata.card,
    purpose: 'Layered translucent material card with a refracted edge treatment.',
    useCases: ['fluid glass', 'material study', 'premium feature card'],
    interaction: 'The backplate offsets, the glass surface settles, and side chips cascade.',
  },
  'spotlight-card': {
    ...baseMetadata.card,
    purpose: 'Dark focus card with a hard moving light and anchored footer.',
    useCases: ['spotlight card', 'feature focus', 'high-contrast callout'],
    interaction: 'A hard light travels across the card before the copy and footer settle.',
  },
  'metric-card': {
    ...baseMetadata.card,
    purpose: 'Single-stat card with count-up value and a drawn trend line.',
    useCases: ['metric card', 'KPI', 'dashboard statistic'],
    inputs: ['label', 'detail', 'countTo', 'cta'],
    interaction: 'The value counts up while its trend draws across the baseline.',
  },
  'media-card': {
    ...baseMetadata.card,
    purpose: 'Image-backed editorial card with a compact text hierarchy.',
    useCases: ['media card', 'product screenshot', 'portfolio tile'],
    inputs: ['source', 'label', 'headline', 'detail'],
    interaction: 'The media settles first, followed by the caption hierarchy.',
  },
} as unknown as Record<SemanticComponentType, SemanticComponentMetadata>;

export function isSemanticComponentType(value: string): value is SemanticComponentType {
  return (SEMANTIC_COMPONENT_TYPES as readonly string[]).includes(value);
}

export function vectorDefinition(type: SemanticComponentType): SemanticVectorDefinition {
  return definitions[type];
}

export function semanticVectorDefinitions(): readonly SemanticVectorDefinition[] {
  return Object.values(definitions);
}

/** Registry entries must have their own visual builder, not only a compatibility alias. */
export function publishedSemanticVectorDefinitions(): readonly SemanticVectorDefinition[] {
  return PUBLISHED_SEMANTIC_COMPONENT_TYPES.map((type) => definitions[type]);
}

export function semanticComponentMetadata(type: SemanticComponentType): SemanticComponentMetadata {
  return metadata[type];
}

export function svgDataUri(source: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
}
