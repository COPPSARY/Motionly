export interface PresetCatalogEntry {
  name: string;
  title: string;
  description: string;
  tags: readonly string[];
  width: number;
  height: number;
  duration: number;
  projectPath: string;
  previewPath: string;
  sourceDirectory: string;
}

export const PRESET_CATALOG: readonly PresetCatalogEntry[] = [
  {
    name: 'motionly',
    title: 'Motionly',
    description:
      'A 43.94-second editorial SaaS launch film with agent handoff, pixel-matched editor reconstruction, a full product demo, and precision export.',
    tags: ['product', 'editor', 'launch', 'storyboard', 'scenes', 'saas'],
    width: 1920,
    height: 1080,
    duration: 43.94,
    projectPath: 'preset/motionly/motionly.motion',
    previewPath: 'preset/motionly/motionly-preset.gif',
    sourceDirectory: 'preset/motionly',
  },
];
