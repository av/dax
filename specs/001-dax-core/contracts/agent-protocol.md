# Agent Protocol Contract

**Feature**: 001-dax-core | **Date**: 2024-12-04

## Overview

The Agent system manages an autonomous AI entity that navigates the data plane, analyzes objects, sets goals, and communicates with the user. This document defines the state machine, message protocols, and LLM integration patterns.

## Agent State Machine

```
                    ┌──────────────────────────────────────────────────┐
                    │                                                  │
                    ▼                                                  │
    ┌─────────┐  goal selected   ┌─────────┐  arrived   ┌──────────┐  │
    │  IDLE   │ ───────────────▶ │ MOVING  │ ─────────▶ │ ANALYZING│  │
    └─────────┘                  └─────────┘            └──────────┘  │
         ▲                            │                      │        │
         │                            │ blocked              │        │
         │                            ▼                      ▼        │
         │                       ┌─────────┐           ┌──────────┐   │
         │                       │ WAITING │           │ THINKING │   │
         │                       └─────────┘           └──────────┘   │
         │                            │                      │        │
         │                            │ input received       │        │
         │                            ▼                      ▼        │
         │                       ┌─────────┐           ┌──────────┐   │
         └───────────────────────│ PAUSED  │◀──────────│ EXECUTING│───┘
                                 └─────────┘           └──────────┘
                                      ▲
                                      │ user pauses
                                      │
                            (from any state)
```

### State Definitions

| State | Description | Transitions |
|-------|-------------|-------------|
| `IDLE` | No active goal, awaiting work | → `MOVING` (goal selected), → `PAUSED` (user) |
| `MOVING` | Pathfinding to target object | → `ANALYZING` (arrived), → `WAITING` (blocked), → `PAUSED` |
| `ANALYZING` | Examining object contents | → `THINKING` (needs LLM), → `MOVING` (next target), → `IDLE` (done) |
| `THINKING` | Waiting for LLM response | → `EXECUTING` (code needed), → `ANALYZING` (continue), → `IDLE` (done) |
| `EXECUTING` | Running sandbox code | → `ANALYZING` (result ready), → `WAITING` (approval needed) |
| `WAITING` | Blocked, needs user input | → `MOVING` (input received), → `PAUSED` |
| `PAUSED` | User explicitly paused | → Previous state (resume) |

---

## Agent Messages

### AgentMessage (Base)

```typescript
interface AgentMessage {
  id: string;
  timestamp: number;
  type: AgentMessageType;
}

type AgentMessageType =
  | 'state_change'
  | 'goal_created'
  | 'goal_updated'
  | 'goal_completed'
  | 'thought'
  | 'observation'
  | 'question'
  | 'action'
  | 'error';
```

### State Change

```typescript
interface StateChangeMessage extends AgentMessage {
  type: 'state_change';
  from: AgentState;
  to: AgentState;
  reason: string;
}

// Example
{
  type: 'state_change',
  from: 'idle',
  to: 'moving',
  reason: 'Selected goal: Analyze document.md'
}
```

### Goal Messages

```typescript
interface GoalCreatedMessage extends AgentMessage {
  type: 'goal_created';
  goal: Goal;
  reasoning: string;  // why agent created this goal
}

interface GoalUpdatedMessage extends AgentMessage {
  type: 'goal_updated';
  goalId: string;
  changes: Partial<Goal>;
  reasoning?: string;
}

interface GoalCompletedMessage extends AgentMessage {
  type: 'goal_completed';
  goalId: string;
  result: GoalResult;
  summary: string;
}
```

### Thought

Internal agent reasoning (shown in debug/verbose mode).

```typescript
interface ThoughtMessage extends AgentMessage {
  type: 'thought';
  content: string;
  context: {
    currentGoal?: string;
    focusedObject?: string;
    relevantObjects?: string[];
  };
}
```

### Observation

Agent noticed something about the workspace.

