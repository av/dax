/**
 * Mock Database Client for Browser Development
 * 
 * This provides an in-memory database implementation for testing and development
 * when running the app in a browser (not Electron) without a Turso database.
 * 
 * LIMITATIONS:
 * - All data is stored in-memory and will be lost on page reload
 * - SQL parsing is simplified and may not handle all edge cases
 * - UPDATE only handles basic SET column=? syntax
 * - INSERT assumes explicit column lists are provided
 * - Complex WHERE clauses with multiple conditions may not parse correctly
 * - LIMIT parsing assumes it's the last argument
 * - Transactions are not supported
 * - For production use, always use a real Turso database or Electron mode
 */

import { Client, ResultSet, Transaction } from '@libsql/client';
import type { User, CanvasNode, RDFEntity, RDFLink, Preferences, AgentConfig } from '@/types';

interface MockRow {
  [key: string]: any;
}

interface MockTable {
  rows: MockRow[];
  schema: string;
}

/**
 * Mock database client that implements the libSQL Client interface
 * All data is stored in-memory and will be lost on page reload
 */
export class MockDatabaseClient implements Client {
  private tables: Map<string, MockTable> = new Map();
  private _closed: boolean = false;

  constructor() {
    this.initializeTables();
  }

  private initializeTables(): void {
    // Initialize empty tables with their schemas
    this.tables.set('users', { rows: [], schema: 'users' });
    this.tables.set('canvas_nodes', { rows: [], schema: 'canvas_nodes' });
    this.tables.set('rdf_entities', { rows: [], schema: 'rdf_entities' });
    this.tables.set('rdf_links', { rows: [], schema: 'rdf_links' });
    this.tables.set('preferences', { rows: [], schema: 'preferences' });
    this.tables.set('agent_configs', { rows: [], schema: 'agent_configs' });
    this.tables.set('documents', { rows: [], schema: 'documents' });
    this.tables.set('acl', { rows: [], schema: 'acl' });
    this.tables.set('activity_log', { rows: [], schema: 'activity_log' });
    this.tables.set('migrations', { rows: [], schema: 'migrations' });
  }

  async execute(stmt: any): Promise<ResultSet> {
    if (this._closed) {
      throw new Error('Database client is closed');
    }

    const sql = typeof stmt === 'string' ? stmt : stmt.sql;
    const args = typeof stmt === 'string' ? [] : (stmt.args || []);

    // Simple SQL parser for common operations
    const sqlUpper = sql.trim().toUpperCase();
    
    // Handle migrations table queries
    if (sqlUpper.includes('CREATE TABLE IF NOT EXISTS MIGRATIONS')) {
      return { rows: [], columns: [], rowsAffected: 0 };
    }
    
    if (sqlUpper.includes('FROM MIGRATIONS')) {
      const migrations = this.tables.get('migrations')!.rows;
      return { 
        rows: migrations, 
        columns: ['version'], 
        rowsAffected: 0 
      };
    }

    // Handle other CREATE TABLE statements
    if (sqlUpper.startsWith('CREATE TABLE')) {
      return { rows: [], columns: [], rowsAffected: 0 };
    }

    // Handle CREATE INDEX statements
    if (sqlUpper.startsWith('CREATE INDEX')) {
      return { rows: [], columns: [], rowsAffected: 0 };
    }

    // Handle INSERT statements
    if (sqlUpper.startsWith('INSERT')) {
      return this.handleInsert(sql, args);
    }

    // Handle SELECT statements
    if (sqlUpper.startsWith('SELECT')) {
      return this.handleSelect(sql, args);
    }

    // Handle UPDATE statements
    if (sqlUpper.startsWith('UPDATE')) {
      return this.handleUpdate(sql, args);
    }

    // Handle DELETE statements
    if (sqlUpper.startsWith('DELETE')) {
      return this.handleDelete(sql, args);
    }

    console.warn('Unhandled SQL statement:', sql);
    return { rows: [], columns: [], rowsAffected: 0 };
  }

