# DAX Architecture Documentation

## Overview

DAX (Data Agent eXplorer) is a modern Electron-based canvas application for exploring data with AI agents. It combines a visual node-based interface with powerful AI agent capabilities and semantic data management.

## Technology Stack

### Frontend
- **React 19**: Modern UI with hooks and concurrent features
- **TypeScript**: Type-safe development
- **Tailwind CSS v4**: Utility-first CSS with new @import syntax
- **shadcn/ui**: High-quality, accessible UI components
- **react-rnd**: Drag and drop, resize functionality for canvas nodes

### Backend/Desktop
- **Electron 38**: Cross-platform desktop application framework
- **Node.js**: Runtime for Electron main process
- **Turso DB (libSQL)**: SQLite-compatible edge database for persistent storage

### Database
- **libSQL Client (@libsql/client)**: Official Turso/libSQL client
- **Schema**: Comprehensive SQL schema with tables for all application state
- **Indexing**: SQL indexes for fast queries and full-text search support
- **Persistence**: All application state persisted to Turso database

### Build Tools
- **Vite 7**: Fast build tool and dev server
- **TypeScript Compiler**: For type checking
- **Electron Builder**: For packaging desktop apps

## Project Structure

```
dax/
├── src/
│   ├── main/                   # Electron main process
│   │   ├── main.js            # Main entry point
│   │   └── preload.js         # Security bridge for renderer
│   │
│   ├── components/
│   │   ├── canvas/            # Canvas-related components
│   │   │   ├── Canvas.tsx     # Main canvas with toolbar
│   │   │   └── CanvasNode.tsx # Individual draggable node
│   │   │
│   │   ├── sidebar/           # Sidebar components
│   │   │   └── Sidebar.tsx    # Agent config, tools, history, logs
│   │   │
│   │   └── ui/                # shadcn/ui components
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       └── input.tsx
│   │
│   ├── services/              # Business logic
│   │   ├── dataSource.ts     # Data source connectors
│   │   ├── rdf.ts            # RDF/knowledge graph (Turso-backed)
│   │   ├── preferences.ts    # User preferences (Turso-backed)
│   │   ├── database.ts       # Turso database service with ACL
│   │   ├── init.ts           # Application initialization
│   │   └── schema.sql        # Database schema definition
│   │
│   ├── types/                 # TypeScript type definitions
│   │   └── index.ts
│   │
│   ├── lib/                   # Utilities
│   │   └── utils.ts          # cn() for className merging
│   │
│   ├── App.tsx               # Main React component
│   ├── main.tsx              # React entry point
│   └── index.css             # Global styles
│
├── index.html                 # HTML entry point
├── vite.config.ts            # Vite configuration
├── tailwind.config.js        # Tailwind configuration
├── postcss.config.js         # PostCSS configuration
├── tsconfig.json             # TypeScript configuration
└── package.json              # Project metadata and scripts
```

## Core Features

### 1. Canvas System
- **Draggable Nodes**: Move nodes freely on the canvas
- **Resizable Nodes**: Adjust node size by dragging corners
- **Node Types**: 
  - Data: For data sources
  - Agent: For AI agents
  - Transform: For data transformations
  - Output: For results
- **Node Toolbar**: Appears on hover with actions:
  - Duplicate node
  - Configure settings
  - Preview data
  - Delete node
- **Batch Operations**:
  - Multi-add: Duplicate all nodes
  - Clear all: Remove all nodes

### 2. Data Sources
Supports multiple data source types:
- **Filesystem (FS)**: Local file access
- **HTTP/HTTPS**: Web APIs and endpoints
- **Amazon S3**: Cloud object storage
- **FTP**: File Transfer Protocol
- **Google Drive**: Google cloud storage
- **SMB/CIFS**: Network file sharing
- **WebDAV**: Web-based file access
- **ZIP**: Compressed archives

### 3. Agent System
- **Provider Support**: OpenAI, Anthropic, Custom
- **Configuration**:
  - Model selection
  - API key management
  - Temperature control
  - Max tokens setting
  - System prompts
- **Tools**:
  - read_canvas: Read canvas nodes
  - write_canvas: Modify canvas
  - query_rdf: Query knowledge graph
  - Custom tools

### 4. RDF/Knowledge Graph
- **Entity Management**: Create and manage entities
- **Attributes**: Store entity properties
- **Links**: Create relationships between entities
- **Extraction**: Auto-extract entities from data
- **Schema Generation**: Auto-generate schemas
- **Querying**: SPARQL-like query support

### 5. Preferences
- **Theme**: Light, Dark, or System
- **Autostart**: Launch on system startup
- **Data Directory**: Custom data location
- **Backup**: Automated backup settings
- **Sync**: Cloud sync configuration
- **Language**: Localization support
- **Hotkeys**: Custom keyboard shortcuts

### 6. Database (Turso DB)

DAX uses **Turso DB** (libSQL), a modern SQLite-compatible edge database for persistent storage of all application state.

**Key Features:**
- **Persistent Storage**: All data survives application restarts
- **SQL-based**: Standard SQL queries with SQLite compatibility
- **Fast Indexing**: SQL indexes for optimal query performance
- **Full-text Search**: Built-in FTS5 support for semantic search
- **Multi-user**: User roles (admin, user, viewer)
- **ACL**: Fine-grained access control per resource
- **Activity Logging**: Complete audit trail of all actions

**Database Tables:**
- `users`: User accounts and roles
- `canvas_nodes`: Canvas node state and configuration
- `rdf_entities`: RDF entities with attributes
- `rdf_links`: Relationships between entities
- `preferences`: User preferences and settings
- `acl`: Access control entries per resource
- `documents`: Generic document storage
- `agent_configs`: AI agent configurations
- `activity_log`: Audit trail of all actions

