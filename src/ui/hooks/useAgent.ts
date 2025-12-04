import { useCallback, useEffect, useRef, useState } from 'react';
import { useAgentStore } from '@/ui/stores/agentStore';
import { AgentManager } from '@/agent/Agent';
import type { AgentAvatar } from '@/objects/AgentAvatar';
import type { Engine } from '@/engine';
import type { Vector3, Agent, Goal, AnyAgentMessage } from '@/types';

export interface UseAgentReturn {
  agent: Agent | null;
  goals: Map<string, Goal>;
  messages: AnyAgentMessage[];
  isInitialized: boolean;
  avatar: AgentAvatar | null;
  
  // Actions
  initialize: (engine: Engine, spawnPosition?: Vector3) => void;
  pause: () => void;
  resume: () => void;
  moveTo: (position: Vector3) => void;
  focusOnObject: (objectId: string, objectPosition?: Vector3) => void;
  dispose: () => void;
}

/**
 * Hook for managing the agent in React components
 */
export function useAgent(): UseAgentReturn {
  const agentManagerRef = useRef<AgentManager | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [avatar, setAvatar] = useState<AgentAvatar | null>(null);
  
  const agent = useAgentStore((state) => state.agent);
  const goals = useAgentStore((state) => state.goals);
  const messages = useAgentStore((state) => state.messages);

  const initialize = useCallback((engine: Engine, spawnPosition?: Vector3) => {
    if (agentManagerRef.current) {
      agentManagerRef.current.dispose();
    }

    const manager = new AgentManager();
    agentManagerRef.current = manager;

    const agentAvatar = manager.initialize(spawnPosition || { x: 0, y: 0.5, z: 0 });
    
    // Add avatar to scene via object manager
    if (engine.objectManager) {
      engine.objectManager.addAgentAvatar(agentAvatar);
    }
    
    setAvatar(agentAvatar);
    setIsInitialized(true);
  }, []);

  const pause = useCallback(() => {
    if (agentManagerRef.current) {
      agentManagerRef.current.pause();
    }
  }, []);

  const resume = useCallback(() => {
    if (agentManagerRef.current) {
      agentManagerRef.current.resume();
    }
  }, []);

  const moveTo = useCallback((position: Vector3) => {
    if (agentManagerRef.current) {
      agentManagerRef.current.moveTo(position);
    }
  }, []);

  const focusOnObject = useCallback((objectId: string, objectPosition?: Vector3) => {
    if (agentManagerRef.current) {
      agentManagerRef.current.focusOnObject(objectId, objectPosition);
    }
  }, []);

  const dispose = useCallback(() => {
    if (agentManagerRef.current) {
      agentManagerRef.current.dispose();
      agentManagerRef.current = null;
    }
    setIsInitialized(false);
    setAvatar(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (agentManagerRef.current) {
        agentManagerRef.current.dispose();
      }
    };
  }, []);

  return {
    agent,
    goals,
    messages,
    isInitialized,
    avatar,
    initialize,
    pause,
    resume,
    moveTo,
    focusOnObject,
    dispose,
  };
}

export default useAgent;
