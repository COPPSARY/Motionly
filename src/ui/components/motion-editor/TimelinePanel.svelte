<script lang="ts">
  import './timeline-panel.css';
  import { Copy, Ellipsis, Eye, EyeOff, Layers3, Magnet, Minus, Music2, Pause, Play, Plus, Redo2, Undo2, Scissors, SkipBack, Sparkles, Square, Trash2, Type, Upload, Video, Volume2, VolumeX, X } from 'lucide-svelte';
  import type { LoadedAsset } from '../../../assets/asset-loader';
  import type { Clip, Element, Scene, Track } from '../../../types/scene';
  import type { ClipTransitionBoundary } from '../../clip-transitions';
  import type { PackedClipTrack, TimelineLane } from '../../timeline-lanes';
  import { assetPreviewSource, formatPreciseTime, formatTime, stringProperty, timelineLaneLabel } from './helpers';
  import type { TimelineClipDrag } from './types';

  export let timelineScroll: HTMLDivElement;
  export let audioInput: HTMLInputElement;
  export let audioElement: HTMLAudioElement;
  export let isPlaying: boolean;
  export let currentTime: number;
  export let displayFrame: number;
  export let selectedElement: Element | null;
  export let selectedClip: Clip | null;
  export let selectedElementId: string;
  export let editorCanUndo: boolean;
  export let editorCanRedo: boolean;
  export let snapEnabled: boolean;
  export let timelineZoom: number;
  export let timelineContentWidth: number;
  export let totalDuration: number;
  export let scene: Scene | null;
  export let draggingAsset: boolean;
  export let draggingAudio: boolean;
  export let draggingTransition: 'crossfade' | null;
  export let dropTargetTime: number | null;
  export let timelineTicks: number[];
  export let timelineSnapGuide: number | null;
  export let timelineRows: TimelineLane[];
  export let timelineClipTracks: PackedClipTrack[];
  export let clipDrag: TimelineClipDrag | null;
  export let keyframeDragDelta: number;
  export let selectedKeyframeOffset: number | null;
  export let transitionBoundaries: ClipTransitionBoundary[];
  export let selectedTransition: ClipTransitionBoundary | null;
  export let projectAudioTrack: Track | null;
  export let audioName: string;
  export let audioClipDuration: number;
  export let audioWaveformLoading: boolean;
  export let audioWaveformPath: string;
  export let visibleWaveformPeaks: number;
  export let assets: Map<string, LoadedAsset>;
  export let onResizeTimeline: (event: PointerEvent) => void;
  export let onResizeTimelineKey: (event: KeyboardEvent) => void;
  export let onReset: () => void;
  export let onPlay: () => void;
  export let onPause: () => void;
  export let onAudioSelected: (event: Event) => void | Promise<void>;
  export let onRemoveAudio: () => void;
  export let onDuplicateSelected: () => void;
  export let onDeleteSelected: () => void;
  export let onUndo: () => void;
  export let onRedo: () => void;
  export let onSplitSelectedClip: () => void;
  export let timelineRange: (id: string) => { start: number; end: number };
  export let onToggleSnap: () => void;
  export let onSetTimelineZoom: (zoom: number) => void;
  export let timelinePercent: (time: number) => number;
  export let onTimelineDragOver: (event: DragEvent) => void;
  export let onTimelineDrop: (event: DragEvent) => void;
  export let onTimelineDragLeave: () => void;
  export let onTimelineWheel: (event: WheelEvent) => void;
  export let onSeek: (event: Event) => void;
  export let timelineTrackDisplayOrder: (track: Track | null | undefined, fallbackId: string) => number;
  export let onUpdateTrack: (track: Track, updates: { hidden?: boolean; muted?: boolean }) => void;
  export let selectedKeyframeMarkers: () => { offset: number; easing?: string }[];
  export let keyframeTime: (offset: number) => number;
  export let onMoveTimelineElement: (event: PointerEvent, element: Element) => void;
  export let onSelectElement: (id: string, seek?: boolean) => void;
  export let onDuplicateElement: (id: string) => void;
  export let onShowMoreOptions: (id: string) => void;
  export let onDeleteElement: (id: string) => void;
  export let onTrimElement: (event: PointerEvent, id: string, edge: 'start' | 'end') => void;
  export let onDragKeyframe: (event: PointerEvent, offset: number) => void;
  export let onDeleteKeyframeAt: (event: Event, offset: number) => void;
  export let onAddKeyframe: () => void;
  export let onMoveTimelineAudio: (event: PointerEvent) => void;
  export let onMoveTimelineClip: (event: PointerEvent, clip: Clip) => void;
  export let onDuplicateClip: (id: string) => void;
  export let onTrimTimelineClip: (event: PointerEvent, clip: Clip, edge: 'start' | 'end') => void;
  export let onDeleteClip: (id: string) => void;
  export let onDropTransition: (event: DragEvent, boundary: ClipTransitionBoundary) => void;
  export let onSelectTransition: (boundary: ClipTransitionBoundary) => void;
  export let onAudioMetadata: (duration: number) => void;
