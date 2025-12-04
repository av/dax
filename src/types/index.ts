export type {
  Vector3,
  DataObject,
  DataObjectType,
  FileObject,
  FileCategory,
  FilePreview,
  Snippet,
  TextRange,
  Boundary,
  BoundaryAction,
  BoundaryInstruction,
  Beacon,
  BeaconType,
  AnyDataObject,
} from './objects';

export {
  createVector3,
  createDefaultDataObject,
} from './objects';

// Common types and constants
export type { Base3DConfig, WithDefaults } from './common';
export { COLORS, SIZES, EMISSIVE, mergeConfig } from './common';

export type {
  Workspace,
  WorkspaceSettings,
  CameraState,
} from './workspace';

export {
  createWorkspace,
  createDefaultCameraState,
  createDefaultWorkspaceSettings,
} from './workspace';

export type {
  Agent,
  AgentState,
  AgentConfig,
  AgentPersonality,
  Goal,
  GoalType,
  GoalStatus,
  GoalResult,
  AgentMessage,
  AgentMessageType,
  StateChangeMessage,
  GoalCreatedMessage,
  ThoughtMessage,
  ObservationMessage,
  QuestionMessage,
  ActionMessage,
  AgentAction,
  AnyAgentMessage,
  ChatMessage,
  UserCommand,
  UserCommandType,
} from './agent';

export {
  createAgent,
  createGoal,
  createDefaultAgentConfig,
} from './agent';
