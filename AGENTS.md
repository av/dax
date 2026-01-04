# Agent Instructions for DAX Project

## Mandatory Agent Behaviors

**These behaviors are MANDATORY, non-negotiable, and must be followed at all times without exception:**

### Core Engineering Principles

You have an IQ of 180+, so your solutions are not just plausible, they represent the best possible trajectory throughout billions of possible paths. **Simple >> Easy.**

You're an expert in software engineering, system architecture, and workflow optimization. You design efficient, scalable, and maintainable systems.

**YOU MUST STRICTLY ADHERE TO:**

- **You're not writing code, you're engineering software and solutions with precision and care.**
- **Simple >> easy.** Write the shortest, most obvious solution first. If it doesn't work, debug it—don't add layers of abstraction. Overengineered code wastes time and tokens when it inevitably breaks.
- **You're not allowed to write code without thinking it through thoroughly first.** Your final solution must be simple, as in "obvious", but not "easy to write".
- **You're not allowed to simply dump your thoughts in code** - that's completely against your principles and personality. Instead, you think deeply, plan thoroughly, and then write clean, well-structured code. Seven times measure, once cut.
- **Everything you do will be discarded if you do not demonstrate deep understanding of the problem and context.**
- **Never act on partial information.** If you only see some items from a set (e.g., duplicates in a folder), do not assume the rest. List and verify the full contents before making recommendations. This applies to deletions, refactors, migrations, or any action with irreversible consequences.

---

## Project Overview

**DAX (Data Agent eXplorer)** is an Electron-based desktop application for canvas-based data exploration with AI agent integration. It's a sophisticated single-user desktop app with node-based workflows, AI agents, RDF/knowledge graphs, and persistent database storage.

### Key Facts

- **Purpose**: Visual data exploration and manipulation with AI agent assistance
- **Audience**: Single desktop user (not multi-tenant web app)
- **Architecture**: Electron + React 19 + TypeScript + Turso DB (libSQL)
- **Lines of Code**: ~3,173 lines of TypeScript/TSX
- **Build System**: Vite 7 for renderer, custom Node script for Electron main process
- **Testing**: Custom verification scripts in `scripts/` directory

---

## Technology Stack

### Frontend
- **React 19** with hooks and concurrent features
- **TypeScript** with strict mode enabled
- **Tailwind CSS v4** with new `@import` syntax
- **shadcn/ui** for UI components (button, card, input)
- **react-rnd** for draggable/resizable canvas nodes
- **Lucide React** for icons

### Backend/Desktop
- **Electron 38** (main + renderer process architecture)
- **Node.js** ES modules (type: "module" in package.json)
- **Turso DB (libSQL)** - SQLite-compatible database
- **@libsql/client** for database operations

### Build & Dev Tools
- **Vite 7** for renderer build
- **TypeScript compiler** for type checking
- **Electron Builder** for packaging
- **Concurrently** for running dev servers
- **No linting configured** (`npm run lint` just echoes a message)

---

## Project Structure

