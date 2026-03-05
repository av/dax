/**
 * Drizzle-orm schema definitions for all 7 database tables.
 * Uses drizzle-orm/sqlite-core for table/column definitions.
 * Actual DB access uses @tursodatabase/database via the repository layer.
 */
import { sqliteTable, text, integer, real, blob, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

// ── app_config ──
export const appConfig = sqliteTable('app_config', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// ── scene_objects ──
export const sceneObjects = sqliteTable('scene_objects', {
  id: text('id').primaryKey(),
  path: text('path').notNull().unique(),
  parentPath: text('parent_path'),
  type: text('type').notNull(), // 'file' | 'folder'
  positionX: real('position_x').notNull().default(0),
  positionY: real('position_y').notNull().default(0),
  positionZ: real('position_z').notNull().default(0),
  isPinned: integer('is_pinned').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [
  index('idx_scene_objects_path').on(table.path),
  index('idx_scene_objects_parent_path').on(table.parentPath),
]);

// ── agent_state ──
export const agentState = sqliteTable('agent_state', {
  id: text('id').primaryKey(), // always 'singleton'
  beliefs: text('beliefs').notNull(),
  desires: text('desires').notNull(),
  currentIntention: text('current_intention'),
  status: text('status').notNull().default('idle'), // 'idle' | 'thinking' | 'acting' | 'paused'
  positionX: real('position_x').notNull().default(0),
  positionZ: real('position_z').notNull().default(0),
  updatedAt: integer('updated_at').notNull(),
});

// ── agent_instructions ──
export const agentInstructions = sqliteTable('agent_instructions', {
  id: text('id').primaryKey(),
  triggerPattern: text('trigger_pattern').notNull(),
  actionDescription: text('action_description').notNull(),
  embedding: blob('embedding'),
  confidence: real('confidence').notNull().default(1.0),
  usageCount: integer('usage_count').notNull().default(0),
  lastUsed: integer('last_used'),
  isUserCreated: integer('is_user_created').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [
  index('idx_instructions_trigger').on(table.triggerPattern),
  index('idx_instructions_usage').on(table.usageCount, table.lastUsed),
]);

// ── agent_action_log ──
export const agentActionLog = sqliteTable('agent_action_log', {
  id: text('id').primaryKey(),
  timestamp: integer('timestamp').notNull(),
  actionType: text('action_type').notNull(),
  targetPath: text('target_path'),
  parameters: text('parameters'),
  result: text('result').notNull(), // 'success' | 'failure'
  errorMessage: text('error_message'),
  intentionId: text('intention_id'),
  instructionId: text('instruction_id').references(() => agentInstructions.id),
  beliefSnapshot: text('belief_snapshot'),
  durationMs: integer('duration_ms'),
}, (table) => [
  index('idx_action_log_timestamp').on(table.timestamp),
  index('idx_action_log_type').on(table.actionType),
  index('idx_action_log_intention').on(table.intentionId),
]);

// ── chat_messages ──
export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey(),
  role: text('role').notNull(), // 'user' | 'agent'
  content: text('content').notNull(),
  timestamp: integer('timestamp').notNull(),
  sessionId: text('session_id'),
}, (table) => [
  index('idx_chat_messages_timestamp').on(table.timestamp),
]);

// ── keyboard_shortcuts ──
export const keyboardShortcuts = sqliteTable('keyboard_shortcuts', {
  action: text('action').primaryKey(),
  keyCombo: text('key_combo').notNull(),
  isDefault: integer('is_default').notNull().default(1),
});
