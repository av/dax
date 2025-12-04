import { sceneEvents } from './events';
import { showInfo, showWarning } from '@/ui/components/NotificationToast';
import type { Beacon, Vector3 } from '@/types';

/**
 * Tracks agent proximity to beacons and emits events
 */
export class BeaconTracker {
  private beacons: Map<string, Beacon> = new Map();
  private agentInRange: Set<string> = new Set();
  private notifyCooldowns: Map<string, number> = new Map();
  
  private static readonly NOTIFY_COOLDOWN_MS = 30000; // 30 seconds between notifications

  /**
   * Update the list of tracked beacons
   */
  public updateBeacons(beacons: Beacon[]): void {
    const newBeaconIds = new Set(beacons.map((b) => b.id));
    
    // Remove old beacons
    for (const id of this.beacons.keys()) {
      if (!newBeaconIds.has(id)) {
        this.beacons.delete(id);
        this.agentInRange.delete(id);
        this.notifyCooldowns.delete(id);
      }
    }
    
    // Add/update beacons
    for (const beacon of beacons) {
      this.beacons.set(beacon.id, beacon);
    }
  }

  /**
   * Check agent position against all beacons
   */
  public checkAgentPosition(agentPosition: Vector3): void {
    const now = Date.now();
    
    for (const [beaconId, beacon] of this.beacons) {
      if (!beacon.isActive) continue;
      
      const distance = this.calculateDistance(agentPosition, beacon.position);
      const wasInRange = this.agentInRange.has(beaconId);
      const isNowInRange = distance <= beacon.radius;
      
      if (isNowInRange && !wasInRange) {
        // Agent entered beacon range
        this.agentInRange.add(beaconId);
        
        sceneEvents.emit('beacon:range:entered', {
          beaconId,
          agentDistance: distance,
        });
        
        // Handle notify beacon
        if (beacon.beaconType === 'notify') {
          this.handleNotifyBeacon(beacon, distance, now);
        }
        
        // Handle pause beacon
        if (beacon.beaconType === 'pause') {
          this.handlePauseBeacon(beacon);
        }
        
      } else if (!isNowInRange && wasInRange) {
        // Agent exited beacon range
        this.agentInRange.delete(beaconId);
        
        sceneEvents.emit('beacon:range:exited', { beaconId });
      }
    }
  }

  /**
   * Handle notify beacon - alert user
   */
  private handleNotifyBeacon(beacon: Beacon, distance: number, now: number): void {
    const lastNotify = this.notifyCooldowns.get(beacon.id) ?? 0;
    
    if (now - lastNotify < BeaconTracker.NOTIFY_COOLDOWN_MS) {
      return; // Still in cooldown
    }
    
    this.notifyCooldowns.set(beacon.id, now);
    
    const label = beacon.label ?? 'Notify beacon';
    showInfo(`Agent entered: ${label}`, `Distance: ${distance.toFixed(1)} units`);
  }

  /**
   * Handle pause beacon - emit pause command
   */
  private handlePauseBeacon(beacon: Beacon): void {
    const label = beacon.label ?? 'Pause zone';
    showWarning(`Agent paused: ${label}`, 'Agent will pause in this zone');
    
    sceneEvents.emit('command:agent:pause', {});
  }

  /**
   * Calculate distance between two points (XZ plane)
   */
  private calculateDistance(a: Vector3, b: Vector3): number {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Get all beacons where agent is currently in range
   */
  public getBeaconsInRange(): Beacon[] {
    const beacons: Beacon[] = [];
    for (const beaconId of this.agentInRange) {
      const beacon = this.beacons.get(beaconId);
      if (beacon) {
        beacons.push(beacon);
      }
    }
    return beacons;
  }

  /**
   * Check if agent is in any beacon's range
   */
  public isAgentInAnyRange(): boolean {
    return this.agentInRange.size > 0;
  }

  /**
   * Get beacons of a specific type that agent is in range of
   */
  public getBeaconsInRangeByType(type: Beacon['beaconType']): Beacon[] {
    return this.getBeaconsInRange().filter((b) => b.beaconType === type);
  }

  /**
   * Clear all tracking state
   */
  public clear(): void {
    this.beacons.clear();
    this.agentInRange.clear();
    this.notifyCooldowns.clear();
  }
}
