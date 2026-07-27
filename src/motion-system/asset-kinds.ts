/**
 * Asset kinds.
 *
 * The shared vocabulary that connects asset classification to component
 * selection. Kept in its own module so `layout.ts`, `showcase.ts`,
 * `metadata.ts`, and `asset-intelligence.ts` can all describe which media they
 * accept without importing each other.
 */

export const ASSET_KINDS = [
  'logo',
  'icon',
  'screenshot',
  'ui',
  'illustration',
  'photo',
  'video',
  'avatar',
  'chart',
  'unknown',
] as const;

export type AssetKind = (typeof ASSET_KINDS)[number];

export function isAssetKind(value: string): value is AssetKind {
  return (ASSET_KINDS as readonly string[]).includes(value);
}
