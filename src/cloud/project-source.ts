import type { ProjectSourceFiles } from "./projects-api";

export const BUILTIN_PREVIEW_ASSET_TOKENS = {
  logo: "__MOTIONLY_BUILTIN_ASSET_LOGO__",
  uiScreenshot: "__MOTIONLY_BUILTIN_ASSET_UI_SCREENSHOT__",
} as const;

export function hydrateBuiltinPreviewAssets(
  bundle: string,
  assets: { logo: string; uiScreenshot: string },
): string {
  return bundle
    .replaceAll(BUILTIN_PREVIEW_ASSET_TOKENS.logo, assets.logo)
    .replaceAll(BUILTIN_PREVIEW_ASSET_TOKENS.uiScreenshot, assets.uiScreenshot);
}

export function splitCompositionSource(
  compositionHtml: string,
  timelineJs: string,
  indexTs: string,
): ProjectSourceFiles {
  const styles: string[] = [];
  const html = compositionHtml.replace(
    /<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi,
    (_match, css: string) => {
      styles.push(css.trim());
      return "";
    },
  );
  return {
    "composition.html": html.trim(),
    "styles.css": styles.join("\n\n"),
    "timeline.js": timelineJs.trim(),
    "index.ts": externalizeAdapterStyles(indexTs, styles.length > 0).trim(),
  };
}

export function combineCompositionSource(files: ProjectSourceFiles): string {
  if (!files["styles.css"].trim()) return files["composition.html"];
  const style = `<style>\n${files["styles.css"]}\n</style>`;
  return files["composition.html"].replace(
    /(<template\b[^>]*>)/i,
    `$1\n${style}`,
  );
}

function externalizeAdapterStyles(indexTs: string, hasStyles: boolean): string {
  if (!hasStyles || indexTs.includes('from "./styles.css?raw"')) return indexTs;
  const htmlImport =
    /import\s+compositionHtml\s+from\s+["']\.\/composition\.html\?raw["'];?/;
  const match = htmlImport.exec(indexTs);
  if (!match || match.index === undefined) return indexTs;
  const boundary = match.index + match[0].length;
  const prefix = indexTs.slice(0, boundary);
  const suffix = indexTs
    .slice(boundary)
    .replace(/\bcompositionHtml\b/g, "compositionSource");
  return `${prefix}
import compositionStyles from "./styles.css?raw";

const compositionSource = compositionHtml.replace(
  /(<template\\b[^>]*>)/i,
  \`$1<style>\\n\${compositionStyles}\\n</style>\`,
);${suffix}`;
}
