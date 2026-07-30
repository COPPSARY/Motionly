import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  archetypeRegistry,
  beatRegistry,
  componentRegistry,
  effectRegistry,
  layoutRegistry,
  MOTION_CATALOG_VERSION,
  moveRegistry,
  showcaseRegistry,
  type CatalogEntry,
} from '../src/semantic/catalog';
import { PRESET_CATALOG } from '../src/presets/catalog';
import { registryExamples } from '../src/motion-system/examples';

const registryRoot = resolve('registry');
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const slug = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replaceAll('_', '-')
    .toLowerCase();
const title = (value: string) =>
  slug(value)
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const builtins: Array<{
  directory: string;
  type: string;
  entries: readonly CatalogEntry[];
  /** Where the TypeScript that implements these entries lives. */
  source: string;
}> = [
  {
    directory: 'moves',
    type: 'motionly:move',
    entries: moveRegistry(),
    source: 'src/animation-library/presets.ts',
  },
  {
    directory: 'effects',
    type: 'motionly:effect',
    entries: effectRegistry(),
    source: 'src/render/canvas-renderer.ts',
  },
  {
    directory: 'components',
    type: 'motionly:component',
    entries: componentRegistry(),
    source: 'src/semantic/component-structures.ts',
  },
  {
    directory: 'showcases',
    type: 'motionly:showcase',
    entries: showcaseRegistry(),
    source: 'src/motion-system/showcase.ts',
  },
  {
    directory: 'layouts',
    type: 'motionly:layout',
    entries: layoutRegistry(),
    source: 'src/motion-system/layout.ts',
  },
  {
    directory: 'beats',
    type: 'motionly:beat',
    entries: beatRegistry(),
    source: 'src/motion-system/beats.ts',
  },
  {
    directory: 'archetypes',
    type: 'motionly:archetype',
    entries: archetypeRegistry(),
    source: 'src/semantic/compiler.ts',
  },
];

// Installable example compositions, keyed by the block they demonstrate.
const examples = new Map(registryExamples().map((example) => [example.name, example]));

const items: Record<string, unknown>[] = [];
const directoryCounts = new Map<string, number>();
for (const group of builtins) {
  for (const entry of group.entries) {
    const baseDirectory = `${group.directory}/${slug(entry.name)}`;
    const occurrence = (directoryCounts.get(baseDirectory) ?? 0) + 1;
    directoryCounts.set(baseDirectory, occurrence);
    const directory = occurrence === 1 ? baseDirectory : `${baseDirectory}-${occurrence}`;
    const example = examples.get(entry.name);
    const exampleFile = example ? `${slug(entry.name)}.motion` : undefined;
    const item = {
      name: entry.name,
      type: group.type,
      title: title(entry.name),
      description: entry.docs,
      tags: [...new Set([group.directory.slice(0, -1), ...entry.category.split(/\s+/)])],
      version: entry.version,
      builtin: true,
      // Where the engine implements this entry. The registry folder holds the
      // manifest and an installable example; the behavior lives in src/.
      implementation: { name: entry.name, source: group.source },
      schema: entry.schema,
      defaults: entry.defaults,
      ...(entry.metadata ? { metadata: entry.metadata } : {}),
      ...(example && exampleFile
        ? {
            duration: example.duration,
            files: [
              {
                // Paths are resolved from the package root, matching presets.
                path: `registry/${directory}/${exampleFile}`,
                target: `compositions/${exampleFile}`,
                type: 'motionly:composition',
              },
            ],
          }
        : {}),
      manifest: `${directory}/registry-item.json`,
    };
    await mkdir(resolve(registryRoot, directory), { recursive: true });
    await writeFile(resolve(registryRoot, item.manifest), json(item));
    if (example && exampleFile) {
      await writeFile(resolve(registryRoot, directory, exampleFile), example.source);
    }
    items.push({
      name: item.name,
      type: item.type,
      title: item.title,
      description: item.description,
      tags: item.tags,
      version: item.version,
      builtin: true,
      // The index carries `files` so `motionly add` can install the example
      // without opening every manifest.
      ...(example && exampleFile ? { duration: example.duration, files: item.files } : {}),
      manifest: item.manifest,
    });
  }
}

for (const preset of PRESET_CATALOG) {
  const directory = `presets/${preset.name}`;
  const item = {
    name: preset.name,
    type: 'motionly:preset',
    title: preset.title,
    description: preset.description,
    tags: preset.tags,
    version: MOTION_CATALOG_VERSION,
    dimensions: { width: preset.width, height: preset.height },
    duration: preset.duration,
    files: [
      {
        path: preset.sourceDirectory,
        target: `presets/${preset.name}`,
        type: 'motionly:preset',
      },
    ],
    project: preset.projectPath,
    preview: preset.previewPath,
    manifest: `${directory}/registry-item.json`,
  };
  await mkdir(resolve(registryRoot, directory), { recursive: true });
  await writeFile(resolve(registryRoot, item.manifest), json(item));
  items.push(item);
}

await writeFile(
  resolve(registryRoot, 'registry.json'),
  json({ name: 'motionly', version: MOTION_CATALOG_VERSION, items })
);