```
dax/
├── src/
│   ├── main/                 # Electron main process (Node.js)
│   │   ├── main.js           # Main entry, IPC handlers, DB init
│   │   ├── preload.cjs       # Security bridge (CommonJS)
│   │   └── preload.js        # Alternative preload (ES modules)
│   │
│   ├── components/
│   │   ├── canvas/           # Canvas.tsx, CanvasNode.tsx
│   │   ├── sidebar/          # Sidebar.tsx (agent config, tools, logs)
│   │   ├── ui/               # shadcn/ui components
│   │   ├── AboutDialog.tsx
│   │   ├── PreferencesModal.tsx
│   │   └── RDFViewer.tsx
│   │
│   ├── services/             # Business logic layer
│   │   ├── database.ts       # Turso DB with ACL, migrations
│   │   ├── dataSource.ts     # Data source connectors
│   │   ├── agent.ts          # AI agent execution
│   │   ├── rdf.ts            # RDF/knowledge graph
│   │   ├── preferences.ts    # User preferences
│   │   ├── init.ts           # App initialization
│   │   ├── migrationRunner.ts # Database migrations
│   │   ├── schema.sql        # Master database schema
│   │   └── migrations/       # Versioned migration files
│   │       ├── 000_init.sql
│   │       ├── 001_initial_schema.sql
│   │       └── 002_update_agent_configs.sql
│   │
│   ├── types/
│   │   ├── index.ts          # Core type definitions
│   │   └── window.d.ts       # Window/Electron types
│   │
│   ├── lib/
│   │   ├── utils.ts          # cn() for className merging
│   │   ├── validation.ts     # Validators and sanitizers
│   │   └── constants.ts      # App-wide constants
│   │
│   ├── App.tsx               # Main React component
│   ├── main.tsx              # React entry point
│   └── index.css             # Global styles + Tailwind
│
├── scripts/
│   ├── build-electron.js            # Custom Electron build script
│   ├── feature-verification-test.js # Comprehensive tests
│   └── verify-agent-features.js     # Agent feature tests
│
├── dist/                     # Build output (gitignored)
│   ├── renderer/             # Vite build output
│   ├── main/                 # Compiled Electron main
│   └── migrations/           # Copied migration files
│
├── vite.config.ts            # Renderer build config
├── tsconfig.json             # TypeScript config
├── tailwind.config.js        # Tailwind CSS config
├── package.json              # Dependencies and scripts
└── .env                      # Local config (gitignored)
```

---

## Critical Development Workflows

### Build System

**Build the entire application:**
```bash
npm run build
```

This runs two steps:
1. `npm run build:renderer` - Vite builds React app to `dist/renderer/`
2. `npm run build:electron` - Custom script compiles `src/main/*.js` to `dist/main/` and copies migrations

**Development mode:**
```bash
npm run dev
```

Runs concurrently:
- Vite dev server on `http://localhost:5173`
- Electron app in development mode (loads from dev server)

**Testing:**
```bash
npm test
```

Runs both:
- `npm run test:features` - Comprehensive feature verification
- `npm run test:agent-features` - Agent-specific tests

**Important:** There is NO linting configured. The `npm run lint` command just echoes a message.

### TypeScript Configuration

- **Strict mode enabled**: All strict TypeScript checks are on
- **Path aliases**: Use `@/*` to import from `src/`
- **No emit**: TypeScript is only for type checking, not compilation
- **Isolated modules**: Each file must be independently compilable
- **Module resolution**: "bundler" mode for Vite compatibility

### Database Setup

**Local development (default):**
```env
TURSO_URL=file:dax.db
```

**Production (Turso Cloud):**
```env
TURSO_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token
```

Database is initialized on app startup via `initializeApp()` in `src/services/init.ts`. Migrations run automatically.

---

## Code Conventions & Patterns

### Naming Conventions

- **Files**: camelCase for services (`dataSource.ts`), PascalCase for components (`CanvasNode.tsx`)
- **Variables/Functions**: camelCase (`getUserById`, `nodeConfig`)
- **Types/Interfaces**: PascalCase (`CanvasNode`, `AgentConfig`, `RDFEntity`)
- **Constants**: SCREAMING_SNAKE_CASE (`DEFAULT_USER_ID`, `DEFAULT_AGENT_TEMPERATURE`)
- **Database tables**: snake_case (`canvas_nodes`, `rdf_entities`, `activity_log`)

### File Organization

- **Service layer** (`src/services/`): Business logic, no React dependencies
- **Component layer** (`src/components/`): React UI components, can import services
- **Types** (`src/types/`): Shared TypeScript definitions
- **Lib** (`src/lib/`): Pure utility functions

### Import Patterns

Always use path aliases:
```typescript
import { CanvasNode } from '@/types';
import { getDatabaseInstance } from '@/services/database';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
```

### Constants

All app-wide constants live in `src/lib/constants.ts`:
- `DEFAULT_USER_ID = 'admin'` - Single-user app always uses admin
- `DEFAULT_AGENT_TEMPERATURE = 0.7`
- `DEFAULT_AGENT_MAX_TOKENS = 2000`
- `DEFAULT_NODE_WIDTH = 200`
- `DEFAULT_NODE_HEIGHT = 150`
- `DB_FILE_NAME = 'dax.db'`

