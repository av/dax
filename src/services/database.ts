import { createClient, Client } from '@libsql/client';
import { ACLEntry, User, CanvasNode, RDFEntity, RDFLink, Preferences, AgentConfig } from '@/types';
import { MigrationRunner } from './migrationRunner';

export interface DatabaseConfig {
  url: string;
  authToken?: string;
}

export class DatabaseService {
  private client: Client;
  private initialized: boolean = false;

  constructor(config: DatabaseConfig) {
    this.client = createClient({
      url: config.url,
      authToken: config.authToken,
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Run migrations
    const migrationRunner = new MigrationRunner(this.client);
    await migrationRunner.runMigrations();

    // Create default admin user if not exists
    await this.createDefaultAdmin();
    
    this.initialized = true;
  }

  private async createDefaultAdmin(): Promise<void> {
    const result = await this.client.execute({
      sql: 'SELECT COUNT(*) as count FROM users WHERE id = ?',
      args: ['admin'],
    });

    if (result.rows[0].count === 0) {
      await this.addUser({
        id: 'admin',
        username: 'admin',
        email: 'admin@dax.local',
        role: 'admin',
        permissions: ['*'],
      });
    }
  }

  // User Management
  async addUser(user: User): Promise<void> {
    await this.client.execute({
      sql: `INSERT INTO users (id, username, email, role, permissions) 
            VALUES (?, ?, ?, ?, ?)`,
      args: [user.id, user.username, user.email, user.role, JSON.stringify(user.permissions)],
    });

    await this.logActivity(user.id, 'user_created', 'user', user.id, { username: user.username });
  }

  async getUser(userId: string): Promise<User | null> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM users WHERE id = ?',
      args: [userId],
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id as string,
      username: row.username as string,
      email: row.email as string,
      role: row.role as 'admin' | 'user' | 'viewer',
      permissions: JSON.parse(row.permissions as string),
    };
  }

