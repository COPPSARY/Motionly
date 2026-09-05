import registryManifestRaw from "../../registry/registry.json";
import type { RegistryItemSummary, RegistryManifest } from "./types";

export const registryManifest =
  registryManifestRaw as unknown as RegistryManifest;

/**
 * Returns all 383 registry items (blocks, components, examples).
 */
export function getAllRegistryItems(): readonly RegistryItemSummary[] {
  return registryManifest.items;
}

/**
 * Returns all 155 full scene / showcase blocks.
 */
export function getRegistryBlocks(): readonly RegistryItemSummary[] {
  return registryManifest.items.filter(
    (item) => item.type === "hyperframes:block",
  );
}

/**
 * Returns all 219 composable motion components.
 */
export function getRegistryComponents(): readonly RegistryItemSummary[] {
  return registryManifest.items.filter(
    (item) => item.type === "hyperframes:component",
  );
}

/**
 * Returns all 9 production examples.
 */
export function getRegistryExamples(): readonly RegistryItemSummary[] {
  return registryManifest.items.filter(
    (item) => item.type === "hyperframes:example",
  );
}

/**
 * Find a specific registry item by name (case-insensitive).
 */
export function findRegistryItem(
  name: string,
): RegistryItemSummary | undefined {
  const key = name.trim().toLowerCase();
  return registryManifest.items.find((item) => item.name.toLowerCase() === key);
}

/**
 * Filter registry items by tag.
 */
export function getRegistryItemsByTag(
  tag: string,
): readonly RegistryItemSummary[] {
  const targetTag = tag.trim().toLowerCase();
  return registryManifest.items.filter(
    (item) => item.tags && item.tags.some((t) => t.toLowerCase() === targetTag),
  );
}

/**
 * Fuzzy search across registry item names, titles, descriptions, families, and tags.
 */
export function searchRegistry(query: string): readonly RegistryItemSummary[] {
  const q = query.trim().toLowerCase();
  if (!q) return registryManifest.items;

  return registryManifest.items.filter((item) => {
    if (item.name.toLowerCase().includes(q)) return true;
    if (item.title && item.title.toLowerCase().includes(q)) return true;
    if (item.description && item.description.toLowerCase().includes(q))
      return true;
    if (item.tags && item.tags.some((tag) => tag.toLowerCase().includes(q)))
      return true;
    if (item.family && item.family.toLowerCase().includes(q)) return true;
    return false;
  });
}