  private handleInsert(sql: string, args: any[]): ResultSet {
    const match = sql.match(/INSERT\s+(?:OR\s+REPLACE\s+)?INTO\s+(\w+)/i);
    if (!match) {
      throw new Error('Invalid INSERT statement');
    }

    const tableName = match[1].toLowerCase();
    const table = this.tables.get(tableName);
    
    if (!table) {
      console.warn('Table not found:', tableName);
      return { rows: [], columns: [], rowsAffected: 0 };
    }

    // Extract column names if specified
    const columnsMatch = sql.match(/\(([^)]+)\)\s+VALUES/i);
    if (columnsMatch) {
      const columns = columnsMatch[1].split(',').map(c => c.trim());
      const row: MockRow = {};
      
      columns.forEach((col, index) => {
        row[col] = args[index];
      });

      // Add timestamp if not provided
      if (!row.created_at && tableName !== 'migrations') {
        row.created_at = new Date().toISOString();
      }
      if (!row.updated_at && tableName !== 'migrations' && tableName !== 'activity_log') {
        row.updated_at = new Date().toISOString();
      }

      // Handle INSERT OR REPLACE
      if (sql.toUpperCase().includes('OR REPLACE')) {
        const idColumn = 'id';
        const existingIndex = table.rows.findIndex(r => r[idColumn] === row[idColumn]);
        if (existingIndex >= 0) {
          table.rows[existingIndex] = { ...table.rows[existingIndex], ...row, updated_at: new Date().toISOString() };
        } else {
          table.rows.push(row);
        }
      } else {
        table.rows.push(row);
      }

      return { rows: [], columns: [], rowsAffected: 1 };
    }