</script>

  <section class="me-timeline-panel">
    <button
      type="button"
      class="me-timeline-resizer"
      aria-label="Resize timeline"
      title="Drag to resize timeline"
      on:pointerdown={onResizeTimeline}
      on:keydown={onResizeTimelineKey}
    ><span></span></button>
    <div class="me-timeline-toolbar">
      <div class="me-playback-controls">
        <button on:click={onReset} class="me-control-btn" title="Go to start (Home)">
          <SkipBack size={17} />
        </button>
        <button on:click={isPlaying ? onPause : onPlay} class="me-control-btn me-play-btn" title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}>
          {#if isPlaying}<Pause size={19} />{:else}<Play size={19} />{/if}
        </button>
        <span class="me-timecode">{formatPreciseTime(currentTime)}</span>
        <span class="me-framecode">Frame {displayFrame}</span>
      </div>

      <div class="me-timeline-context">
        <Layers3 size={14} />
        <span>{selectedElement?.id ?? selectedClip?.assetName ?? 'Timeline'}</span>
      </div>

      <div class="me-timeline-actions">
        <input bind:this={audioInput} class="me-file-input" type="file" accept="audio/*" on:change={onAudioSelected} />
        {#if audioName}
          <span class="me-audio-chip"><Music2 size={13} /> {audioName}</span>
          <button class="me-icon-btn" on:click={onRemoveAudio} title="Remove audio"><Trash2 size={14} /></button>
        {:else}
          <button class="me-timeline-command" on:click={() => audioInput.click()} title="Attach audio"><Upload size={14} /> Audio</button>
        {/if}
        {#if selectedElement || selectedClip}
          <button class="me-icon-btn" on:click={onDuplicateSelected} title="Duplicate selected layer (Ctrl/Cmd+D)" aria-label="Duplicate selected layer"><Copy size={14} /></button>
          <button class="me-icon-btn me-danger-btn" on:click={onDeleteSelected} title="Delete selected layer (Delete)"><Trash2 size={14} /></button>
        {/if}
        <button class="me-icon-btn" on:click={onUndo} disabled={!editorCanUndo} title="Undo (Ctrl/Cmd+Z)"><Undo2 size={14} /></button>
        <button class="me-icon-btn" on:click={onRedo} disabled={!editorCanRedo} title="Redo (Ctrl/Cmd+Shift+Z)"><Redo2 size={14} /></button>
        <button class="me-icon-btn" on:click={onSplitSelectedClip} disabled={!((selectedClip && currentTime > selectedClip.start && currentTime < selectedClip.start + selectedClip.duration) || (selectedElement && currentTime > timelineRange(selectedElement.id).start && currentTime < timelineRange(selectedElement.id).end))} title="Split selected clip at playhead (S)"><Scissors size={14} /></button>
        <button class="me-icon-btn" class:me-active={snapEnabled} on:click={onToggleSnap} title={snapEnabled ? 'Disable smart snapping' : 'Enable smart snapping'}><Magnet size={15} /></button>
        <button on:click={() => onSetTimelineZoom(timelineZoom / 1.25)} class="me-icon-btn" title="Timeline zoom out"><Minus size={15} /></button>
        <span class="me-timeline-zoom-value">{Math.round(timelineZoom * 100)}%</span>
        <button on:click={() => onSetTimelineZoom(timelineZoom * 1.25)} class="me-icon-btn" title="Timeline zoom in"><Plus size={15} /></button>
      </div>
    </div>

    <div 
      bind:this={timelineScroll}
      class="me-timeline-scroll" 
      style={`--timeline-content-width: ${timelineContentWidth}px; --playhead-position: ${timelinePercent(currentTime)}%`}
      class:me-drop-target={draggingAsset !== null || draggingAudio}
      role="region"
      aria-label="Timeline tracks"
      on:dragover={onTimelineDragOver}
      on:drop={onTimelineDrop}
      on:dragleave={onTimelineDragLeave}
      on:wheel={onTimelineWheel}
    >
      <div class="me-ruler-row">
        <div class="me-track-label me-ruler-label">Layers</div>
        <div class="me-ruler">
          {#each timelineTicks as tick}
            <span class="me-ruler-tick" style={`left: ${timelinePercent(tick)}%`}>{formatTime(tick)}</span>
          {/each}
          <span class="me-playhead-marker"></span>
          {#if timelineSnapGuide !== null}
            <span class="me-timeline-snap-guide" style={`left: ${timelinePercent(timelineSnapGuide)}%`}></span>
          {/if}
          {#if dropTargetTime !== null}
            <span class="me-drop-indicator" style={`left: ${timelinePercent(dropTargetTime)}%`}></span>
          {/if}
          <input class="me-timeline-scrubber" type="range" min="0" max={totalDuration} step={1 / (scene?.canvas.fps ?? 60)} value={currentTime} on:input={onSeek} aria-label="Timeline scrubber" />
        </div>
      </div>

      {#each timelineRows as row}
        {@const rowTrack = scene?.tracks.find((track) => track.id === row.trackId)}
        <div
          class="me-timeline-row"
          class:me-selected={row.items.some((item) => item.element.id === selectedElementId)}
          style={`min-height: ${row.laneCount * 34 + 8}px; order: ${timelineTrackDisplayOrder(rowTrack, row.trackId)}`}
        >
          <div class="me-track-label" class:me-track-hidden={rowTrack?.hidden}>
            <span class="me-track-thumb">
              {#if row.items[0].element.kind === 'asset' && row.items[0].element.asset?.type === 'video'}<Video size={12} />
              {:else if row.items[0].element.kind === 'asset' && row.items[0].element.asset?.path}<img src={assetPreviewSource(assets.get(row.items[0].element.assetName ?? ''), row.items[0].element.asset.path)} alt="" />
              {:else if row.kind === 'text'}<Type size={12} />
              {:else if row.kind === 'effect'}<Sparkles size={12} />
              {:else}<Square size={12} />{/if}
            </span>
            <span class="me-track-copy">
              <strong>{timelineLaneLabel(row)}</strong>
              <small>{row.items.length} {row.items.length === 1 ? 'element' : 'elements'}{row.laneCount > 1 ? ` · ${row.laneCount} stacked` : ''}</small>
            </span>
            {#if rowTrack}
              <span class="me-track-controls">
                <button type="button" class="me-track-control" class:me-active={rowTrack.hidden} on:click|stopPropagation={() => onUpdateTrack(rowTrack, { hidden: !rowTrack.hidden })} title={rowTrack.hidden ? 'Show track' : 'Hide track'}>
                  {#if rowTrack.hidden}<EyeOff size={13} />{:else}<Eye size={13} />{/if}
                </button>
              </span>
            {:else}
              <span class="me-track-time">{formatPreciseTime(row.start)} - {formatPreciseTime(row.end)}</span>
            {/if}
          </div>
          <div class="me-track-lane" data-track={row.trackId} style={`min-height: ${row.laneCount * 34 + 7}px`}>
            {#if clipDrag && clipDrag.ghostTrackId === row.trackId}
              <span class="me-clip-ghost" class:me-invalid={!clipDrag.valid} style={`left: ${timelinePercent(clipDrag.ghostStart)}%; width: ${Math.max(0.8, timelinePercent(clipDrag.duration))}%`}></span>
              {#if clipDrag.kind === 'element' && clipDrag.id === selectedElementId && !row.items.some((item) => item.element.id === selectedElementId)}
                {#each selectedKeyframeMarkers() as frame}
                  <span class="me-keyframe-marker me-drag-keyframe" style={`left: ${timelinePercent(keyframeTime(frame.offset) + keyframeDragDelta)}%; top: 19.5px`} aria-hidden="true"></span>
                {/each}
              {/if}
            {/if}
            {#each row.items as item}
              <span class="me-clip me-element-clip" class:me-selected-clip={item.element.id === selectedElementId} style={`left: ${timelinePercent(item.range.start)}%; width: ${Math.max(0.8, timelinePercent(item.range.end - item.range.start))}%; top: ${6 + item.lane * 34}px`}>
                {#if item.element.kind === 'asset' && item.element.asset?.type === 'video'}
                  <span class="me-clip-media me-video-clip-media"><Video size={13} /></span>
                {:else if item.element.kind === 'asset' && item.element.asset?.path}
                  <span
                    class="me-clip-media"
                    style={`background-image: url('${assetPreviewSource(assets.get(item.element.assetName ?? ''), item.element.asset.path)}')`}
                  ></span>
                {:else if item.element.kind === 'text'}
                  <span class="me-clip-text">{stringProperty(item.element, 'value', item.element.id)}</span>
                {:else if item.element.kind === 'overlay'}
                  <span class="me-clip-color" style={`background: ${stringProperty(item.element, 'fill', '#34404e')}`}></span>
                {/if}
                <button type="button" class="me-clip-select" on:pointerdown={(event) => onMoveTimelineElement(event, item.element)} on:click={() => onSelectElement(item.element.id, false)} aria-label={`Select or move ${item.element.id}`}></button>
                <button type="button" class="me-clip-action me-clip-duplicate" on:click|stopPropagation={() => onDuplicateElement(item.element.id)} title="Duplicate layer (Ctrl/Cmd+D)" aria-label={`Duplicate ${item.element.id}`}><Copy size={11} /></button>
                <button type="button" class="me-clip-action me-clip-more" on:click|stopPropagation={() => onShowMoreOptions(item.element.id)} title="More options" aria-label={`Show more options for ${item.element.id}`}><Ellipsis size={11} /></button>
                <button type="button" class="me-clip-action me-clip-delete" on:click|stopPropagation={() => onDeleteElement(item.element.id)} title="Delete layer (Delete)" aria-label={`Delete ${item.element.id}`}><X size={11} /></button>
                <button type="button" class="me-trim-handle me-trim-start" on:pointerdown={(event) => onTrimElement(event, item.element.id, 'start')} aria-label={`Trim start of ${item.element.id}`}></button>
                <button type="button" class="me-trim-handle me-trim-end" on:pointerdown={(event) => onTrimElement(event, item.element.id, 'end')} aria-label={`Trim end of ${item.element.id}`}></button>
              </span>
            {/each}
            {#if row.items.some((item) => item.element.id === selectedElementId) && !(clipDrag?.kind === 'element' && clipDrag.id === selectedElementId && clipDrag.ghostTrackId !== row.trackId)}
              {@const kfLane = row.items.find((item) => item.element.id === selectedElementId)?.lane ?? 0}
              {#each selectedKeyframeMarkers() as frame}
                <button
                  type="button"
                  class="me-keyframe-marker"
                  class:me-selected-keyframe={selectedKeyframeOffset !== null && Math.abs(selectedKeyframeOffset - frame.offset) < 0.000001}
                  style={`left: ${timelinePercent(keyframeTime(frame.offset) + keyframeDragDelta)}%; top: ${6 + kfLane * 34 + 13.5}px`}
                  title={`Keyframe ${Math.round(frame.offset * 100)}%${frame.easing ? ' · ' + frame.easing : ''} — drag to retime, right-click to delete`}
                  aria-label={`Keyframe at ${Math.round(frame.offset * 100)} percent`}
                  on:pointerdown={(event) => onDragKeyframe(event, frame.offset)}
                  on:contextmenu={(event) => onDeleteKeyframeAt(event, frame.offset)}
                ></button>
              {/each}
              <button
                type="button"
                class="me-keyframe-add"
                style={`left: ${timelinePercent(currentTime)}%; top: ${6 + kfLane * 34 + 13.5}px`}
                title="Add keyframe at playhead"
                aria-label="Add keyframe at playhead"
                on:pointerdown|stopPropagation
                on:click|stopPropagation={onAddKeyframe}
              >+</button>
            {/if}
          </div>
        </div>
      {/each}

      {#each timelineClipTracks as clipTrack}
          <div class="me-timeline-row me-clip-row" class:me-selected={clipTrack.clips.some(({ clip }) => clip.id === selectedElementId) || clipTrack.elements.some(({ item }) => item.element.id === selectedElementId)} style={`min-height: ${clipTrack.laneCount * 34 + 8}px; order: ${timelineTrackDisplayOrder(clipTrack.metadata, String(clipTrack.track))}`}>
            <div class="me-track-label" class:me-track-hidden={clipTrack.metadata?.hidden}>
              <span class="me-track-thumb">
                {#if clipTrack.metadata?.role === 'audio'}
                  <Music2 size={12} />
                {:else if clipTrack.clips[0]?.clip.asset?.type === 'video'}
                  <Video size={12} />
                {:else if clipTrack.clips[0]?.clip.asset?.path}
                  <img src={assetPreviewSource(assets.get(clipTrack.clips[0].clip.assetName), clipTrack.clips[0].clip.asset?.path)} alt="" />
                {:else}
                  <Layers3 size={12} />
                {/if}
              </span>
              <span class="me-track-copy">
                <strong>{clipTrack.metadata?.label ?? `Legacy Track ${clipTrack.track}`}</strong>
                <small>{clipTrack.metadata?.role ?? 'overlay'} · {clipTrack.clips.length + clipTrack.elements.length} {clipTrack.clips.length + clipTrack.elements.length === 1 ? 'item' : 'items'}</small>
              </span>
              {#if clipTrack.metadata}
                <span class="me-track-controls">
                  {#if clipTrack.metadata.role !== 'audio'}
                    <button type="button" class="me-track-control" class:me-active={clipTrack.metadata.hidden} on:click|stopPropagation={() => onUpdateTrack(clipTrack.metadata!, { hidden: !clipTrack.metadata!.hidden })} title={clipTrack.metadata.hidden ? 'Show track' : 'Hide track'} aria-label={clipTrack.metadata.hidden ? 'Show track' : 'Hide track'}>
                      {#if clipTrack.metadata.hidden}<EyeOff size={13} />{:else}<Eye size={13} />{/if}
                    </button>
                  {/if}
                  {#if clipTrack.metadata.role === 'audio' || clipTrack.metadata.role === 'main' || clipTrack.metadata.content === 'video'}
                    <button type="button" class="me-track-control" class:me-active={clipTrack.metadata.muted} on:click|stopPropagation={() => onUpdateTrack(clipTrack.metadata!, { muted: !clipTrack.metadata!.muted })} title={clipTrack.metadata.muted ? 'Unmute track' : 'Mute track'} aria-label={clipTrack.metadata.muted ? 'Unmute track' : 'Mute track'}>
                      {#if clipTrack.metadata.muted}<VolumeX size={13} />{:else}<Volume2 size={13} />{/if}
                    </button>
                  {/if}
                </span>
              {/if}
            </div>
            <div class="me-track-lane" data-track={clipTrack.track} style={`min-height: ${clipTrack.laneCount * 34 + 7}px`}>
              {#if clipDrag && clipDrag.ghostTrackId === String(clipTrack.track)}
                <span class="me-clip-ghost" class:me-invalid={!clipDrag.valid} style={`left: ${timelinePercent(clipDrag.ghostStart)}%; width: ${Math.max(0.8, timelinePercent(clipDrag.duration))}%`}></span>
                {#if clipDrag.kind === 'element' && clipDrag.id === selectedElementId && !clipTrack.elements.some(({ item }) => item.element.id === selectedElementId)}
                  {#each selectedKeyframeMarkers() as frame}
                    <span class="me-keyframe-marker me-drag-keyframe" style={`left: ${timelinePercent(keyframeTime(frame.offset) + keyframeDragDelta)}%; top: 19.5px`} aria-hidden="true"></span>
                  {/each}
                {/if}
              {/if}
              {#if clipTrack.metadata?.id === projectAudioTrack?.id && audioName}
                <span class="me-clip me-audio-clip" class:me-muted={projectAudioTrack?.muted} style={`left: ${timelinePercent(scene?.audioStart ?? 0)}%; width: ${timelinePercent(audioClipDuration)}%; top: 6px`}>
                  <span class="me-audio-waveform" class:me-loading={audioWaveformLoading} aria-hidden="true">
                    {#if audioWaveformPath}
                      <svg viewBox={`0 0 ${visibleWaveformPeaks} 24`} preserveAspectRatio="none">
                        <path d={audioWaveformPath}></path>
                      </svg>
                    {/if}
                  </span>
                  <span class="me-clip-text me-audio-clip-label">{audioName}</span>
                  <button type="button" class="me-clip-select" on:pointerdown={onMoveTimelineAudio} aria-label={`Move audio ${audioName}`}></button>
                </span>
              {/if}
              {#each clipTrack.elements as packedElement}
                {@const item = packedElement.item}
                <span class="me-clip me-element-clip" class:me-selected-clip={item.element.id === selectedElementId} style={`left: ${timelinePercent(item.range.start)}%; width: ${Math.max(0.8, timelinePercent(item.range.end - item.range.start))}%; top: ${6 + packedElement.lane * 34}px`}>
                  {#if item.element.kind === 'asset' && item.element.asset?.type === 'video'}
                    <span class="me-clip-media me-video-clip-media"><Video size={13} /></span>
                  {:else if item.element.kind === 'asset' && item.element.asset?.path}
                    <span class="me-clip-media" style={`background-image: url('${assetPreviewSource(assets.get(item.element.assetName ?? ''), item.element.asset.path)}')`}></span>
                  {:else if item.element.kind === 'text'}
                    <span class="me-clip-text">{stringProperty(item.element, 'value', item.element.id)}</span>
                  {:else if item.element.kind === 'overlay'}
                    <span class="me-clip-color" style={`background: ${stringProperty(item.element, 'fill', '#34404e')}`}></span>
                  {:else}
                    <span class="me-clip-text">{item.element.id}</span>
                  {/if}
                  <button type="button" class="me-clip-select" on:pointerdown={(event) => onMoveTimelineElement(event, item.element)} on:click={() => onSelectElement(item.element.id, false)} aria-label={`Select or move ${item.element.id}`}></button>
                <button type="button" class="me-clip-action me-clip-duplicate" on:click|stopPropagation={() => onDuplicateElement(item.element.id)} title="Duplicate layer (Ctrl/Cmd+D)" aria-label={`Duplicate ${item.element.id}`}><Copy size={11} /></button>
                <button type="button" class="me-clip-action me-clip-more" on:click|stopPropagation={() => onShowMoreOptions(item.element.id)} title="More options" aria-label={`Show more options for ${item.element.id}`}><Ellipsis size={11} /></button>
                <button type="button" class="me-clip-action me-clip-delete" on:click|stopPropagation={() => onDeleteElement(item.element.id)} title="Delete layer (Delete)" aria-label={`Delete ${item.element.id}`}><X size={11} /></button>
                  <button type="button" class="me-trim-handle me-trim-start" on:pointerdown={(event) => onTrimElement(event, item.element.id, 'start')} aria-label={`Trim start of ${item.element.id}`}></button>
                  <button type="button" class="me-trim-handle me-trim-end" on:pointerdown={(event) => onTrimElement(event, item.element.id, 'end')} aria-label={`Trim end of ${item.element.id}`}></button>
                </span>
              {/each}
              {#if clipTrack.elements.some(({ item }) => item.element.id === selectedElementId) && !(clipDrag?.kind === 'element' && clipDrag.id === selectedElementId && clipDrag.ghostTrackId !== String(clipTrack.track))}
                {@const kfLane = clipTrack.elements.find(({ item }) => item.element.id === selectedElementId)?.lane ?? 0}
                {#each selectedKeyframeMarkers() as frame}
                  <button
                    type="button"
                    class="me-keyframe-marker"
                    class:me-selected-keyframe={selectedKeyframeOffset !== null && Math.abs(selectedKeyframeOffset - frame.offset) < 0.000001}
                    style={`left: ${timelinePercent(keyframeTime(frame.offset) + keyframeDragDelta)}%; top: ${6 + kfLane * 34 + 13.5}px`}
                    title={`Keyframe ${Math.round(frame.offset * 100)}%${frame.easing ? ' · ' + frame.easing : ''} — drag to retime, right-click to delete`}
                    aria-label={`Keyframe at ${Math.round(frame.offset * 100)} percent`}
                    on:pointerdown={(event) => onDragKeyframe(event, frame.offset)}
                    on:contextmenu={(event) => onDeleteKeyframeAt(event, frame.offset)}
                  ></button>
                {/each}
                <button
                  type="button"
                  class="me-keyframe-add"
                  style={`left: ${timelinePercent(currentTime)}%; top: ${6 + kfLane * 34 + 13.5}px`}
                  title="Add keyframe at playhead"
                  aria-label="Add keyframe at playhead"
                  on:pointerdown|stopPropagation
                  on:click|stopPropagation={onAddKeyframe}
                >+</button>
              {/if}
              {#each clipTrack.clips as packedClip}
                {@const clip = packedClip.clip}
                <span class="me-clip me-timeline-clip" class:me-selected-clip={clip.id === selectedElementId} style={`left: ${timelinePercent(clip.start)}%; width: ${Math.max(0.8, timelinePercent(clip.duration))}%; top: ${6 + packedClip.lane * 34}px`}>
                  {#if clip.asset?.type === 'video'}
                    <span class="me-clip-media me-video-clip-media"><Video size={13} /></span>
                  {:else if clip.asset?.path}
                    <span
                      class="me-clip-media"
                      style={`background-image: url('${assetPreviewSource(assets.get(clip.assetName), clip.asset.path)}')`}
                    ></span>
                  {:else}
                    <span class="me-clip-text">{clip.assetName}</span>
                  {/if}
                  {#if clip.trimIn > 0 || clip.trimOut > 0}
                    <span class="me-clip-trim-label">↤ {clip.trimIn.toFixed(2)}s · {clip.trimOut.toFixed(2)}s ↦</span>
                  {/if}
                  <button type="button" class="me-clip-select" on:pointerdown={(event) => onMoveTimelineClip(event, clip)} on:click={() => onSelectElement(clip.id, false)} aria-label={`Select ${clip.assetName} clip`}></button>
                  <button type="button" class="me-clip-action me-clip-duplicate" on:click|stopPropagation={() => onDuplicateClip(clip.id)} title="Duplicate clip (Ctrl/Cmd+D)" aria-label={`Duplicate ${clip.assetName} clip`}><Copy size={11} /></button>
                  <button type="button" class="me-clip-action me-clip-more" on:click|stopPropagation={() => onShowMoreOptions(clip.id)} title="More options" aria-label={`Show more options for ${clip.assetName} clip`}><Ellipsis size={11} /></button>
                  <button type="button" class="me-trim-handle me-trim-start" on:pointerdown={(event) => onTrimTimelineClip(event, clip, 'start')} aria-label={`Trim start of ${clip.assetName}`}></button>
                  <button type="button" class="me-trim-handle me-trim-end" on:pointerdown={(event) => onTrimTimelineClip(event, clip, 'end')} aria-label={`Trim end of ${clip.assetName}`}></button>
                  <button type="button" class="me-clip-action me-clip-delete" on:click|stopPropagation={() => onDeleteClip(clip.id)} title="Delete clip (Delete)">
                    <X size={12} />
                  </button>
                </span>
              {/each}
              {#each transitionBoundaries.filter((boundary) => String(boundary.outgoing.track) === String(clipTrack.track)) as boundary}
                <button
                  type="button"
                  class="me-transition-cut"
                  class:me-has-transition={boundary.type !== null}
                  class:me-drop-ready={draggingTransition !== null}
                  class:me-selected-transition={selectedTransition?.outgoing.id === boundary.outgoing.id && selectedTransition?.incoming.id === boundary.incoming.id}
                  style={`left: ${timelinePercent(boundary.at)}%`}
                  title={boundary.type ? `Crossfade · ${boundary.duration.toFixed(2)}s` : 'Drop a transition here'}
                  aria-label={boundary.type ? `Select crossfade between ${boundary.outgoing.assetName} and ${boundary.incoming.assetName}` : `Add transition between ${boundary.outgoing.assetName} and ${boundary.incoming.assetName}`}
                  on:dragover|preventDefault|stopPropagation
                  on:drop={(event) => onDropTransition(event, boundary)}
                  on:click|stopPropagation={() => onSelectTransition(boundary)}
                >
                  {boundary.type ? '×' : '+'}
                </button>
              {/each}
            </div>
          </div>
      {/each}

      {#if timelineRows.length === 0 && timelineClipTracks.every((track) => track.clips.length === 0 && track.elements.length === 0) && !audioName}
        <div class="me-timeline-empty"><Layers3 size={16} /><span>No timeline layers yet. Add text or drag media here to begin.</span></div>
      {/if}
    </div>

    <audio bind:this={audioElement} on:loadedmetadata={() => onAudioMetadata(audioElement.duration)}></audio>
  </section>