```typescript
interface ObservationMessage extends AgentMessage {
  type: 'observation';
  content: string;
  objectIds: string[];
  importance: 'low' | 'medium' | 'high';
  suggestedAction?: string;
}
```

### Question

Agent needs user input.

```typescript
interface QuestionMessage extends AgentMessage {
  type: 'question';
  content: string;
  options?: string[];  // suggested responses
  requiresResponse: boolean;
  timeoutMs?: number;  // auto-proceed after
}
```

### Action

Agent is taking/took an action.

```typescript
interface ActionMessage extends AgentMessage {
  type: 'action';
  action: AgentAction;
  status: 'planned' | 'executing' | 'completed' | 'failed';
  target?: string;  // object ID
  description: string;
}

type AgentAction =
  | 'move'
  | 'analyze'
  | 'summarize'
  | 'organize'
  | 'execute_code'
  | 'create_snippet'
  | 'modify_file'
  | 'link_objects';
```

---

## User Commands

Commands the user can send to the agent.

```typescript
interface UserCommand {
  id: string;
  timestamp: number;
  type: UserCommandType;
  payload: unknown;
}

type UserCommandType =
  | 'chat'          // natural language message
  | 'direct'        // specific instruction
  | 'pause'
  | 'resume'
  | 'cancel_goal'
  | 'set_priority'
  | 'focus_object'
  | 'approve'
  | 'deny';
```

### Chat Command

Natural language interaction.

```typescript
interface ChatCommand extends UserCommand {
  type: 'chat';
  payload: {
    message: string;
    attachedObjects?: string[];  // context objects
  };
}
```

### Direct Command

Specific instruction.

```typescript
interface DirectCommand extends UserCommand {
  type: 'direct';
  payload: {
    action: string;  // 'analyze', 'summarize', 'organize', etc.
    targets: string[];  // object IDs
    parameters?: Record<string, unknown>;
  };
}

// Example: "Summarize these files"
{
  type: 'direct',
  payload: {
    action: 'summarize',
    targets: ['file-1', 'file-2', 'file-3']
  }
}
```

### Approval Commands

```typescript
interface ApprovalCommand extends UserCommand {
  type: 'approve' | 'deny';
  payload: {
    requestId: string;  // what action was requested
    feedback?: string;  // optional user feedback
  };
}
```

---

## LLM Integration

### System Prompt Template

```typescript
const AGENT_SYSTEM_PROMPT = `
You are Dax, an AI assistant operating within a 3D spatial workspace.
You exist as a visible entity on a data plane where files and information are physical objects.

CONTEXT:
- You can see and approach objects on the plane
- Users can direct you or let you work autonomously
- You set your own goals based on workspace content
- You can execute code in a sandboxed environment

CURRENT STATE:
{{agentState}}

VISIBLE OBJECTS:
{{objectsSummary}}

ACTIVE GOALS:
{{goalslist}}

BOUNDARIES AND INSTRUCTIONS:
{{boundaryInstructions}}

RESPONSE FORMAT:
Respond with a JSON object:
{
  "thought": "your internal reasoning",
  "response": "what to say to user (if applicable)",
  "action": {
    "type": "move|analyze|summarize|execute|create|none",
    "target": "object-id or null",
    "parameters": {}
  },
  "newGoals": [{ "type": "...", "title": "...", "priority": N }],
  "goalUpdates": [{ "id": "...", "status": "...", "progress": N }]
}
`;
```

### LLM Request Context

```typescript
interface AgentLLMContext {
  state: AgentState;
  position: Vector3;
  focusedObject?: DataObjectSummary;
  nearbyObjects: DataObjectSummary[];
  activeGoals: GoalSummary[];
  recentMessages: ChatMessage[];
  boundaries: BoundarySummary[];
  beacons: BeaconSummary[];
  userCommand?: UserCommand;
}

interface DataObjectSummary {
  id: string;
  type: DataObjectType;
  name: string;
  position: Vector3;
  distance: number;  // from agent
  preview?: string;  // content excerpt
}

interface GoalSummary {
  id: string;
  type: GoalType;
  title: string;
  status: GoalStatus;
  progress: number;
}
```