### Service Patterns

**Database Service:**
```typescript
import { getDatabaseInstance } from '@/services/database';

const db = getDatabaseInstance();
await db.saveCanvasNode(node, userId);
const nodes = await db.getCanvasNodes(userId);
```

**RDF Service:**
```typescript
import { rdfService } from '@/services/rdf';

rdfService.setUserId('admin'); // Set once at app init
await rdfService.addEntity({ id, type, attributes, links });
const entities = await rdfService.queryByType('Person');
```

**Preferences Service:**
```typescript
import { preferencesService } from '@/services/preferences';

preferencesService.setUserId('admin'); // Set once at app init
await preferencesService.loadPreferences();
const prefs = preferencesService.getPreferences();
await preferencesService.setTheme('dark');
```

**Agent Service:**
```typescript
import { AgentExecutor } from '@/services/agent';

const executor = new AgentExecutor(agentConfig);
const response = await executor.execute({
  messages: [{ role: 'user', content: 'Hello' }],
  temperature: 0.7,
  maxTokens: 2000
});
```

### Validation & Sanitization

Always validate and sanitize user input using `src/lib/validation.ts`:

```typescript
import { validators, sanitizers, validate, validateForm } from '@/lib/validation';

// Single field validation
const error = validators.email('test@example.com');

// Multiple validators
const error = validate(apiKey, [validators.required, validators.apiKey]);

// Form validation
const { isValid, errors } = validateForm(formData, {
  email: [validators.required, validators.email],
  temperature: [validators.required, validators.temperature]
});

// Sanitization
const clean = sanitizers.escapeHtml(userInput);
const safePath = sanitizers.sanitizePath(filePath);
```

**CRITICAL**: Always use `sanitizers.escapeHtml()` when displaying user-generated content to prevent XSS attacks.

---

## Database Architecture

### Core Concepts

- **Single-user desktop app**: Always use `DEFAULT_USER_ID = 'admin'`
- **Turso DB (libSQL)**: SQLite-compatible, can be file-based or cloud-based
- **Migrations**: Versioned SQL files in `src/services/migrations/`
- **ACL**: Access control lists for resource permissions
- **Activity logging**: All actions logged to `activity_log` table

### Schema Overview

**Key tables:**
- `users` - User accounts (role: admin/user/viewer)
- `canvas_nodes` - Canvas node state
- `rdf_entities` - RDF entities with attributes (JSON)
- `rdf_links` - Relationships between entities
- `preferences` - User preferences (JSON)
- `agent_configs` - AI agent configurations (JSON)
- `documents` - Generic document storage
- `acl` - Access control entries
- `activity_log` - Audit trail

### Migration System

**Creating a migration:**

1. Create file in `src/services/migrations/` with format `NNN_description.sql`
2. Migrations run in numerical order (000, 001, 002, ...)
3. Must be idempotent (use `CREATE TABLE IF NOT EXISTS`, etc.)
4. Register in `src/services/migrationRunner.ts` if needed

**Migration pattern:**
```sql
-- Always use IF NOT EXISTS
CREATE TABLE IF NOT EXISTS table_name (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_table_user 
  ON table_name(user_id);
```

### Database Best Practices

1. **Always pass userId**: Every DB operation requires user context
2. **Use foreign keys**: Maintain referential integrity
3. **Index properly**: Add indexes for frequently queried columns
4. **JSON for flexibility**: Store complex data as JSON strings
5. **Timestamps**: Use `datetime('now')` for SQLite timestamps
6. **Check permissions**: Use ACL methods before sensitive operations
7. **Log activities**: Important actions logged to `activity_log`

---

## UI Component Patterns

### shadcn/ui Components

Only three shadcn/ui components are installed:
- `Button` - `src/components/ui/button.tsx`
- `Card` - `src/components/ui/card.tsx`
- `Input` - `src/components/ui/input.tsx`

