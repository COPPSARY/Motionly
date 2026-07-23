export type EditorNavTab = 'media' | 'audio' | 'text' | 'effects' | 'scenes' | 'ai' | 'settings';

export interface AnimationPresetDef {
  name: string;
  description: string;
  category: 'text' | 'object' | 'transition' | 'camera';
}

export interface AssetPreview {
  src: string;
  width: number;
  height: number;
  type: 'image' | 'video';
}

export interface TimelineClipDrag {
  id: string;
  kind: 'clip' | 'element' | 'audio';
  duration: number;
  grabOffset: number;
  originTrackId: string;
  startClientX: number;
  startClientY: number;
  ghostStart: number;
  ghostTrackId: string;
  valid: boolean;
  moved: boolean;
}
