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
  {
    name: 'database-indexing',
    title: 'How Database Indexing Works',
    description:
      'A 42-second editorial explainer following one query from full table scan to a direct index seek.',
    tags: ['database', 'indexing', 'sql', 'engineering', 'explainer'],
    width: 1920,
    height: 1080,
    duration: 42,
    projectPath: 'preset/database-indexing/database-indexing.motion',
    previewPath: 'preset/database-indexing/database-indexing-preview.png',
    sourceDirectory: 'preset/database-indexing',
  },
];
