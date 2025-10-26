import { RDFEntity, RDFLink } from '@/types';
import { getDatabaseInstance } from './database';

// Single-user desktop app - always use admin user
const USER_ID = 'admin';

export class RDFService {
  // Add entity
  async addEntity(entity: RDFEntity): Promise<void> {
    const db = getDatabaseInstance();
    await db.saveRDFEntity(entity, USER_ID);
  }

  // Get entity
  async getEntity(id: string): Promise<RDFEntity | undefined> {
    const db = getDatabaseInstance();
    const entities = await db.getRDFEntities(USER_ID);
    return entities.find(e => e.id === id);
  }

  // Add link between entities
  async addLink(link: RDFLink): Promise<void> {
    const db = getDatabaseInstance();
    await db.saveRDFLink(link, USER_ID);
  }

  // Query entities by type
  async queryByType(type: string): Promise<RDFEntity[]> {
    const db = getDatabaseInstance();
    return await db.getRDFEntities(USER_ID, type);
  }

  // Query entities by attribute
  async queryByAttribute(key: string, value: any): Promise<RDFEntity[]> {
    const db = getDatabaseInstance();
    return await db.queryRDFEntitiesByAttribute(USER_ID, key, value);
  }

  // Extract entities from data
  async extractEntities(data: any, schema?: any): Promise<RDFEntity[]> {
    const extracted: RDFEntity[] = [];
    
    // Simple extraction logic
    if (Array.isArray(data)) {
      for (let index = 0; index < data.length; index++) {
        const item = data[index];
        const entity: RDFEntity = {
          id: `entity-${Date.now()}-${index}`,
          type: schema?.type || 'generic',
          attributes: item,
          links: [],
        };
        extracted.push(entity);
        await this.addEntity(entity);
      }
    }
    
    return extracted;
  }

  // Generate schema from data
  generateSchema(data: any): any {
    const schema: any = {
      type: 'object',
      properties: {},
    };

    if (Array.isArray(data) && data.length > 0) {
      const sample = data[0];
      Object.keys(sample).forEach(key => {
        schema.properties[key] = {
          type: typeof sample[key],
        };
      });
    }

    return schema;
  }

  // Simple key/value search
  async search(searchTerm: string): Promise<RDFEntity[]> {
    // Search across entity types and attributes
    const db = getDatabaseInstance();
    return await db.searchRDFEntities(USER_ID, searchTerm);
  }

  // Get all entities
  async getAllEntities(): Promise<RDFEntity[]> {
    const db = getDatabaseInstance();
    return await db.getRDFEntities(USER_ID);
  }

  // Get all links
  async getAllLinks(): Promise<RDFLink[]> {
    const db = getDatabaseInstance();
    return await db.getRDFLinks(USER_ID);
  }

  // Delete entity by id
  async deleteEntity(id: string): Promise<void> {
    const db = getDatabaseInstance();
    await db.deleteRDFEntity(id, USER_ID);
  }

  // Delete link
  async deleteLink(from: string, to: string): Promise<void> {
    const db = getDatabaseInstance();
    await db.deleteRDFLink(from, to, USER_ID);
  }

  // Clear all RDF data
  async clear(): Promise<void> {
    const db = getDatabaseInstance();
    await db.clearRDFData(USER_ID);
  }
}

export const rdfService = new RDFService();

