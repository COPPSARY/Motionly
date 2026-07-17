import type { ASTNode, ProgramNode } from '../types/parser';

export function serializeProgram(program: ProgramNode): string {
  return program.body.map(serializeNode).join('\n\n');
}

function serializeNode(node: ASTNode): string {
  if (node.type === 'Canvas') return block('canvas', node.properties);
  if (node.type === 'Camera') return block('camera', node.properties);
  if (node.type === 'Audio') {
    const name = `audio "${escapeString(node.path)}"`;
    return Object.keys(node.properties).length ? block(name, node.properties) : name;
  }
  if (node.type === 'Clip') return block(`clip ${node.assetName}`, node.properties);
  if (node.type === 'Track') return block(`track ${node.name}`, node.properties);
  if (node.type === 'Import') return `import "${escapeString(node.path)}" as ${node.name}`;
  if (node.type === 'Sequence') return block(`sequence ${node.name}`, node.properties);
  if (node.type === 'Element')
    return block(
      `${node.kind === 'asset' ? '' : `${node.kind} `}${node.name}`.trim(),
      node.properties
    );
  if (node.type !== 'Animation') return '';

  const lines = [`animate ${node.target} {`];
  if (node.from && Object.keys(node.from).length) lines.push(indent(block('from', node.from)));
  if (node.to && Object.keys(node.to).length) lines.push(indent(block('to', node.to)));
  if (node.keyframes?.length) {
    lines.push('  keyframes {');
    for (const frame of node.keyframes) {
      const offset = Number((frame.offset * 100).toFixed(3));
      const body = frame.easing ? { ...frame.properties, ease: frame.easing } : frame.properties;
      lines.push(indent(indent(block(`${offset}%`, body))));
    }
    lines.push('  }');
  }
  if (node.delay !== undefined) lines.push(`  delay ${formatDuration(node.delay)}`);
  if (node.duration !== undefined) lines.push(`  duration ${formatDuration(node.duration)}`);
  if (node.easing) lines.push(`  easing ${node.easing}`);
  lines.push('}');
  return lines.join('\n');
}

function block(name: string, properties: Record<string, unknown>): string {
  const lines = [`${name} {`];
  for (const [key, value] of Object.entries(properties)) {
    lines.push(value === true ? `  ${key}` : `  ${key} ${formatValue(value)}`);
  }
  lines.push('}');
  return lines.join('\n');
}

function indent(value: string): string {
  return value
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
}

function formatValue(value: unknown): string {
  if (typeof value === 'number')
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
  const text = String(value);
  return /\s|"/.test(text) ? `"${escapeString(text)}"` : text;
}

function formatDuration(value: unknown): string {
  return typeof value === 'number' ? `${Number(value.toFixed(3))}s` : String(value);
}

function escapeString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}