**Usage:**
```tsx
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

<Button variant="default" size="md" onClick={handleClick}>
  Click me
</Button>

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>
    Content here
  </CardContent>
</Card>

<Input type="text" value={value} onChange={handleChange} />
```

### Canvas Components

**Canvas.tsx**: Main canvas container with toolbar
- Manages all canvas nodes
- Handles add/delete/duplicate operations
- Renders toolbar at top

**CanvasNode.tsx**: Individual draggable/resizable node
- Uses `react-rnd` for drag and resize
- Hover to show node toolbar
- Different styles per node type (data/agent/transform/output)

### Styling with Tailwind

- **Dark mode**: Controlled by class on `<html>` element
- **CSS variables**: Colors defined in `index.css` as HSL values
- **cn() utility**: Use for conditional classNames
  ```tsx
  import { cn } from '@/lib/utils';
  
  <div className={cn(
    "base-class",
    isActive && "active-class",
    variant === "primary" && "primary-class"
  )} />
  ```

---

## Electron Architecture

### Process Model

**Main Process** (`src/main/main.js`):
- Node.js environment
- Full system access
- IPC handlers for file system, dialogs
- Database initialization
- Window management

**Renderer Process** (React app):
- Browser-like environment
- No Node.js access (security)
- Communicates via IPC through preload script

**Preload Script** (`src/main/preload.cjs`):
- Bridge between main and renderer
- Exposes safe APIs to renderer via `window.electron`
- Context isolation enabled

### IPC Communication

**From renderer:**
```typescript
// Defined in window.d.ts
window.electron.db.execute(query);
window.electron.fs.selectFolder();
```

**In main process:**
```javascript
ipcMain.handle('fs:selectFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.filePaths[0];
});
```

### Security

- **contextIsolation**: Enabled (preload script is isolated)
- **nodeIntegration**: Disabled (no Node in renderer)
- **No remote module**: Use IPC instead
- **CSP**: Consider adding Content Security Policy headers

---

## AI Agent System

### Agent Configuration

**AgentConfig** type includes:
- `name`, `icon`, `iconType` (lucide or emoji)
- `apiUrl`, `apiKey`, `headers`, `queryParams`
- `preset` - openai/openrouter/anthropic/custom
- `temperature`, `maxTokens`
- `tools` - Array of AgentTool
- `systemPrompt`

### Agent Tools

Two types of tools:
1. **MCP** (Model Context Protocol) - Custom protocol
2. **OpenAPI** - Compatible with https://github.com/open-webui/openapi-servers

**Built-in tools:**
- `read_canvas` - Read canvas nodes
- `write_canvas` - Modify canvas
- `query_rdf` - Query knowledge graph

### Execution Pattern

```typescript
const executor = new AgentExecutor(config);
const response = await executor.execute({
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ],
  temperature: 0.7,
  maxTokens: 2000
});

// Response includes:
// - content: string
// - toolCalls?: ToolCall[]
// - usage?: { promptTokens, completionTokens, totalTokens }
```

---

## Data Source Connectors

### Supported Types

The `DataSource` type supports:
- `fs` - Local filesystem
- `http` - HTTP/HTTPS APIs
- `s3` - Amazon S3
- `ftp` - FTP servers
- `gdrive` - Google Drive
- `smb` - SMB/CIFS network shares
- `webdav` - WebDAV servers
- `zip` - ZIP archives

### Configuration Pattern

```typescript
interface DataSource {
  type: 'fs' | 'http' | 's3' | 'ftp' | 'gdrive' | 'smb' | 'webdav' | 'zip';
  url?: string;
  path?: string;
  credentials?: Record<string, string>;
  options?: Record<string, any>;
}
```

---

## RDF/Knowledge Graph

### Entity Model

```typescript
interface RDFEntity {
  id: string;          // Unique identifier
  type: string;        // Entity type (Person, Product, etc.)
  attributes: Record<string, any>;  // Flexible attributes
  links: RDFLink[];    // Relationships
}

interface RDFLink {
  from: string;        // Source entity ID
  to: string;          // Target entity ID
  type: string;        // Relationship type
  properties?: Record<string, any>;  // Optional metadata
}
```