  // Canvas Nodes Management
  async saveCanvasNode(node: CanvasNode, userId: string): Promise<void> {
    await this.client.execute({
      sql: `INSERT OR REPLACE INTO canvas_nodes 
            (id, user_id, type, title, x, y, width, height, data, config, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      args: [
        node.id,
        userId,
        node.type,
        node.title,
        node.x,
        node.y,
        node.width,
        node.height,
        JSON.stringify(node.data),
        JSON.stringify(node.config || {}),
      ],
    });

    await this.logActivity(userId, 'canvas_node_saved', 'canvas_node', node.id, { title: node.title });
  }

  async getCanvasNodes(userId: string): Promise<CanvasNode[]> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM canvas_nodes WHERE user_id = ?',
      args: [userId],
    });

    return result.rows.map(row => ({
      id: row.id as string,
      type: row.type as 'data' | 'agent' | 'transform' | 'output',
      title: row.title as string,
      x: row.x as number,
      y: row.y as number,
      width: row.width as number,
      height: row.height as number,
      data: JSON.parse(row.data as string || '{}'),
      config: JSON.parse(row.config as string || '{}'),
    }));
  }

  async deleteCanvasNode(nodeId: string, userId: string): Promise<void> {
    if (!await this.checkPermission(userId, nodeId, 'canvas_node', 'delete')) {
      throw new Error('Permission denied');
    }

    await this.client.execute({
      sql: 'DELETE FROM canvas_nodes WHERE id = ? AND user_id = ?',
      args: [nodeId, userId],
    });

    await this.logActivity(userId, 'canvas_node_deleted', 'canvas_node', nodeId, {});
  }

  // RDF Entity Management
  async saveRDFEntity(entity: RDFEntity, userId: string): Promise<void> {
    await this.client.execute({
      sql: `INSERT OR REPLACE INTO rdf_entities 
            (id, user_id, type, attributes, updated_at)
            VALUES (?, ?, ?, ?, datetime('now'))`,
      args: [entity.id, userId, entity.type, JSON.stringify(entity.attributes)],
    });

    await this.logActivity(userId, 'rdf_entity_saved', 'rdf_entity', entity.id, { type: entity.type });
  }

  async getRDFEntities(userId: string, type?: string): Promise<RDFEntity[]> {
    const sql = type 
      ? 'SELECT * FROM rdf_entities WHERE user_id = ? AND type = ?'
      : 'SELECT * FROM rdf_entities WHERE user_id = ?';
    
    const args = type ? [userId, type] : [userId];

    const result = await this.client.execute({ sql, args });

    const entities = result.rows.map(row => ({
      id: row.id as string,
      type: row.type as string,
      attributes: JSON.parse(row.attributes as string),
      links: [] as RDFLink[],
    }));

    // Load links for each entity
    for (const entity of entities) {
      const links = await this.getRDFLinks(userId, entity.id);
      entity.links = links;
    }

    return entities;
  }

  async saveRDFLink(link: RDFLink, userId: string): Promise<void> {
    await this.client.execute({
      sql: `INSERT INTO rdf_links (user_id, from_entity, to_entity, type, properties)
            VALUES (?, ?, ?, ?, ?)`,
      args: [userId, link.from, link.to, link.type, JSON.stringify(link.properties || {})],
    });

    await this.logActivity(userId, 'rdf_link_created', 'rdf_link', `${link.from}-${link.to}`, {});
  }

  async getRDFLinks(userId: string, entityId?: string): Promise<RDFLink[]> {
    const sql = entityId
      ? 'SELECT * FROM rdf_links WHERE user_id = ? AND (from_entity = ? OR to_entity = ?)'
      : 'SELECT * FROM rdf_links WHERE user_id = ?';
    
    const args = entityId ? [userId, entityId, entityId] : [userId];

    const result = await this.client.execute({ sql, args });

    return result.rows.map(row => ({
      from: row.from_entity as string,
      to: row.to_entity as string,
      type: row.type as string,
      properties: JSON.parse(row.properties as string || '{}'),
    }));
  }

  // Preferences Management
  async savePreferences(userId: string, prefs: Preferences): Promise<void> {
    await this.client.execute({
      sql: `INSERT OR REPLACE INTO preferences 
            (user_id, theme, autostart, data_dir, backup_enabled, backup_interval, 
             backup_location, sync_enabled, sync_provider, sync_config, language, hotkeys, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      args: [
        userId,
        prefs.theme,
        prefs.autostart ? 1 : 0,
        prefs.dataDir,
        prefs.backup.enabled ? 1 : 0,
        prefs.backup.interval,
        prefs.backup.location,
        prefs.sync.enabled ? 1 : 0,
        prefs.sync.provider || null,
        JSON.stringify(prefs.sync.config || {}),
        prefs.language,
        JSON.stringify(prefs.hotkeys),
      ],
    });

    await this.logActivity(userId, 'preferences_updated', 'preferences', userId, {});
  }

  async getPreferences(userId: string): Promise<Preferences | null> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM preferences WHERE user_id = ?',
      args: [userId],
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      theme: row.theme as 'light' | 'dark' | 'system',
      autostart: Boolean(row.autostart),
      dataDir: row.data_dir as string,
      backup: {
        enabled: Boolean(row.backup_enabled),
        interval: row.backup_interval as number,
        location: row.backup_location as string,
      },
      sync: {
        enabled: Boolean(row.sync_enabled),
        provider: row.sync_provider as string | undefined,
        config: JSON.parse(row.sync_config as string || '{}'),
      },
      language: row.language as string,
      hotkeys: JSON.parse(row.hotkeys as string),
    };
  }

  // Agent Configuration Management
  async saveAgentConfig(config: AgentConfig & { id: string }, userId: string): Promise<void> {
    await this.client.execute({
      sql: `INSERT OR REPLACE INTO agent_configs 
            (id, user_id, provider, model, api_key, temperature, max_tokens, tools, system_prompt, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      args: [
        config.id,
        userId,
        config.provider,
        config.model || null,
        config.apiKey || null,
        config.temperature || null,
        config.maxTokens || null,
        JSON.stringify(config.tools || []),
        config.systemPrompt || null,
      ],
    });

    await this.logActivity(userId, 'agent_config_saved', 'agent_config', config.id, {});
  }

  async getAgentConfigs(userId: string): Promise<(AgentConfig & { id: string })[]> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM agent_configs WHERE user_id = ?',
      args: [userId],
    });

    return result.rows.map(row => ({
      id: row.id as string,
      provider: row.provider as 'openai' | 'anthropic' | 'custom',
      model: row.model as string | undefined,
      apiKey: row.api_key as string | undefined,
      temperature: row.temperature as number | undefined,
      maxTokens: row.max_tokens as number | undefined,
      tools: JSON.parse(row.tools as string || '[]'),
      systemPrompt: row.system_prompt as string | undefined,
    }));
  }

  // Document Storage (generic)
  async store(id: string, data: any, userId: string): Promise<void> {
    if (!await this.checkPermission(userId, id, 'document', 'write')) {
      throw new Error('Permission denied');
    }

    await this.client.execute({
      sql: `INSERT OR REPLACE INTO documents (id, user_id, owner_id, data, updated_at)
            VALUES (?, ?, ?, ?, datetime('now'))`,
      args: [id, userId, userId, JSON.stringify(data)],
    });

    await this.logActivity(userId, 'document_stored', 'document', id, {});
  }

  async get(id: string, userId: string): Promise<any | null> {
    if (!await this.checkPermission(userId, id, 'document', 'read')) {
      throw new Error('Permission denied');
    }

    const result = await this.client.execute({
      sql: 'SELECT data FROM documents WHERE id = ?',
      args: [id],
    });

    if (result.rows.length === 0) return null;
    return JSON.parse(result.rows[0].data as string);
  }

  async delete(id: string, userId: string): Promise<void> {
    if (!await this.checkPermission(userId, id, 'document', 'delete')) {
      throw new Error('Permission denied');
    }

    await this.client.execute({
      sql: 'DELETE FROM documents WHERE id = ?',
      args: [id],
    });

    await this.logActivity(userId, 'document_deleted', 'document', id, {});
  }

  // Semantic Search
  async semanticSearch(query: string, userId: string): Promise<any[]> {
    // Simple search across documents and canvas nodes
    const docResults = await this.client.execute({
      sql: `SELECT d.* FROM documents d
            WHERE d.user_id = ? AND d.data LIKE ?`,
      args: [userId, `%${query}%`],
    });

    const nodeResults = await this.client.execute({
      sql: `SELECT * FROM canvas_nodes
            WHERE user_id = ? AND (title LIKE ? OR data LIKE ?)`,
      args: [userId, `%${query}%`, `%${query}%`],
    });

    const results: any[] = [];

    for (const row of docResults.rows) {
      if (await this.checkPermission(userId, row.id as string, 'document', 'read')) {
        results.push(JSON.parse(row.data as string));
      }
    }

    for (const row of nodeResults.rows) {
      if (await this.checkPermission(userId, row.id as string, 'canvas_node', 'read')) {
        results.push({
          id: row.id,
          type: 'canvas_node',
          title: row.title,
          data: JSON.parse(row.data as string || '{}'),
        });
      }
    }

    return results;
  }

  // ACL Management
  async setACL(resourceId: string, resourceType: 'canvas_node' | 'rdf_entity' | 'document', userId: string, permissions: ACLEntry['permissions']): Promise<void> {
    await this.client.execute({
      sql: `INSERT OR REPLACE INTO acl (resource_id, resource_type, user_id, permissions, updated_at)
            VALUES (?, ?, ?, ?, datetime('now'))`,
      args: [resourceId, resourceType, userId, JSON.stringify(permissions)],
    });

    await this.logActivity(userId, 'acl_updated', resourceType, resourceId, { permissions });
  }

  async getACL(resourceId: string, resourceType: string): Promise<ACLEntry[]> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM acl WHERE resource_id = ? AND resource_type = ?',
      args: [resourceId, resourceType],
    });

    return result.rows.map(row => ({
      resourceId: row.resource_id as string,
      userId: row.user_id as string,
      permissions: JSON.parse(row.permissions as string),
    }));
  }

  async checkPermission(
    userId: string,
    resourceId: string,
    resourceType: string,
    permission: 'read' | 'write' | 'delete' | 'share'
  ): Promise<boolean> {
    const user = await this.getUser(userId);
    
    // Admin has all permissions
    if (user?.role === 'admin') {
      return true;
    }

    // Check if user owns the resource
    let ownerCheck: any;
    if (resourceType === 'document') {
      ownerCheck = await this.client.execute({
        sql: 'SELECT owner_id FROM documents WHERE id = ?',
        args: [resourceId],
      });
    } else if (resourceType === 'canvas_node') {
      ownerCheck = await this.client.execute({
        sql: 'SELECT user_id FROM canvas_nodes WHERE id = ?',
        args: [resourceId],
      });
    } else if (resourceType === 'rdf_entity') {
      ownerCheck = await this.client.execute({
        sql: 'SELECT user_id FROM rdf_entities WHERE id = ?',
        args: [resourceId],
      });
    }

    if (ownerCheck && ownerCheck.rows.length > 0) {
      const ownerId = ownerCheck.rows[0].owner_id || ownerCheck.rows[0].user_id;
      if (ownerId === userId) {
        return true;
      }
    }

    // Check ACL
    const result = await this.client.execute({
      sql: 'SELECT permissions FROM acl WHERE resource_id = ? AND resource_type = ? AND user_id = ?',
      args: [resourceId, resourceType, userId],
    });

    if (result.rows.length === 0) return false;

    const permissions = JSON.parse(result.rows[0].permissions as string);
    return permissions.includes(permission);
  }

  // Activity Logging
  async logActivity(userId: string, action: string, resourceType: string | null, resourceId: string | null, details: any): Promise<void> {
    await this.client.execute({
      sql: `INSERT INTO activity_log (user_id, action, resource_type, resource_id, details)
            VALUES (?, ?, ?, ?, ?)`,
      args: [userId, action, resourceType, resourceId, JSON.stringify(details)],
    });
  }

  async getActivityLog(userId: string, limit: number = 100): Promise<any[]> {
    const result = await this.client.execute({
      sql: `SELECT * FROM activity_log WHERE user_id = ? 
            ORDER BY created_at DESC LIMIT ?`,
      args: [userId, limit],
    });

    return result.rows.map(row => ({
      id: row.id,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      details: JSON.parse(row.details as string || '{}'),
      createdAt: row.created_at,
    }));
  }

  // Statistics
  async getStats(): Promise<any> {
    const users = await this.client.execute('SELECT COUNT(*) as count FROM users');
    const nodes = await this.client.execute('SELECT COUNT(*) as count FROM canvas_nodes');
    const entities = await this.client.execute('SELECT COUNT(*) as count FROM rdf_entities');
    const documents = await this.client.execute('SELECT COUNT(*) as count FROM documents');

    return {
      totalUsers: users.rows[0].count,
      totalCanvasNodes: nodes.rows[0].count,
      totalRDFEntities: entities.rows[0].count,
      totalDocuments: documents.rows[0].count,
    };
  }

  // Cleanup
  async close(): Promise<void> {
    await this.client.close();
  }
}

// Factory function to create database instance
export async function createDatabase(config: DatabaseConfig): Promise<DatabaseService> {
  const db = new DatabaseService(config);
  await db.initialize();
  return db;
}

// For backward compatibility, export a singleton instance
// This should be initialized by the application
let databaseInstance: DatabaseService | null = null;

export async function initializeDatabase(config: DatabaseConfig): Promise<DatabaseService> {
  if (!databaseInstance) {
    databaseInstance = await createDatabase(config);
  }
  return databaseInstance;
}

export function getDatabaseInstance(): DatabaseService {
  if (!databaseInstance) {
    throw new Error('Database not initialized. Call initializeDatabase first.');
  }
  return databaseInstance;
}

export const databaseService = {
  get instance() {
    return getDatabaseInstance();
  },
};

