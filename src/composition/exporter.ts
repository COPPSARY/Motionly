import type { CompositionRuntime } from "./runtime";

async function blobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(reader.error ?? new Error("Could not embed an image."));
    reader.readAsDataURL(blob);
  });
}

async function inlineImages(source: Element, clone: Element): Promise<void> {
  const sourceImages = Array.from(source.querySelectorAll("img"));
  const cloneImages = Array.from(clone.querySelectorAll("img"));
  await Promise.all(
    sourceImages.map(async (image, index) => {
      const target = cloneImages[index];
      const url = image.currentSrc || image.src;
      if (!target || !url || url.startsWith("data:")) return;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Could not embed ${url} for export.`);
      target.src = await blobAsDataUrl(await response.blob());
    }),
  );
}

async function imageFromSvg(svg: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = "sync";
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  return image;
}

export async function renderCompositionFrame(
  runtime: CompositionRuntime,
  scale = 1,
): Promise<HTMLCanvasElement> {
  const { width, height } = runtime.definition;
  const clone = runtime.root.cloneNode(true) as HTMLElement;
  await inlineImages(runtime.root, clone);
  clone.style.position = "relative";
  clone.style.inset = "auto";
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.transform = "none";
  clone.style.border = "0";
  clone.style.borderRadius = "0";
  clone.style.boxShadow = "none";
  const serialized = new XMLSerializer().serializeToString(clone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">${serialized}</div></foreignObject></svg>`;
  const image = await imageFromSvg(svg);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D canvas export is unavailable.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function exportPng(
  runtime: CompositionRuntime,
  scale = 1,
): Promise<Blob> {
  const canvas = await renderCompositionFrame(runtime, scale);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PNG encoding failed."));
    }, "image/png");
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