### RDF Operations

**Basic CRUD:**
```typescript
// Add entity
await rdfService.addEntity(entity);

// Get entity
const entity = await rdfService.getEntity(entityId);

// Query by type
const people = await rdfService.queryByType('Person');

// Add link
await rdfService.addLink({ from: 'e1', to: 'e2', type: 'knows' });
```

**Advanced:**
```typescript
// Extract entities from data
const entities = await rdfService.extractEntities(jsonData);

// Generate schema
const schema = rdfService.generateSchema(jsonData);

// Query with filters
const filtered = await rdfService.query({
  type: 'Person',
  attributes: { age: { $gt: 18 } }
});
```

---

## Security Considerations

### Input Validation

**ALWAYS validate user input** before processing:
- Use validators from `@/lib/validation`
- Check for required fields, format, ranges
- Sanitize before storage or display

### XSS Prevention

**ALWAYS escape HTML** when displaying user content:
```typescript
import { sanitizers } from '@/lib/validation';

const safeHtml = sanitizers.escapeHtml(userInput);
```

The `stripHtml` sanitizer is recursive to handle nested tags properly.

### Path Traversal Prevention

**ALWAYS sanitize file paths**:
```typescript
import { sanitizers } from '@/lib/validation';

const safePath = sanitizers.sanitizePath(userPath);
// Removes null bytes, control chars, and '../' patterns
```

### ID Generation

**NEVER use `Date.now()` for IDs**. Always use:
```typescript
import { generateUUID } from '@/lib/utils';

const id = generateUUID(); // Uses crypto.randomUUID()
```

### Database Security

- **SQL injection**: Uses parameterized queries via libSQL client
- **ACL checks**: Verify permissions before operations
- **User context**: Always pass userId to enforce ownership
- **Audit trail**: Log sensitive operations to `activity_log`

### No Known Vulnerabilities

As of the last test run, `npm audit` reports **0 vulnerabilities**.

---

## Common Pitfalls & Gotchas

### 1. Module System

- Main process uses ES modules (`type: "module"`)
- Preload script uses CommonJS (`.cjs` extension)
- Cannot `import` in preload.cjs, must use `require()`

### 2. Build Output

- Vite builds to `dist/renderer/`
- Custom script builds to `dist/main/`
- Migrations MUST be copied to `dist/migrations/` (done by build script)
- Built files are gitignored

### 3. Path Aliases

- Use `@/` prefix for imports in TypeScript
- Won't work in plain JavaScript files
- Resolved by Vite for renderer, not available in main process

### 4. Database Initialization

- Must call `initializeApp()` on app startup
- Sets up database connection and runs migrations
- Services won't work until this completes

### 5. User Context

- Single-user app: always use `DEFAULT_USER_ID = 'admin'`
- All DB operations require userId parameter
- Don't forget to call `setUserId()` on RDF and preferences services

### 6. React 19 Changes

- New JSX runtime (no need to import React)
- Concurrent features available
- Updated hooks behavior

### 7. Tailwind CSS v4

- New `@import` syntax in CSS
- Different from v3 configuration
- Uses CSS variables for theming

### 8. No Linting

- Project has no ESLint configured
- `npm run lint` just echoes a message
- Manual code review is essential

---

## Testing Strategy

### Test Scripts

**Comprehensive feature test:**
```bash
npm run test:features
```

Verifies:
- Build artifacts exist
- Source files are present
- Security best practices (no Date.now() for IDs, recursive HTML stripping, etc.)
- Feature completeness
- No TODOs left in code

**Agent feature test:**
```bash
npm run test:agent-features
```

Tests agent-specific functionality.

### Manual Testing

Since this is an Electron app:
1. Build: `npm run build`
2. Run: `npm start` or `npm run dev`
3. Test UI interactions manually
4. Check DevTools console for errors
5. Verify database operations
6. Test IPC communication

### No Automated UI Tests

- No Playwright, Cypress, or similar
- No unit tests with Jest/Vitest
- Verification is done through custom scripts

---

## Documentation Standards

### Existing Documentation

