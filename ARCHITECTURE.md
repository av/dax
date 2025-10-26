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
│   │   ├── rdf.ts            # RDF/knowledge graph
│   │   ├── preferences.ts    # User preferences
│   │   └── database.ts       # Database with ACL
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

### 6. Database
- **Storage**: In-memory data store
- **Indexing**: Fast field-based indexes
- **Semantic Search**: Text-based search
- **Multi-user**: Support for multiple users
- **ACL**: Access Control Lists for resources
- **Permissions**: Read, Write, Delete, Share

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

### DatabaseService
```typescript
// Store data
await databaseService.store('doc-1', data, 'user-1');

// Search
const results = await databaseService.semanticSearch('query', 'user-1');

// Set permissions
databaseService.setACL('doc-1', 'user-2', ['read']);
```

### PreferencesService
```typescript
// Get preferences
const prefs = preferencesService.getPreferences();

// Set theme
preferencesService.setTheme('dark');

// Set hotkey
preferencesService.setHotkey('newNode', 'Ctrl+N');
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
