# Quick Start Guide

## Installation

1. Clone the repository:
```bash
git clone https://github.com/av/dax.git
cd dax
```

2. Install dependencies:
```bash
npm install
```

## Running DAX

### Development Mode

Start the development server with hot reload:

```bash
npm run dev
```

This will:
- Launch Vite dev server on http://localhost:5173
- Start Electron window automatically
- Enable hot module replacement

### Production Build

Build for production:

```bash
npm run build
```

Then run:

```bash
npm start
```

## Basic Usage

### 1. Creating Your First Node

1. Select a node type from the dropdown (Data, Agent, Transform, or Output)
2. Click the "Add Node" button
3. The node appears on the canvas at a random position

### 2. Manipulating Nodes

**Move**: Click and drag any node to reposition it

**Resize**: Click and drag the corners of a node to resize

**Duplicate**: Hover over a node to show the toolbar, click the copy icon

**Delete**: Hover over a node and click the trash icon, or use "Clear All" to remove all nodes

**Multi-Add**: Click "Multi-Add" to duplicate all current nodes

### 3. Configuring an Agent

1. Click the "Agent" tab in the right sidebar
2. Select your provider (OpenAI, Anthropic, or Custom)
3. Enter your API key
4. Configure parameters:
   - Model name (e.g., "gpt-4")
   - Temperature (0-2)
   - Max tokens
   - System prompt
5. Click "Save Configuration"

### 4. Managing Agent Tools

1. Switch to the "Tools" tab in the sidebar
2. View available tools:
   - `read_canvas`: Access canvas data
   - `write_canvas`: Modify canvas
   - `query_rdf`: Query knowledge graph
3. Click "Add" to create custom tools
4. Configure tool properties

### 5. Working with Data Sources

Each node can connect to different data sources. Configure in the node settings:

**Filesystem**:
```typescript
{
  type: 'fs',
  path: '/path/to/data'
}
```

**HTTP/API**:
```typescript
{
  type: 'http',
  url: 'https://api.example.com/data'
}
```

**S3**:
```typescript
{
  type: 's3',
  url: 's3://bucket-name/key',
  credentials: { /* AWS credentials */ }
}
```

### 6. Using the Knowledge Graph

The RDF service provides semantic data management:

```typescript
import { rdfService } from '@/services/rdf';

// Extract entities from data
const entities = rdfService.extractEntities(yourData);

// Query by type
const people = rdfService.queryByType('Person');

// Generate schema
const schema = rdfService.generateSchema(yourData);
```

### 7. Customizing Preferences

1. Click the menu icon (top-left)
2. Select "Preferences"
3. Configure:
   - **Theme**: Choose Light, Dark, or System
   - **Autostart**: Launch on system startup
   - **Data Directory**: Where to store data
   - **Backup**: Enable automated backups
   - **Hotkeys**: Customize keyboard shortcuts

### 8. Database Operations

The database service provides:

**Storing Data**:
```typescript
import { databaseService } from '@/services/database';

await databaseService.store('my-doc', { name: 'John' }, 'user-id');
```

**Semantic Search**:
```typescript
const results = await databaseService.semanticSearch('john', 'user-id');
```

**Index Search**:
```typescript
const results = await databaseService.indexSearch('name', 'John', 'user-id');
```

**Setting Permissions**:
```typescript
databaseService.setACL('my-doc', 'other-user', ['read', 'write']);
```

## Keyboard Shortcuts

Default hotkeys (customizable in preferences):

- `Ctrl+N` - New node
- `Ctrl+S` - Save (placeholder)
- `Ctrl+Z` - Undo (placeholder)
- `Ctrl+Y` - Redo (placeholder)

## Tips & Tricks

1. **Organize Your Canvas**: Group related nodes together for better visualization

2. **Use Node Types**: Differentiate nodes by type (data, agent, transform, output) for clarity

3. **Save Frequently**: While auto-save isn't implemented yet, plan to save your work

4. **Test Connections**: Verify data source connections before processing

5. **Monitor Logs**: Check the "Log" tab for system messages and errors

6. **Experiment with Agents**: Try different temperature settings and system prompts

7. **Use Multi-Add**: Quickly create variations of existing workflows

## Troubleshooting

### Electron won't start
- Ensure all dependencies are installed: `npm install`
- Try clearing node_modules: `rm -rf node_modules && npm install`

### Build fails
- Check Node.js version (requires 18+)
- Verify all dependencies: `npm list`
- Clear dist folder: `rm -rf dist`

### Canvas not responsive
- Refresh the application
- Check browser console for errors (Dev Tools: Ctrl+Shift+I)

### Theme not changing
- Verify system preferences if using "System" theme
- Clear browser cache
- Restart the application

## Next Steps

- Explore the [Architecture Documentation](./ARCHITECTURE.md)
- Read the full [README](./README.md)
- Check out example workflows (coming soon)
- Join the community discussions

## Getting Help

- GitHub Issues: Report bugs and request features
- Discussions: Ask questions and share ideas
- Documentation: Check ARCHITECTURE.md for technical details

Happy exploring with DAX! 🚀
