import { ACLEntry, User } from '@/types';

// Simulated vector database for semantic search
export class DatabaseService {
  private data: Map<string, any> = new Map();
  private indexes: Map<string, Map<string, Set<string>>> = new Map();
  private users: Map<string, User> = new Map();
  private acl: Map<string, ACLEntry[]> = new Map();

  constructor() {
    // Initialize with a demo admin user
    this.users.set('admin', {
      id: 'admin',
      username: 'admin',
      email: 'admin@dax.local',
      role: 'admin',
      permissions: ['*'],
    });
  }

  // Store data
  async store(id: string, data: any, userId: string): Promise<void> {
    if (!this.checkPermission(userId, id, 'write')) {
      throw new Error('Permission denied');
    }

    this.data.set(id, {
      ...data,
      _id: id,
      _created: new Date().toISOString(),
      _updated: new Date().toISOString(),
      _owner: userId,
    });

    // Update indexes
    this.updateIndexes(id, data);
  }

  // Retrieve data
  async get(id: string, userId: string): Promise<any | null> {
    if (!this.checkPermission(userId, id, 'read')) {
      throw new Error('Permission denied');
    }

    return this.data.get(id) || null;
  }

  // Delete data
  async delete(id: string, userId: string): Promise<void> {
    if (!this.checkPermission(userId, id, 'delete')) {
      throw new Error('Permission denied');
    }

    this.data.delete(id);
    this.removeFromIndexes(id);
  }

  // Semantic search (simplified)
  async semanticSearch(query: string, userId: string): Promise<any[]> {
    const results: any[] = [];
    const queryLower = query.toLowerCase();

    for (const [id, data] of this.data.entries()) {
      if (!this.checkPermission(userId, id, 'read')) {
        continue;
      }

      // Simple text matching (in production, use embeddings)
      const dataStr = JSON.stringify(data).toLowerCase();
      if (dataStr.includes(queryLower)) {
        results.push(data);
      }
    }

    return results;
  }

  // Fast index-based search
  async indexSearch(field: string, value: any, userId: string): Promise<any[]> {
    const fieldIndex = this.indexes.get(field);
    if (!fieldIndex) {
      return [];
    }

    const ids = fieldIndex.get(String(value)) || new Set();
    const results: any[] = [];

    for (const id of ids) {
      if (this.checkPermission(userId, id, 'read')) {
        const data = this.data.get(id);
        if (data) {
          results.push(data);
        }
      }
    }

    return results;
  }

  // Update indexes
  private updateIndexes(id: string, data: any): void {
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string' || typeof value === 'number') {
        let fieldIndex = this.indexes.get(key);
        if (!fieldIndex) {
          fieldIndex = new Map();
          this.indexes.set(key, fieldIndex);
        }

        let valueSet = fieldIndex.get(String(value));
        if (!valueSet) {
          valueSet = new Set();
          fieldIndex.set(String(value), valueSet);
        }

        valueSet.add(id);
      }
    }
  }

  // Remove from indexes
  private removeFromIndexes(id: string): void {
    for (const [_, fieldIndex] of this.indexes.entries()) {
      for (const [_, valueSet] of fieldIndex.entries()) {
        valueSet.delete(id);
      }
    }
  }

  // ACL Management
  setACL(resourceId: string, userId: string, permissions: ACLEntry['permissions']): void {
    let entries = this.acl.get(resourceId);
    if (!entries) {
      entries = [];
      this.acl.set(resourceId, entries);
    }

    const existing = entries.find(e => e.userId === userId);
    if (existing) {
      existing.permissions = permissions;
    } else {
      entries.push({ resourceId, userId, permissions });
    }
  }

  getACL(resourceId: string): ACLEntry[] {
    return this.acl.get(resourceId) || [];
  }

  checkPermission(
    userId: string,
    resourceId: string,
    permission: 'read' | 'write' | 'delete' | 'share'
  ): boolean {
    const user = this.users.get(userId);
    
    // Admin has all permissions
    if (user?.role === 'admin') {
      return true;
    }

    // Check resource ownership
    const data = this.data.get(resourceId);
    if (data?._owner === userId) {
      return true;
    }

    // Check ACL
    const entries = this.acl.get(resourceId) || [];
    const entry = entries.find(e => e.userId === userId);
    
    return entry?.permissions.includes(permission) || false;
  }

  // User management
  addUser(user: User): void {
    this.users.set(user.id, user);
  }

  getUser(userId: string): User | undefined {
    return this.users.get(userId);
  }

  // Multi-user support
  async listUserResources(userId: string): Promise<any[]> {
    const results: any[] = [];

    for (const [id, data] of this.data.entries()) {
      if (this.checkPermission(userId, id, 'read')) {
        results.push(data);
      }
    }

    return results;
  }

  // Get statistics
  getStats(): any {
    return {
      totalRecords: this.data.size,
      totalIndexes: this.indexes.size,
      totalUsers: this.users.size,
      totalACLEntries: Array.from(this.acl.values()).reduce((sum, arr) => sum + arr.length, 0),
    };
  }
}

export const databaseService = new DatabaseService();