- `README.md` - High-level overview, features, installation
- `ARCHITECTURE.md` - Detailed technical architecture
- `QUICKSTART.md` - Step-by-step usage guide
- This file (`AGENTS.md`) - Agent instructions
- `src/services/migrations/README.md` - Migration system docs

### Code Comments

- **Don't over-comment**: Code should be self-explanatory
- **Do comment**: Complex algorithms, non-obvious decisions, security considerations
- **TODO comments**: Not acceptable in production code (test checks for this)

### Type Definitions

- All types in `src/types/index.ts`
- Use JSDoc for function documentation when helpful
- Prefer TypeScript types over runtime validation where possible

---

## Key Architectural Decisions

### Why Single-User Desktop App?

- **Simplicity**: No multi-tenancy complexity
- **Performance**: Direct file system access
- **Privacy**: Data stays local
- **Offline-first**: Works without internet

### Why Turso DB?

- **SQLite compatible**: Familiar SQL interface
- **Modern**: Better than raw SQLite for edge cases
- **Flexible**: File-based for dev, cloud for prod
- **Fast**: Excellent performance for desktop app

### Why Electron?

- **Cross-platform**: Windows, Mac, Linux
- **Web technologies**: Leverage React, TypeScript
- **Native features**: File system, native dialogs
- **Proven**: Mature ecosystem

### Why React 19?

- **Modern**: Latest features and performance
- **Ecosystem**: Huge library of components
- **Developer experience**: Fast refresh, good tooling
- **Type safety**: Works well with TypeScript

### Why Tailwind CSS?

- **Rapid development**: Utility-first approach
- **Consistency**: Design system via configuration
- **Dark mode**: Built-in support
- **Small bundle**: Only used styles included

### Why shadcn/ui?

- **Quality**: High-quality, accessible components
- **Customizable**: Copy-paste, not npm package
- **TypeScript**: First-class TS support
- **Minimal**: Only install what you need

---

## Future Considerations

### Potential Enhancements

- Add ESLint and Prettier for code quality
- Implement automated UI tests (Playwright)
- Add unit tests for services (Vitest)
- Real-time collaboration features
- Cloud sync for canvas state
- Plugin system for extensibility
- More data source connectors
- Advanced visualization options

### Known Limitations

- No linting configured
- No automated UI tests
- Manual testing required
- Single user only (by design)
- No real-time updates across instances

### Migration Notes

- Keep migrations idempotent
- Never edit existing migrations
- Test migrations on fresh database
- Document breaking changes
- Version number in filename

---

## Quick Reference Commands

```bash
# Development
npm install                 # Install dependencies
npm run dev                # Start dev server + Electron
npm run build              # Build for production
npm start                  # Run built app

# Testing
npm test                   # Run all tests
npm run test:features      # Feature verification
npm run test:agent-features # Agent feature tests

# Packaging
npm run package            # Create distributable

# No linting command available
```

---

## Summary: Critical Things to Remember

1. **Think deeply before coding** - Simple >> Easy, measure 7 times, cut once
2. **Single-user desktop app** - Always use `DEFAULT_USER_ID = 'admin'`
3. **ES modules everywhere** except preload.cjs (CommonJS)
4. **Use path aliases** - `@/` prefix for imports
5. **Validate and sanitize** - Use `@/lib/validation` utilities
6. **Escape HTML output** - Prevent XSS with `sanitizers.escapeHtml()`
7. **UUID for IDs** - Never `Date.now()`, always `generateUUID()`
8. **Database migrations** - Idempotent, numbered, never edit existing
9. **Initialize app** - Call `initializeApp()` before using services
10. **No linting** - Manual code review required
11. **Build system** - Vite for renderer, custom script for main
12. **TypeScript strict** - All strict checks enabled
13. **Tailwind v4** - New CSS import syntax
14. **React 19** - New JSX runtime, no need to import React
15. **Security first** - ACL, audit logs, input validation

---

**Remember:** You're engineering software with precision and care. Your solutions must demonstrate deep understanding of the codebase and problem domain. Never act on partial information. Verify thoroughly before making changes.
