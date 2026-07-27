import type { ElementNode, ImportNode, ProgramNode } from '../types/parser';
import type { MotionlySvgData } from './asset-loader';

function safeId(value: string): string {
  const id = value.replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  return /^[a-zA-Z_]/.test(id) ? id : `layer_${id || 'svg'}`;
}

/** Turn parsed static SVG metadata into ordinary editable .motion layers. */
export function decomposeSvg(
  program: ProgramNode,
  alias: string,
  svg: MotionlySvgData,
  options: { start?: number; duration?: number; track?: string | number; width?: number } = {}
): ElementNode[] {
  const used = new Set(
    program.body.flatMap((node) => (node.type === 'Element' ? [node.name] : []))
  );
  const unique = (candidate: string) => {
    const base = safeId(candidate);
    let id = base;
    let suffix = 2;
    while (used.has(id)) id = `${base}_${suffix++}`;
    used.add(id);
    return id;
  };
  const root = unique(`${alias}_layers`);
  const scale = (options.width ?? Math.min(640, Math.max(160, svg.width))) / Math.max(1, svg.width);
  const nodes: ElementNode[] = [
    {
      type: 'Element',
      kind: 'group',
      name: root,
      properties: {
        label: svg.title || alias,
        x: 0,
        y: 0,
        scale,
        ...(options.start !== undefined ? { start: `${options.start}s` } : {}),
        ...(options.duration !== undefined ? { duration: `${options.duration}s` } : {}),
        ...(options.track !== undefined ? { track: options.track } : {}),
      },
    },
  ];
  const groupIds = new Map<string, string>();
  for (const group of svg.groups) groupIds.set(group.id, unique(`${alias}_${group.id}`));
  for (const group of svg.groups) {
    nodes.push({
      type: 'Element',
      kind: 'group',
      name: groupIds.get(group.id)!,
      properties: {
        parent: group.parentId ? groupIds.get(group.parentId)! : root,
        label: group.label,
        sourceId: group.id,
      },
    });
  }
  for (const path of svg.paths) {
    nodes.push({
      type: 'Element',
      kind: 'path',
      name: unique(`${alias}_${path.id}`),
      properties: {
        parent: path.parentId ? groupIds.get(path.parentId)! : root,
        label: path.label,
        sourceId: path.id,
        d: path.d,
        x: -svg.width / 2,
        y: -svg.height / 2,
        fill: path.fill,
        stroke: path.stroke,
        strokeWidth: path.strokeWidth,
        opacity: Math.min(path.opacity, path.fillOpacity),
      },
    });
  }
  for (const part of svg.lockedParts) {
    const layerId = unique(`${alias}_${part.id}`);
    const assetName = unique(`${layerId}_source`);
    const imported: ImportNode = {
      type: 'Import',
      name: assetName,
      path: `data:image/svg+xml,${encodeURIComponent(part.source)}`,
    };
    program.body.push(imported);
    nodes.push({
      type: 'Element',
      kind: 'svgpart',
      name: layerId,
      properties: {
        parent: part.parentId ? groupIds.get(part.parentId)! : root,
        source: assetName,
        label: part.label,
        sourceId: part.id,
        width: svg.width,
        height: svg.height,
        locked: true,
      },
    });
  }
  return nodes;
}
