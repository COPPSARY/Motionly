/**
 * Motion design system.
 *
 * A component-driven layer above the native engine. The AI selects blocks —
 * showcases, layouts, beats — and this layer lowers them into ordinary Motionly
 * elements and animations. The parser, scene graph, evaluator, and canvas
 * renderer stay exactly as they were.
 *
 *   prompt → creative director → beats → component selection
 *          → motion-system lowering → .motion AST → scene graph → renderer
 */

export { ASSET_KINDS, isAssetKind, type AssetKind } from './asset-kinds';

export {
  ARRIVAL,
  DEFAULT_FRAME,
  LAYOUT_TYPES,
  RHYTHM,
  focalSlot,
  isLayoutType,
  layoutDefinition,
  layoutDefinitions,
  resolveLayout,
  type LayoutDefinition,
  type LayoutSlot,
  type LayoutSpec,
  type LayoutType,
} from './layout';

export {
  SHOWCASE_BEHAVIORS,
  SHOWCASE_TYPES,
  buildShowcase,
  isShowcaseType,
  showcaseDefinition,
  showcaseDefinitions,
  type ShowcaseComposition,
  type ShowcaseContext,
  type ShowcaseDefinition,
  type ShowcaseType,
} from './showcase';

export {
  BEAT_TRANSITION_KINDS,
  isBeatTransitionKind,
  lowerBeatTransition,
  planBeatTransition,
  requiresEndpoints,
  transitionPrompt,
  type BeatTransitionKind,
  type BeatTransitionPlan,
} from './transitions';

export { MOTION_BUDGET, STILLNESS_BEFORE_CLIMAX } from './budget';

export {
  BEAT_ROUTES,
  beatPrompt,
  beatStarts,
  isBeatRoute,
  lowerBeats,
  planBeats,
  type BeatPlan,
  type BeatPlanOptions,
  type BeatRoute,
  type BeatSpec,
  type CameraFraming,
} from './beats';

export {
  MIN_SCENE_DURATION,
  SCENE_TRANSITION_KINDS,
  classifyParticipation,
  isSceneTransitionKind,
  lowerSceneRoots,
  lowerSceneTransitions,
  planSceneTransition,
  planScenes,
  sceneAt,
  scenePrompt,
  sceneStarts,
  staticMembers,
  storyboardDuration,
  type SceneMember,
  type SceneParticipation,
  type ScenePlan,
  type ScenePlanOptions,
  type SceneSpec,
  type SceneTransitionKind,
  type SceneTransitionPlan,
} from './scenes';

export {
  migrateToScenes,
  segmentBoundaries,
  suggestIdentities,
  type MigrationOptions,
  type MigrationStrategy,
  type SceneMigration,
} from './scene-migration';

export {
  classifyAsset,
  classifyAssets,
  assetIntelligencePrompt,
  recommendPresentation,
  recommendPresentations,
  type ClassifiedAsset,
  type PresentationRecommendation,
} from './asset-intelligence';

export { doctrinePrompt } from './doctrine';

export {
  findMotionComponent,
  metadataPrompt,
  motionComponentMetadata,
  selectComponents,
  type MotionComponentMetadata,
  type MotionSystemKind,
  type SelectionQuery,
  type SelectionResult,
} from './metadata';