    return { rows: [], columns: [], rowsAffected: 0 };
  }

  private handleSelect(sql: string, args: any[]): ResultSet {
    const match = sql.match(/FROM\s+(\w+)/i);
    if (!match) {
      return { rows: [], columns: [], rowsAffected: 0 };
    }

    const tableName = match[1].toLowerCase();
    const table = this.tables.get(tableName);
    
    if (!table) {
      return { rows: [], columns: [], rowsAffected: 0 };
    }

    let filteredRows = [...table.rows];

    // Handle WHERE clause
    if (sql.toUpperCase().includes('WHERE')) {
      filteredRows = this.filterRows(filteredRows, sql, args);
    }

    // Handle ORDER BY
    if (sql.toUpperCase().includes('ORDER BY')) {
      const orderMatch = sql.match(/ORDER BY\s+(\w+)(?:\s+(ASC|DESC))?/i);
      if (orderMatch) {
        const orderColumn = orderMatch[1];
        const orderDir = orderMatch[2]?.toUpperCase() === 'DESC' ? -1 : 1;
        filteredRows.sort((a, b) => {
          if (a[orderColumn] < b[orderColumn]) return -1 * orderDir;
          if (a[orderColumn] > b[orderColumn]) return 1 * orderDir;
          return 0;
        });
      }
    }

    // Handle LIMIT
    if (sql.toUpperCase().includes('LIMIT')) {
      const limitMatch = sql.match(/LIMIT\s+\?/i);
      if (limitMatch && args.length > 0) {
        const limit = args[args.length - 1];
        filteredRows = filteredRows.slice(0, limit as number);
      }
    }

    // Handle COUNT(*)
    if (sql.toUpperCase().includes('COUNT(*)')) {
      return {
        rows: [{ count: filteredRows.length }],
        columns: ['count'],
        rowsAffected: 0
      };
    }

    return {
      rows: filteredRows,
      columns: filteredRows.length > 0 ? Object.keys(filteredRows[0]) : [],
      rowsAffected: 0
    };
  }

  private handleUpdate(sql: string, args: any[]): ResultSet {
    const match = sql.match(/UPDATE\s+(\w+)/i);
    if (!match) {
      return { rows: [], columns: [], rowsAffected: 0 };
    }

    const tableName = match[1].toLowerCase();
    const table = this.tables.get(tableName);
    
    if (!table) {
      return { rows: [], columns: [], rowsAffected: 0 };
    }

    // Parse SET clause to get column updates
    const setMatch = sql.match(/SET\s+(.+?)\s+(?:WHERE|$)/i);
    if (!setMatch) {
      return { rows: [], columns: [], rowsAffected: 0 };
    }

    // Extract column assignments (simplified parser)
    const setClauses = setMatch[1].split(',').map(s => s.trim());
    const updates: { [key: string]: any } = {};
    let argIndex = 0;

    // Parse SET assignments like "column = ?" or "column = value"
    setClauses.forEach(clause => {
      const assignMatch = clause.match(/(\w+)\s*=\s*(.+)/);
      if (assignMatch) {
        const column = assignMatch[1];
        const value = assignMatch[2].trim();
        if (value === '?') {
          updates[column] = args[argIndex++];
        } else if (value.startsWith("'") && value.endsWith("'")) {
          updates[column] = value.slice(1, -1);
        } else {
          updates[column] = value;
        }
      }
    });

    // Get WHERE args (remaining args after SET)
    const whereArgs = args.slice(argIndex);
    const filteredRows = this.filterRows(table.rows, sql, whereArgs);
    
    // Apply updates to filtered rows
    filteredRows.forEach(row => {
      Object.assign(row, updates);
      row.updated_at = new Date().toISOString();
    });

    return { rows: [], columns: [], rowsAffected: filteredRows.length };
  }

  private handleDelete(sql: string, args: any[]): ResultSet {
    const match = sql.match(/FROM\s+(\w+)/i);
    if (!match) {
      return { rows: [], columns: [], rowsAffected: 0 };
    }

    const tableName = match[1].toLowerCase();
    const table = this.tables.get(tableName);
    
    if (!table) {
      return { rows: [], columns: [], rowsAffected: 0 };
    }

    const beforeLength = table.rows.length;
    table.rows = table.rows.filter(row => !this.matchesWhere(row, sql, args));
    const rowsAffected = beforeLength - table.rows.length;

    return { rows: [], columns: [], rowsAffected };
  }

  private filterRows(rows: MockRow[], sql: string, args: any[]): MockRow[] {
    return rows.filter(row => this.matchesWhere(row, sql, args));
  }

  private matchesWhere(row: MockRow, sql: string, args: any[]): boolean {
    const whereMatch = sql.match(/WHERE\s+(.+?)(?:ORDER BY|LIMIT|$)/i);
    if (!whereMatch) return true;

    const whereClause = whereMatch[1].trim();
    
    // Simple WHERE parsing for common patterns
    // Pattern: column = ?
    const simpleMatch = whereClause.match(/(\w+)\s*=\s*\?/);
    if (simpleMatch && args.length > 0) {
      const column = simpleMatch[1];
      return row[column] === args[0];
    }

    // Pattern: column = ? AND column2 = ?
    const andParts = whereClause.split(/\s+AND\s+/i);
    let argIndex = 0;
    
    for (const part of andParts) {
      const match = part.match(/(\w+)\s*=\s*\?/);
      if (match) {
        const column = match[1];
        if (row[column] !== args[argIndex]) {
          return false;
        }
        argIndex++;
      }
    }

    return true;
  }

  async batch(statements: any[]): Promise<ResultSet[]> {
    const results: ResultSet[] = [];
    for (const stmt of statements) {
      results.push(await this.execute(stmt));
    }
    return results;
  }

  async close(): Promise<void> {
    this._closed = true;
    this.tables.clear();
  }

  get closed(): boolean {
    return this._closed;
  }

  async migrate(_statements: any[]): Promise<ResultSet[]> {
    // Mock migrations - just return success
    return [];
  }

  async transaction(_mode?: 'write' | 'read' | 'deferred'): Promise<Transaction> {
    throw new Error('Transactions not implemented in mock database');
  }

  async executeMultiple(_sql: string): Promise<void> {
    throw new Error('ExecuteMultiple not implemented in mock database');
  }

  sync(): Promise<any> {
    throw new Error('Sync not supported in mock database');
  }

  protocol: 'http' = 'http';

  async reconnect(): Promise<void> {
    // No-op for mock
  }
}
