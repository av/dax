# DAX - Data Agent eXplorer

A powerful canvas-based data exploration application with AI agent integration, built with Electron, React, shadcn/ui, and Tailwind CSS.

## Features

### Canvas
- **Draggable & Resizable Nodes**: Interactive node-based workspace
- **Multiple Data Sources**: 
  - Filesystem (FS)
  - HTTP/HTTPS
  - Amazon S3
  - FTP
  - Google Drive
  - SMB/CIFS
  - WebDAV
  - ZIP archives
- **Node Operations**:
  - Multi-add nodes
  - Live preview
  - Batch operations
  - Node toolbar with config

### Agent System
- **OpenAI Chat Completion API** integration
- **Configurable Parameters**:
  - Model selection
  - Temperature
  - Max tokens
  - System prompts
- **Agent Tools**:
  - Read/Write canvas operations
  - Multi-agent support
  - Per-agent toolsets
  - Query RDF data
- **History & Logging**

### RDF/Knowledge Graph
- **Entities & Attributes**: Structured data representation
- **Import & Extract**: Automatic entity extraction from data
- **Schema Generation**: Auto-generate schemas from data
- **Linkable Entities**: Create relationships between entities
- **Query Support**: SPARQL-like querying

### Preferences
- Theme: Light/Dark/System
- Autostart configuration
- Data directory management
- Backup settings
- Sync configuration
- Language selection
- Custom hotkeys

### Database
- **Turso DB**: Modern SQLite-compatible edge database
- Persistent storage for all application state
- Semantic search capabilities
- Fast SQL-based indexing
- Multi-user support with user roles
- Access Control Lists (ACL) for resource permissions
- Full-text search support
- Activity logging and audit trail

**Stored Data Models:**
- Canvas nodes and their configurations
- RDF entities and links
- User preferences and settings
- Agent configurations
- ACL permissions
- Activity logs

## Tech Stack

- **Electron**: Cross-platform desktop application
- **React 19**: Modern UI library
- **TypeScript**: Type-safe development
- **Tailwind CSS v4**: Utility-first CSS
- **shadcn/ui**: Beautiful component library
- **Vite**: Fast build tool
- **react-rnd**: Drag and resize functionality
- **Turso DB**: SQLite-compatible edge database with libSQL

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

For **local development** (default):
```env
TURSO_URL=file:dax.db
```

For **production** with Turso Cloud:
```env
TURSO_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token
```

To get a Turso database:
1. Sign up at [turso.tech](https://turso.tech)
2. Install Turso CLI: `curl -sSfL https://get.tur.so/install.sh | bash`
3. Create a database: `turso db create dax`
4. Get the URL: `turso db show dax --url`
5. Create a token: `turso db tokens create dax`

## Development

```bash
npm run dev
```

This will:
1. Start the Vite dev server on http://localhost:5173
2. Launch Electron in development mode

## Building

```bash
npm run build
```

This creates a production build in the `dist` folder.

## Packaging

```bash
npm run package
```

This creates distributable packages in the `release` folder.

## Project Structure

```
dax/
├── src/
│   ├── main/              # Electron main process
│   │   ├── main.js        # Main entry point
│   │   └── preload.js     # Preload script
│   ├── renderer/          # React application
│   ├── components/
│   │   ├── canvas/        # Canvas components
│   │   ├── sidebar/       # Sidebar components
│   │   └── ui/            # UI components (shadcn)
│   ├── services/          # Business logic
│   │   ├── dataSource.ts  # Data source connectors
│   │   ├── rdf.ts         # RDF/knowledge graph
│   │   ├── preferences.ts # User preferences
│   │   └── database.ts    # Database with ACL
│   ├── types/             # TypeScript types
│   ├── lib/               # Utilities
│   ├── App.tsx            # Main app component
│   ├── main.tsx           # React entry point
│   └── index.css          # Global styles
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

## Usage

### Creating Nodes

1. Select node type from dropdown (Data, Agent, Transform, Output)
2. Click "Add Node" to create a new node on canvas
3. Drag nodes to reposition
4. Resize nodes by dragging corners
5. Use toolbar (hover over node) for actions

### Configuring Agents

1. Open sidebar (Agent tab)
2. Configure OpenAI settings:
   - Provider (OpenAI, Anthropic, Custom)
   - Model name
   - API key
   - Temperature and token limits
   - System prompt
3. Add/remove tools in the Tools tab

### Working with Data

Each node can connect to different data sources:
- Configure source type in node settings
- Provide connection details (URL, path, credentials)
- Preview data in live mode

### RDF Operations

- Import data to extract entities
- Define relationships between entities
- Query using SPARQL-like syntax
- Auto-generate schemas from data

## Testing

Run the full test suite:

```bash
npm test
```

Run specific test suites:

```bash
npm run test:features              # General features
npm run test:agent-features        # Agent system
npm run test:rdf-features          # RDF/Knowledge graph
npm run test:preferences-features  # User preferences
npm run test:database-features     # Database functionality
```

**Test Results:**
- ✅ 28 general feature tests
- ✅ 73 agent feature tests
- ✅ 77 RDF feature tests
- ✅ 67 preferences feature tests
- ✅ 119 database feature tests
- **Total: 364 tests - 100% passing**

## Documentation

- **[Database Verification Report](DATABASE_VERIFICATION_REPORT.md)** - Comprehensive verification of all database features
- **[Database Quick Reference](DATABASE_QUICK_REFERENCE.md)** - Developer guide for database operations
- **[Agent Features Guide](AGENT_FEATURES_GUIDE.md)** - Complete agent system documentation
- **[RDF Features Documentation](RDF_FEATURES_DOCUMENTATION.md)** - Knowledge graph usage guide
- **[Architecture](ARCHITECTURE.md)** - System architecture overview

## License

ISC
