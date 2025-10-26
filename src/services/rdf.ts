import { RDFEntity, RDFLink } from '@/types';

export class RDFService {
  private entities: Map<string, RDFEntity> = new Map();
  private links: RDFLink[] = [];

  // Add entity
  addEntity(entity: RDFEntity): void {
    this.entities.set(entity.id, entity);
  }

  // Get entity
  getEntity(id: string): RDFEntity | undefined {
    return this.entities.get(id);
  }

  // Add link between entities
  addLink(link: RDFLink): void {
    this.links.push(link);
    
    // Add link to entities
    const fromEntity = this.entities.get(link.from);
    const toEntity = this.entities.get(link.to);
    
    if (fromEntity) {
      fromEntity.links.push(link);
    }
  }

  // Query entities by type
  queryByType(type: string): RDFEntity[] {
    return Array.from(this.entities.values()).filter(e => e.type === type);
  }

  // Query entities by attribute
  queryByAttribute(key: string, value: any): RDFEntity[] {
    return Array.from(this.entities.values()).filter(
      e => e.attributes[key] === value
    );
  }

  // Extract entities from data
  extractEntities(data: any, schema?: any): RDFEntity[] {
    const extracted: RDFEntity[] = [];
    
    // Simple extraction logic
    if (Array.isArray(data)) {
      data.forEach((item, index) => {
        const entity: RDFEntity = {
          id: `entity-${index}`,
          type: schema?.type || 'generic',
          attributes: item,
          links: [],
        };
        extracted.push(entity);
        this.addEntity(entity);
      });
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

  // SPARQL-like query
  query(query: string): RDFEntity[] {
    // Simplified query implementation
    // In production, this would parse SPARQL or similar query language
    console.log('Executing query:', query);
    return Array.from(this.entities.values());
  }

  // Get all entities
  getAllEntities(): RDFEntity[] {
    return Array.from(this.entities.values());
  }

  // Get all links
  getAllLinks(): RDFLink[] {
    return this.links;
  }

  // Clear all data
  clear(): void {
    this.entities.clear();
    this.links = [];
  }
}

export const rdfService = new RDFService();
