import type { Agent, AgentState, Goal, Vector3, AgentConfig, AnyAgentMessage, Boundary, BoundaryInstruction } from '@/types';
import { createAgent } from '@/types';
import { AgentAvatar } from '@/objects/AgentAvatar';
import { sceneEvents } from '@/engine/events';
import { useAgentStore } from '@/ui/stores/agentStore';
import { useSceneStore } from '@/ui/stores/sceneStore';
import { v4 as uuidv4 } from 'uuid';
import type { ApprovalRequest } from '@/ui/components/ApprovalDialog';

export type StateTransitionHandler = (from: AgentState, to: AgentState) => void;
export type ApprovalCallback = (approved: boolean, reason?: string) => void;

export interface AgentManagerConfig {
  movementSpeed: number;
  analysisTime: number;
  thinkingTime: number;
  autoSelectGoals: boolean;
  requireApprovalForExecution: boolean;
}

const DEFAULT_CONFIG: AgentManagerConfig = {
  movementSpeed: 3,
  analysisTime: 2000, // ms
  thinkingTime: 1500, // ms
  autoSelectGoals: true,
  requireApprovalForExecution: true,
};

/**
 * Agent state machine and controller
 * Manages agent behavior, state transitions, and goal execution
 */
export class AgentManager {
  private agent: Agent;
  private avatar: AgentAvatar | null = null;
  private config: AgentManagerConfig;
  
  private stateHandlers: Map<AgentState, () => void> = new Map();
  private transitionListeners: StateTransitionHandler[] = [];
  
  private isInitialized: boolean = false;
  private updateInterval: number | null = null;
  private analysisTimeout: number | null = null;
  private thinkingTimeout: number | null = null;

  // Approval workflow
  private pendingApprovals: Map<string, { request: ApprovalRequest; callback: ApprovalCallback }> = new Map();
  private approvalListeners: Array<(request: ApprovalRequest) => void> = [];

  constructor(config: Partial<AgentManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.agent = createAgent(uuidv4(), 'Dax');
    
    this.setupStateHandlers();
    this.setupEventListeners();
  }

  /**
   * Initialize the agent with a 3D avatar
   */
  public initialize(spawnPosition: Vector3 = { x: 0, y: 0.5, z: 0 }): AgentAvatar {
    // Update agent position
    this.agent.position = spawnPosition;
    
    // Create 3D avatar
    this.avatar = new AgentAvatar(this.agent);
    this.avatar.setMovementSpeed(this.config.movementSpeed);
    
    // Sync with store
    const store = useAgentStore.getState();
    store.initializeAgent(this.agent.id, this.agent.name);
    store.updateAgentPosition(spawnPosition);
    
    this.isInitialized = true;
    
    // Start update loop
    this.startUpdateLoop();
    
    // Emit initialization message
    this.emitStateChange('idle', 'idle', 'Agent initialized and ready');
    
    return this.avatar;
  }

  /**
   * Get the 3D avatar
   */
  public getAvatar(): AgentAvatar | null {
    return this.avatar;
  }

  /**
   * Get the agent data
   */
  public getAgent(): Agent {
    return this.agent;
  }

  /**
   * Update the agent configuration
   */
  public updateConfig(config: Partial<AgentConfig>): void {
    this.agent.config = { ...this.agent.config, ...config };
    this.agent.updatedAt = Date.now();
  }

  private setupStateHandlers(): void {
    this.stateHandlers.set('idle', this.handleIdleState.bind(this));
    this.stateHandlers.set('moving', this.handleMovingState.bind(this));
    this.stateHandlers.set('analyzing', this.handleAnalyzingState.bind(this));
    this.stateHandlers.set('thinking', this.handleThinkingState.bind(this));
    this.stateHandlers.set('executing', this.handleExecutingState.bind(this));
    this.stateHandlers.set('waiting', this.handleWaitingState.bind(this));
    this.stateHandlers.set('paused', this.handlePausedState.bind(this));
  }

  private setupEventListeners(): void {
    // Listen for command events from UI
    sceneEvents.on('command:agent:goto', (data) => {
      this.moveTo(data.position);
    });
    
    sceneEvents.on('command:agent:focus-object', (data) => {
      this.focusOnObject(data.objectId);
    });
    
    sceneEvents.on('command:agent:pause', () => {
      this.pause();
    });
    
    sceneEvents.on('command:agent:resume', () => {
      this.resume();
    });

    // Listen for boundary events
    sceneEvents.on('boundary:entered', (data) => {
      this.handleBoundaryEntered(data.boundaryId, data.objectIds);
    });

    sceneEvents.on('boundary:exited', (data) => {
      this.handleBoundaryExited(data.boundaryId, data.objectIds);
    });
  }

