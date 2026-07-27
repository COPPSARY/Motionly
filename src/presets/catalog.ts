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
    description: 'A concise introduction to Motionly and editable .motion projects.',
    tags: ['product', 'editor', 'launch'],
    width: 1920,
    height: 1080,
    duration: 32.1,
    projectPath: 'preset/motionly/motionly.motion',
    previewPath: 'preset/motionly/motionly-preset.gif',
    sourceDirectory: 'preset/motionly',
  },
];