**Configuration:**

Local development (file-based):
```env
TURSO_URL=file:dax.db
```

Production (Turso Cloud):
```env
TURSO_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token
```

**Initialization:**
The database is automatically initialized on application startup with the complete schema from `src/services/schema.sql`. A default admin user is created if not exists.

## Development

### Setup
```bash
npm install
```

### Development Mode
```bash
npm run dev
```
This starts both Vite dev server and Electron in development mode.

### Building
```bash
npm run build
```
Creates production build in `dist/` directory.

### Packaging
```bash
npm run package
```
Creates distributable packages in `release/` directory.

## API Reference

### DataSourceService
```typescript
// Connect to a data source
await DataSourceService.connect({
  type: 'http',
  url: 'https://api.example.com/data'
});

// Read data
const data = await DataSourceService.readData(source);
```

### RDFService
```typescript
// Add entity
rdfService.addEntity({
  id: 'entity-1',
  type: 'Person',
  attributes: { name: 'John', age: 30 },
  links: []
});

// Query entities
const people = rdfService.queryByType('Person');

// Extract entities from data
const entities = rdfService.extractEntities(data);
```

### DatabaseService (Turso DB)

The database service provides persistent storage for all application state with ACL support.

**Initialization:**
```typescript
import { initializeDatabase } from '@/services/database';

// Initialize with configuration
await initializeDatabase({
  url: 'file:dax.db', // or libsql://your-db.turso.io
  authToken: 'optional-token'
});
```

**Canvas Nodes:**
```typescript
import { getDatabaseInstance } from '@/services/database';
const db = getDatabaseInstance();

// Save canvas node
await db.saveCanvasNode(node, 'user-id');

// Get all nodes for user
const nodes = await db.getCanvasNodes('user-id');

// Delete node
await db.deleteCanvasNode('node-id', 'user-id');
```

**RDF Entities:**
```typescript
// Save entity
await db.saveRDFEntity({
  id: 'entity-1',
  type: 'Person',
  attributes: { name: 'John' },
  links: []
}, 'user-id');

// Get entities by type
const people = await db.getRDFEntities('user-id', 'Person');

// Save link
await db.saveRDFLink({
  from: 'entity-1',
  to: 'entity-2',
  type: 'knows'
}, 'user-id');
```

**Preferences:**
```typescript
// Save preferences
await db.savePreferences('user-id', {
  theme: 'dark',
  language: 'en',
  // ... other preferences
});

// Get preferences
const prefs = await db.getPreferences('user-id');
```

**Agent Configurations:**
```typescript
// Save agent config
await db.saveAgentConfig({
  id: 'agent-1',
  provider: 'openai',
  model: 'gpt-4',
  temperature: 0.7
}, 'user-id');

// Get all agent configs
const configs = await db.getAgentConfigs('user-id');
```

**Generic Documents:**
```typescript
// Store document
await db.store('doc-1', { content: 'data' }, 'user-id');

// Retrieve document
const doc = await db.get('doc-1', 'user-id');

// Delete document
await db.delete('doc-1', 'user-id');
```

**Semantic Search:**
```typescript
// Search across documents and canvas nodes
const results = await db.semanticSearch('search query', 'user-id');
```

**Access Control:**
```typescript
// Set ACL for a resource
await db.setACL('doc-1', 'document', 'user-2', ['read', 'write']);

// Get ACL entries
const acl = await db.getACL('doc-1', 'document');

// Check permission
const canRead = await db.checkPermission('user-id', 'doc-1', 'document', 'read');
```

**Activity Logging:**
```typescript
// Log activity (done automatically by most operations)
await db.logActivity('user-id', 'document_created', 'document', 'doc-1', {
  title: 'My Document'
});

// Get activity log
const activities = await db.getActivityLog('user-id', 50);
```

### RDFService (Database-backed)

Now uses Turso DB for persistent storage:

```typescript
import { rdfService } from '@/services/rdf';

// Set current user
rdfService.setUserId('user-id');

// Add entity (persisted to DB)
await rdfService.addEntity({
  id: 'entity-1',
  type: 'Person',
  attributes: { name: 'John', age: 30 },
  links: []
});

// Query entities (from DB)
const people = await rdfService.queryByType('Person');

// Extract entities from data (saved to DB)
const entities = await rdfService.extractEntities(data);

// Add links (persisted to DB)
await rdfService.addLink({
  from: 'entity-1',
  to: 'entity-2',
  type: 'knows'
});
```

### PreferencesService (Database-backed)

Now uses Turso DB for persistent storage with localStorage fallback:

```typescript
import { preferencesService } from '@/services/preferences';

// Set current user
preferencesService.setUserId('user-id');

// Load preferences from DB
await preferencesService.loadPreferences();

// Get preferences
const prefs = preferencesService.getPreferences();

// Set theme (saved to DB)
await preferencesService.setTheme('dark');

// Set hotkey (saved to DB)
await preferencesService.setHotkey('newNode', 'Ctrl+N');
```


## Security

### No Vulnerabilities
All dependencies have been checked and no security vulnerabilities were found.

### Code Quality
- TypeScript for type safety
- ESLint-ready codebase
- Proper separation of concerns
- Secure Electron configuration with contextIsolation

### Access Control
- User-based permissions
- Resource-level ACL
- Admin, user, and viewer roles

## Future Enhancements

Potential areas for expansion:
1. Real-time collaboration
2. Cloud backend integration
3. Additional AI providers
4. More data source types
5. Advanced visualization options
6. Plugin system
7. Template library
8. Import/export workflows
9. Version control for canvas
10. Advanced search and filtering

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run build` to verify
5. Submit a pull request

## License

ISC
