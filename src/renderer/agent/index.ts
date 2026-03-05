/**
 * Agent barrel: re-exports for the agent module.
 */
export {
  initBDIEngine,
  disposeBDIEngine,
  pauseAgent,
  resumeAgent,
  isAgentPaused,
  isAgentRunning,
  setLoopInterval,
  getActionQueue,
  getCurrentBeliefs,
  forceBDICycle,
} from './bdi';

export {
  updateBeliefs,
  createInitialBeliefs,
  serializeBeliefs,
  deserializeBeliefs,
} from './beliefs';
export type { AgentBeliefs } from './beliefs';

export {
  evaluateDesires,
  selectTopDesire,
  SEED_DESIRES,
} from './desires';
export type { Desire } from './desires';

export {
  createIntention,
  advanceIntention,
  getCurrentStep,
  cancelIntention,
  serializeIntention,
  deserializeIntention,
} from './intentions';
export type { Intention, PlanStep } from './intentions';

export {
  BUILT_IN_CAPABILITIES,
  findCapability,
  organizeCapability,
  searchCapability,
  createCapability,
  moveCapability,
} from './capabilities';
export type { AgentCapability, CapabilityResult, CapabilityIPC } from './capabilities';

export {
  createAgentAvatar,
  getAgentAvatar,
  setAvatarStatus,
  moveAvatarTo,
  setAvatarPosition,
  getAvatarPosition,
  playAvatarAnimation,
  disposeAgentAvatar,
} from './avatar';
export type { AgentAvatar } from './avatar';

export { ActionQueue } from './action-queue';
export type {
  AnimatedAction,
  ActionResult,
  SpeedPreset,
  AgentAnimationType,
  ActionQueueCallbacks,
} from './action-queue';

export { agentBridge, createCapabilityIPC } from './agent-bridge';

export {
  levenshteinDistance,
  stringSimilarity,
  substringContainment,
  matchInstruction,
  parseTeachingInput,
  createInstruction,
  getEvictionCandidates,
  getReviewCandidates,
  generateEmbedding,
} from './learning';

export {
  processUserMessage,
  addChatMessage,
  loadChatHistory,
  loadInstructions,
  proposeAutoLearn,
  acceptAutoLearn,
  dismissAutoLearn,
  checkLLMHealth,
} from './chat-handler';
export type { ChatResult } from './chat-handler';