  /**
   * Handle objects entering a boundary - apply boundary instructions
   */
  private handleBoundaryEntered(boundaryId: string, objectIds: string[]): void {
    const sceneStore = useSceneStore.getState();
    const boundary = sceneStore.getBoundary(boundaryId);
    
    if (!boundary || !boundary.isActive) return;
    
    // Process boundary instructions for the entered objects
    for (const instruction of boundary.instructions) {
      this.processBoundaryInstruction(instruction, objectIds, boundary);
    }
  }

  /**
   * Handle objects exiting a boundary
   */
  private handleBoundaryExited(_boundaryId: string, _objectIds: string[]): void {
    // Objects exited boundary - could cancel pending instructions
    // For now, we just log this event
  }

  /**
   * Process a single boundary instruction
   */
  private processBoundaryInstruction(
    instruction: BoundaryInstruction,
    objectIds: string[],
    boundary: Boundary
  ): void {
    // Skip if agent is paused or not initialized
    if (!this.isInitialized || this.agent.state === 'paused') return;

    switch (instruction.action) {
      case 'organize':
        this.createOrganizeGoal(objectIds, boundary.label ?? 'Unnamed boundary', instruction.priority);
        break;
      
      case 'summarize':
        this.createSummarizeGoal(objectIds, boundary.label ?? 'Unnamed boundary', instruction.priority);
        break;
      
      case 'review':
        this.createReviewGoal(objectIds, boundary.label ?? 'Unnamed boundary', instruction.priority);
        break;
      
      case 'ignore':
        // Don't process objects in this zone
        break;
      
      case 'protect':
        // Mark objects as protected (read-only)
        // This would be handled by the UI/editor
        break;
      
      case 'custom':
        // Handle custom instruction text
        const customText = instruction.parameters['text'] as string | undefined;
        if (customText) {
          this.createCustomGoal(objectIds, customText, boundary.label ?? 'Unnamed boundary', instruction.priority);
        }
        break;
    }
  }