### LLM Response Parsing

```typescript
interface AgentLLMResponse {
  thought: string;
  response?: string;
  action: {
    type: 'move' | 'analyze' | 'summarize' | 'execute' | 'create' | 'none';
    target?: string;
    parameters?: Record<string, unknown>;
  };
  newGoals?: Array<{
    type: GoalType;
    title: string;
    description?: string;
    priority: number;
    relatedObjects?: string[];
  }>;
  goalUpdates?: Array<{
    id: string;
    status?: GoalStatus;
    progress?: number;
  }>;
}
```

---

## Goal Lifecycle

### Goal Creation Sources

1. **Agent Autonomous**: Agent observes patterns and creates goals
2. **User Direct**: User explicitly assigns a task
3. **Boundary Triggered**: Object enters boundary with instructions
4. **Beacon Influenced**: Agent enters beacon range

### Goal Priority Queue

```typescript
interface GoalQueue {
  goals: Goal[];

  // Priority calculation
  calculatePriority(goal: Goal): number;

  // Includes:
  // - Base priority (user-set or inferred)
  // - Urgency decay (older goals get slight boost)
  // - Beacon influence (attract beacons increase priority of nearby objects)
  // - Boundary rules (some zones have priority modifiers)
  // - Dependency satisfaction (blocked goals deprioritized)
}
```

### Goal Execution Flow

```
1. Select highest priority goal from queue
2. Identify target objects
3. Plan path to first target
4. Move to target (MOVING state)
5. Analyze target (ANALYZING state)
6. If LLM needed → THINKING state
7. If code execution needed → EXECUTING state (may need approval)
8. Update goal progress
9. If goal complete → mark completed, emit result
10. Select next goal (back to 1)
```

---

## Approval Workflow

Some actions require user approval before execution.

### Approval-Required Actions

- `execute_code` - Any sandbox execution
- `modify_file` - Writing to files
- `delete_object` - Removing objects from plane
- `create_goal` (optional) - If autonomy level is 'passive'

### Approval Request

```typescript
interface ApprovalRequest {
  id: string;
  action: AgentAction;
  description: string;
  target?: string;
  risk: 'low' | 'medium' | 'high';
  preview?: string;  // what will happen
  timeoutMs?: number;  // auto-approve after (if configured)
  createdAt: number;
}
```

### Approval Flow

```
Agent decides to execute code
    │
    ▼
Create ApprovalRequest
    │
    ▼
Emit QuestionMessage to user
    │
    ▼
Agent enters WAITING state
    │
    ├─ User approves ──▶ Execute action, continue
    │
    ├─ User denies ───▶ Cancel action, adjust plan
    │
    └─ Timeout (if configured) ──▶ Auto-approve or cancel based on risk
```

---

## Agent Configuration

```typescript
interface AgentConfiguration {
  // Identity
  name: string;
  avatarModel: string;

  // Autonomy
  autonomyLevel: 'passive' | 'active' | 'proactive';
  // passive: Only acts on explicit commands
  // active: Pursues assigned goals, asks before major actions
  // proactive: Creates own goals, executes without asking (low-risk only)

  // Movement
  movementSpeed: number;  // units per second
  pathfindingPrecision: 'fast' | 'precise';

  // Analysis
  analysisDepth: 'shallow' | 'medium' | 'deep';
  // shallow: Quick summary, metadata only
  // medium: Content analysis, key points
  // deep: Full analysis, cross-references

  // LLM
  llmProvider: 'openai' | 'anthropic' | 'local';
  llmModel: string;
  llmTemperature: number;
  llmMaxTokens: number;

  // Safety
  requireApprovalFor: AgentAction[];
  maxConcurrentGoals: number;
  goalTimeoutMs: number;
}
```
