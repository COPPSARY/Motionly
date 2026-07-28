import type { AudioNode, ClipNode, ImportNode, ProgramNode } from '../types/parser';
import { LEGACY_AUDIO_NAME, LEGACY_AUDIO_TRACK } from '../scene/scene-graph';
import { parseTime } from '../core/units';

export interface LegacyAudioMigration {
  /** Import name the audio is now referenced by. */
  name: string;
  /** Track the clip landed on. */
  track: string;
}

/**
 * Rewrite a legacy single `audio "..."` node into an ordinary import + clip.
 *
 * Old projects modelled sound as one background node with only a start time.
 * Editing it as a clip needs a real Clip node, so the editor converts the node
 * the first time a project is opened. Returns null when there is nothing to do.
 */
export function migrateLegacyAudioNode(
  program: ProgramNode,
  options: { sourceDuration?: number; canvasDuration: number }
): LegacyAudioMigration | null {
  const node = program.body.find((item): item is AudioNode => item.type === 'Audio');
  if (!node) return null;

  const used = new Set(
    program.body.flatMap((item) => ('name' in item && item.name ? [item.name] : []))
  );
  let name = LEGACY_AUDIO_NAME;
  let suffix = 2;
  while (used.has(name)) name = `${LEGACY_AUDIO_NAME}_${suffix++}`;

  const declaredAudioTrack = program.body.find(
    (item) => item.type === 'Track' && String(item.properties['role'] ?? '') === 'audio'
  );
  const track =
    declaredAudioTrack && 'name' in declaredAudioTrack
      ? declaredAudioTrack.name
      : LEGACY_AUDIO_TRACK;

  const start = Math.max(0, parseTime((node.properties['start'] ?? 0) as string | number));
  // Prefer the decoded source length; fall back to the rest of the project so
  // the clip still covers what the legacy node used to play.
  const declared = node.properties['duration'];
  const duration =
    declared !== undefined
      ? Math.max(0, parseTime(declared as string | number))
      : options.sourceDuration && options.sourceDuration > 0
        ? options.sourceDuration
        : Math.max(0, options.canvasDuration - start);

  const importNode: ImportNode = { type: 'Import', path: node.path, name };
  const clipNode: ClipNode = {
    type: 'Clip',
    assetName: name,
    properties: {
      track,
      start: `${start.toFixed(3)}s`,
      duration: `${duration.toFixed(3)}s`,
      trimIn: '0s',
      trimOut: '0s',
      ...(node.properties['volume'] !== undefined
        ? { volume: Number(node.properties['volume']) }
        : {}),
    },
  };

  const index = program.body.indexOf(node);
  program.body.splice(index, 1, importNode);
  program.body.push(clipNode);
  return { name, track };
}
