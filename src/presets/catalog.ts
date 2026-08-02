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
      'A 26.9-second AI-native motion graphics launch film with agent lineup, product tour, and delivery handoff scenes.',
    tags: ['product', 'editor', 'launch', 'storyboard', 'scenes', 'saas'],
    width: 1920,
    height: 1080,
    duration: 26.9,
    projectPath: 'preset/motionly/motionly.motion',
    previewPath: 'preset/motionly/motionly-preset.gif',
    sourceDirectory: 'preset/motionly',
  },
];