  /**
   * Create an organize goal from boundary instruction
   */
  private createOrganizeGoal(objectIds: string[], zoneName: string, priority: number): void {
    const goal: Goal = {
      id: uuidv4(),
      type: 'organize',
      title: `Organize files in ${zoneName}`,
      description: `Organize ${objectIds.length} file(s) according to the zone instructions`,
      status: 'pending',
      priority,
      targetObjectIds: objectIds,
      progress: 0,
      reasoning: `Objects entered the "${zoneName}" zone with organize instruction`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    useAgentStore.getState().addGoal(goal);
  }

  /**
   * Create a summarize goal from boundary instruction
   */
  private createSummarizeGoal(objectIds: string[], zoneName: string, priority: number): void {
    const goal: Goal = {
      id: uuidv4(),
      type: 'summarize',
      title: `Summarize files in ${zoneName}`,
      description: `Create summaries for ${objectIds.length} file(s) in the zone`,
      status: 'pending',
      priority,
      targetObjectIds: objectIds,
      progress: 0,
      reasoning: `Objects entered the "${zoneName}" zone with summarize instruction`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    useAgentStore.getState().addGoal(goal);
  }

  /**
   * Create a review goal from boundary instruction
   */
  private createReviewGoal(objectIds: string[], zoneName: string, priority: number): void {
    const goal: Goal = {
      id: uuidv4(),
      type: 'review',
      title: `Review files in ${zoneName}`,
      description: `Perform code review for ${objectIds.length} file(s) in the zone`,
      status: 'pending',
      priority,
      targetObjectIds: objectIds,
      progress: 0,
      reasoning: `Objects entered the "${zoneName}" zone with review instruction`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    useAgentStore.getState().addGoal(goal);
  }

  /**
   * Create a custom goal from boundary instruction
   */
  private createCustomGoal(objectIds: string[], customText: string, zoneName: string, priority: number): void {
    const goal: Goal = {
      id: uuidv4(),
      type: 'custom',
      title: `Custom task: ${customText.substring(0, 50)}${customText.length > 50 ? '...' : ''}`,
      description: `${customText}\n\nApplies to ${objectIds.length} file(s) in ${zoneName}`,
      status: 'pending',
      priority,
      targetObjectIds: objectIds,
      progress: 0,
      reasoning: `Objects entered the "${zoneName}" zone with custom instruction`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    useAgentStore.getState().addGoal(goal);
  }

  private startUpdateLoop(): void {
    if (this.updateInterval !== null) return;
    
    let lastTime = performance.now();
    
    const update = () => {
      const currentTime = performance.now();
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;
      
      this.update(deltaTime);
      
      this.updateInterval = requestAnimationFrame(update) as unknown as number;
    };
    
    this.updateInterval = requestAnimationFrame(update) as unknown as number;
  }

  private stopUpdateLoop(): void {
    if (this.updateInterval !== null) {
      cancelAnimationFrame(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Main update loop
   */
  public update(deltaTime: number): void {
    if (!this.isInitialized || !this.avatar) return;
    
    // Update avatar animation
    const stillMoving = this.avatar.update(deltaTime);
    
    // Handle movement completion
    if (this.agent.state === 'moving' && !stillMoving) {
      this.onArrival();
    }
    
    // Sync position with store
    const position = this.avatar.getPosition();
    if (
      position.x !== this.agent.position.x ||
      position.y !== this.agent.position.y ||
      position.z !== this.agent.position.z
    ) {
      this.agent.position = position;
      useAgentStore.getState().updateAgentPosition(position);
      
      sceneEvents.emit('agent:moved', {
        position,
        state: this.agent.state,
      });
    }
    
    // Run current state handler
    const handler = this.stateHandlers.get(this.agent.state);
    if (handler) {
      handler();
    }
  }

  /**
   * Transition to a new state
   */
  public transitionTo(newState: AgentState, reason: string = ''): void {
    if (this.agent.state === newState) return;
    
    const previousState = this.agent.state;
    this.agent.state = newState;
    this.agent.updatedAt = Date.now();
    
    // Update avatar visuals
    if (this.avatar) {
      this.avatar.updateState(newState);
    }
    
    // Update store
    useAgentStore.getState().updateAgentState(newState);
    
    // Notify listeners
    this.transitionListeners.forEach((listener) => {
      listener(previousState, newState);
    });
    
    // Emit event
    this.emitStateChange(previousState, newState, reason);
    
    // Clear any pending timeouts
    this.clearTimeouts();
  }

  private clearTimeouts(): void {
    if (this.analysisTimeout !== null) {
      clearTimeout(this.analysisTimeout);
      this.analysisTimeout = null;
    }
    if (this.thinkingTimeout !== null) {
      clearTimeout(this.thinkingTimeout);
      this.thinkingTimeout = null;
    }
  }

  private emitStateChange(from: AgentState, to: AgentState, reason: string): void {
    const message: AnyAgentMessage = {
      id: uuidv4(),
      timestamp: Date.now(),
      type: 'state_change',
      from,
      to,
      reason,
    } as AnyAgentMessage;
    
    useAgentStore.getState().addMessage(message);
  }

  /**
   * Move agent to a target position
   */
  public moveTo(position: Vector3): void {
    if (this.agent.state === 'paused') return;
    
    this.agent.targetPosition = position;
    
    if (this.avatar) {
      this.avatar.setTargetPosition(position);
      this.avatar.updatePath([this.agent.position, position]);
    }
    
    useAgentStore.getState().setAgentTarget(position);
    
    this.transitionTo('moving', `Moving to position (${position.x.toFixed(1)}, ${position.z.toFixed(1)})`);
    
    sceneEvents.emit('agent:path:updated', {
      waypoints: [this.agent.position, position],
    });
  }

  /**
   * Focus on a specific object
   */
  public focusOnObject(objectId: string, objectPosition?: Vector3): void {
    if (this.agent.state === 'paused') return;
    
    this.agent.focusedObjectId = objectId;
    
    if (this.avatar && objectPosition) {
      this.avatar.setFocusedObject(objectId, objectPosition);
    }
    
    useAgentStore.getState().setAgentTarget(objectPosition, objectId);
    
    if (objectPosition) {
      // Move to the object first
      const approachPosition: Vector3 = {
        x: objectPosition.x + 1.5,
        y: 0.5,
        z: objectPosition.z + 1.5,
      };
      this.moveTo(approachPosition);
    } else {
      // Already near, start analyzing
      this.transitionTo('analyzing', `Analyzing object ${objectId}`);
    }
    
    sceneEvents.emit('agent:focus:start', { objectId });
  }

  /**
   * Called when agent arrives at target position
   */
  private onArrival(): void {
    this.avatar?.hidePath();
    
    if (this.agent.focusedObjectId) {
      // Start analyzing the focused object
      this.transitionTo('analyzing', `Arrived at object ${this.agent.focusedObjectId}`);
    } else {
      // Return to idle
      this.transitionTo('idle', 'Arrived at destination');
    }
  }

  /**
   * Pause the agent
   */
  public pause(): void {
    if (this.agent.state === 'paused') return;
    
    this.transitionTo('paused', 'Paused by user');
  }

  /**
   * Resume from paused state
   */
  public resume(): void {
    if (this.agent.state !== 'paused') return;
    
    // Resume to appropriate state based on current goal
    if (this.agent.targetPosition) {
      this.transitionTo('moving', 'Resumed movement');
    } else if (this.agent.focusedObjectId) {
      this.transitionTo('analyzing', 'Resumed analysis');
    } else {
      this.transitionTo('idle', 'Resumed - awaiting tasks');
    }
  }

  /**
   * Set a goal for the agent
   */
  public setGoal(goal: Goal): void {
    this.agent.currentGoalId = goal.id;
    useAgentStore.getState().addGoal(goal);
    useAgentStore.getState().setCurrentGoal(goal.id);
    
    // If goal has target objects, focus on the first one
    if (goal.targetObjectIds.length > 0) {
      const firstTarget = goal.targetObjectIds[0];
      if (firstTarget) {
        this.focusOnObject(firstTarget);
      }
    }
  }

  /**
   * Add a listener for state transitions
   */
  public onTransition(listener: StateTransitionHandler): () => void {
    this.transitionListeners.push(listener);
    return () => {
      const index = this.transitionListeners.indexOf(listener);
      if (index >= 0) {
        this.transitionListeners.splice(index, 1);
      }
    };
  }

  // State handlers

  private handleIdleState(): void {
    // In idle state, check for pending goals if auto-select is enabled
    if (this.config.autoSelectGoals) {
      const pendingGoals = useAgentStore.getState().getPendingGoals();
      if (pendingGoals.length > 0) {
        const nextGoal = pendingGoals[0];
        if (nextGoal) {
          this.setGoal(nextGoal);
        }
      }
    }
  }

  private handleMovingState(): void {
    // Movement is handled in update loop
  }

  private handleAnalyzingState(): void {
    // Start analysis timer if not already started
    if (this.analysisTimeout === null) {
      this.analysisTimeout = window.setTimeout(() => {
        this.analysisTimeout = null;
        // Analysis complete, transition to thinking for LLM processing
        this.transitionTo('thinking', 'Processing analysis results');
      }, this.config.analysisTime);
    }
  }

  private handleThinkingState(): void {
    // Start thinking timer if not already started
    if (this.thinkingTimeout === null) {
      this.thinkingTimeout = window.setTimeout(() => {
        this.thinkingTimeout = null;
        
        // Thinking complete, update goal progress
        if (this.agent.currentGoalId) {
          const store = useAgentStore.getState();
          const goal = store.getGoal(this.agent.currentGoalId);
          if (goal) {
            store.updateGoal(goal.id, {
              status: 'completed',
              progress: 100,
              completedAt: Date.now(),
            });
          }
          
          // Clear focus
          if (this.agent.focusedObjectId) {
            sceneEvents.emit('agent:focus:end', { objectId: this.agent.focusedObjectId });
            this.agent.focusedObjectId = undefined;
          }
          
          this.agent.currentGoalId = undefined;
          store.setCurrentGoal(undefined);
        }
        
        // Return to idle
        this.transitionTo('idle', 'Analysis complete');
      }, this.config.thinkingTime);
    }
  }

  private handleExecutingState(): void {
    // Code execution is handled by sandbox system
  }

  private handleWaitingState(): void {
    // Waiting for user input (e.g., approval)
  }

  private handlePausedState(): void {
    // Do nothing while paused
  }

  // === Approval Workflow Methods ===

  /**
   * Request approval for an action
   * Returns a promise that resolves when approved or rejects when denied
   */
  public requestApproval(request: Omit<ApprovalRequest, 'id' | 'timestamp'>): Promise<void> {
    return new Promise((resolve, reject) => {
      const fullRequest: ApprovalRequest = {
        ...request,
        id: uuidv4(),
        timestamp: Date.now(),
      };

      const callback: ApprovalCallback = (approved: boolean, reason?: string) => {
        this.pendingApprovals.delete(fullRequest.id);
        
        if (approved) {
          resolve();
        } else {
          reject(new Error(reason || 'Action rejected by user'));
        }
      };

      // Store pending approval
      this.pendingApprovals.set(fullRequest.id, { request: fullRequest, callback });

      // Transition to waiting state
      this.transitionTo('waiting', `Awaiting approval: ${fullRequest.title}`);

      // Notify listeners
      this.approvalListeners.forEach((listener) => listener(fullRequest));
    });
  }

  /**
   * Request approval for code execution
   */
  public async requestCodeExecutionApproval(
    code: string,
    language: string,
    description?: string
  ): Promise<void> {
    if (!this.config.requireApprovalForExecution) {
      return; // Skip approval if not required
    }

    const risks: string[] = [];
    
    // Analyze code for potential risks
    if (code.toLowerCase().includes('delete') || code.toLowerCase().includes('remove')) {
      risks.push('Code may delete files or data');
    }
    if (code.toLowerCase().includes('write') || code.toLowerCase().includes('save')) {
      risks.push('Code may modify files');
    }
    if (code.toLowerCase().includes('http') || code.toLowerCase().includes('fetch') || code.toLowerCase().includes('request')) {
      risks.push('Code may make network requests');
    }

    await this.requestApproval({
      type: 'execute-code',
      title: 'Code Execution Request',
      description: description || `The agent wants to execute ${language} code`,
      details: {
        code,
        language,
      },
      risks: risks.length > 0 ? risks : undefined,
    });
  }

  /**
   * Request approval for file modification
   */
  public async requestFileModificationApproval(
    filePath: string,
    action: 'modify' | 'delete',
    description?: string
  ): Promise<void> {
    if (!this.config.requireApprovalForExecution) {
      return; // Skip approval if not required
    }

    await this.requestApproval({
      type: action === 'delete' ? 'delete-file' : 'modify-file',
      title: action === 'delete' ? 'File Deletion Request' : 'File Modification Request',
      description: description || `The agent wants to ${action} a file`,
      details: {
        filePath,
      },
      risks: action === 'delete' ? ['This action cannot be undone'] : undefined,
    });
  }

  /**
   * Handle approval from UI
   */
  public handleApproval(requestId: string): void {
    const pending = this.pendingApprovals.get(requestId);
    if (pending) {
      pending.callback(true);
      
      // Resume from waiting state
      if (this.agent.state === 'waiting') {
        this.transitionTo('executing', 'Approval granted, executing action');
      }
    }
  }

  /**
   * Handle rejection from UI
   */
  public handleRejection(requestId: string, reason?: string): void {
    const pending = this.pendingApprovals.get(requestId);
    if (pending) {
      pending.callback(false, reason);
      
      // Return to idle state
      if (this.agent.state === 'waiting') {
        this.transitionTo('idle', reason ? `Rejected: ${reason}` : 'Action rejected by user');
      }
    }
  }

  /**
   * Add a listener for approval requests
   */
  public onApprovalRequest(listener: (request: ApprovalRequest) => void): () => void {
    this.approvalListeners.push(listener);
    return () => {
      const index = this.approvalListeners.indexOf(listener);
      if (index >= 0) {
        this.approvalListeners.splice(index, 1);
      }
    };
  }

  /**
   * Get pending approval requests
   */
  public getPendingApprovals(): ApprovalRequest[] {
    return Array.from(this.pendingApprovals.values()).map((p) => p.request);
  }

  /**
   * Check if there are pending approvals
   */
  public hasPendingApprovals(): boolean {
    return this.pendingApprovals.size > 0;
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.stopUpdateLoop();
    this.clearTimeouts();
    
    // Reject all pending approvals
    this.pendingApprovals.forEach((pending) => {
      pending.callback(false, 'Agent disposed');
    });
    this.pendingApprovals.clear();
    this.approvalListeners = [];
    
    if (this.avatar) {
      this.avatar.dispose();
      this.avatar = null;
    }
    
    this.transitionListeners = [];
    this.isInitialized = false;
  }
}
