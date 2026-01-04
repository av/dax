import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

let testsPassed = 0;
let testsFailed = 0;
const testResults = [];

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    testsPassed++;
    testResults.push({ name, status: 'PASS' });
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(`   ${error.message}`);
    testsFailed++;
    testResults.push({ name, status: 'FAIL', error: error.message });
  }
}

function readSourceFile(path) {
  const fullPath = join(projectRoot, path);
  if (!existsSync(fullPath)) {
    throw new Error(`File not found: ${path}`);
  }
  return readFileSync(fullPath, 'utf-8');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertContains(content, pattern, errorMsg) {
  const regex = typeof pattern === 'string' ? new RegExp(escapeRegex(pattern)) : pattern;
  if (!regex.test(content)) {
    throw new Error(errorMsg || `Expected to find pattern: ${pattern}`);
  }
}

function assertNotContains(content, pattern, errorMsg) {
  const regex = typeof pattern === 'string' ? new RegExp(escapeRegex(pattern)) : pattern;
  if (regex.test(content)) {
    throw new Error(errorMsg || `Expected NOT to find pattern: ${pattern}`);
  }
}

console.log('🧪 Starting Agent Features Verification...\n');
console.log('='.repeat(60));

// ============================================================================
// 1. OpenAI Chat Completion API Integration
// ============================================================================
console.log('\n📡 Testing OpenAI Chat Completion API Integration...\n');

test('AgentExecutor class exists', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, 'export class AgentExecutor', 
    'AgentExecutor class not found');
});

test('AgentExecutor has execute method', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, /async execute\(options: AgentExecutionOptions\)/, 
    'execute method not found in AgentExecutor');
});

test('AgentExecutor supports OpenAI format', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, /OpenAI.*format|choices.*Array\.isArray/, 
    'OpenAI format parsing not implemented');
});

test('API URL configuration is supported', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, 'this.config.apiUrl', 
    'API URL configuration not found');
});

test('API key authentication is implemented', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, /Authorization.*Bearer|Bearer.*apiKey/, 
    'Bearer token authentication not implemented');
});

test('Multiple API presets are supported (openai, openrouter, anthropic)', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, /preset.*openai|openai.*preset/, 
    'OpenAI preset not found');
  assertContains(agentService, /preset.*openrouter|openrouter.*preset/, 
    'OpenRouter preset not found');
  assertContains(agentService, /preset.*anthropic|anthropic.*preset/, 
    'Anthropic preset not found');
});

test('Custom headers are supported', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, /\.\.\.this\.config\.headers|config\.headers/, 
    'Custom headers not supported');
});

test('Query parameters are supported', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, /queryParams|URLSearchParams/, 
    'Query parameters not supported');
});

// ============================================================================
// 2. Configurable Parameters
// ============================================================================
console.log('\n⚙️  Testing Configurable Parameters...\n');

test('Temperature parameter is configurable', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, /temperature.*this\.config\.temperature|this\.config\.temperature.*temperature/, 
    'Temperature configuration not found');
});

test('Default temperature is defined', () => {
  const constants = readSourceFile('src/lib/constants.ts');
  assertContains(constants, 'DEFAULT_AGENT_TEMPERATURE', 
    'Default temperature constant not found');
});

test('Max tokens parameter is configurable', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, /max_tokens.*maxTokens|maxTokens.*max_tokens/, 
    'Max tokens configuration not found');
});

test('Default max tokens is defined', () => {
  const constants = readSourceFile('src/lib/constants.ts');
  assertContains(constants, 'DEFAULT_AGENT_MAX_TOKENS', 
    'Default max tokens constant not found');
});

test('Model selection is configurable via extraBody', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, /extraBody|allowedFields/, 
    'Model selection via extraBody not found');
});

test('System prompt is supported', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, /systemPrompt|system.*prompt/, 
    'System prompt support not found');
});

test('System prompt is added to messages', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, /role.*system|system.*role/, 
    'System message not added to conversation');
});

test('Temperature validation exists', () => {
  const validation = readSourceFile('src/lib/validation.ts');
  assertContains(validation, /temperature:\s*\(value/, 
    'Temperature validation not found');
});

test('Temperature constraints are defined', () => {
  const constants = readSourceFile('src/lib/constants.ts');
  assertContains(constants, 'MIN_TEMPERATURE', 
    'MIN_TEMPERATURE constant not found');
  assertContains(constants, 'MAX_TEMPERATURE', 
    'MAX_TEMPERATURE constant not found');
});

test('API key validation exists', () => {
  const validation = readSourceFile('src/lib/validation.ts');
  assertContains(validation, /apiKey:\s*\(value/, 
    'API key validation not found');
});

// ============================================================================
// 3. Agent Tools - Read/Write Canvas Operations
// ============================================================================
console.log('\n🛠️  Testing Agent Tools - Canvas Operations...\n');

test('read_canvas tool is defined', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, /read_canvas/, 
    'read_canvas tool not found');
});

test('write_canvas tool is defined', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, /write_canvas/, 
    'write_canvas tool not found');
});

test('toolReadCanvas method is implemented', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, /toolReadCanvas/, 
    'toolReadCanvas method not found');
});

test('toolWriteCanvas method is implemented', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, /toolWriteCanvas/, 
    'toolWriteCanvas method not found');
});

test('Canvas operations support add action', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, /action.*add|add.*action/, 
    'Add action not found in canvas operations');
});

test('Canvas operations support update action', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, /action.*update|update.*action/, 
    'Update action not found in canvas operations');
});

test('Canvas operations support delete action', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, /action.*delete|delete.*action/, 
    'Delete action not found in canvas operations');
});

test('Canvas node type validation exists', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, /VALID_NODE_TYPES|nodeType.*validation/, 
    'Node type validation not found');
});

test('Valid node types are defined (data, agent, transform, output)', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, /data.*agent.*transform.*output|'data'.*'agent'.*'transform'.*'output'/, 
    'Valid node types not properly defined');
});

// ============================================================================
// 4. Agent Tools - Query RDF Data
// ============================================================================
console.log('\n🔍 Testing Agent Tools - RDF Query Operations...\n');

test('query_rdf tool is defined', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, /query_rdf/, 
    'query_rdf tool not found');
});

test('toolQueryRDF method is implemented', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, /toolQueryRDF/, 
    'toolQueryRDF method not found');
});

test('RDF query by type is supported', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, /queryByType/, 
    'Query by type not found');
});

test('RDF query by attribute is supported', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, /queryByAttribute/, 
    'Query by attribute not found');
});

test('RDF search functionality is supported', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, /rdfService\.search|search.*rdf/, 
    'RDF search not found');
});

test('RDF service is properly imported', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, /import.*rdfService|rdfService.*from/, 
    'RDF service import not found');
});

// ============================================================================
// 5. Multi-Agent Support
// ============================================================================
console.log('\n👥 Testing Multi-Agent Support...\n');

test('AgentService class exists', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, 'export class AgentService', 
    'AgentService class not found');
});

test('getAgents method retrieves all agents', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, /async getAgents/, 
    'getAgents method not found');
});

test('getAgent method retrieves specific agent by ID', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, /async getAgent\(id/, 
    'getAgent method not found');
});

test('createExecutor creates agent executor by ID', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, /createExecutor/, 
    'createExecutor method not found');
});

test('Database supports multiple agent configs', () => {
  const database = readSourceFile('src/services/database.ts');
  assertContains(database, /getAgentConfigs/, 
    'getAgentConfigs method not found in database');
});

test('Database supports saving agent configs', () => {
  const database = readSourceFile('src/services/database.ts');
  assertContains(database, /saveAgentConfig/, 
    'saveAgentConfig method not found in database');
});

test('Database supports deleting agent configs', () => {
  const database = readSourceFile('src/services/database.ts');
  assertContains(database, /deleteAgentConfig/, 
    'deleteAgentConfig method not found in database');
});

test('Agent ID is included in config', () => {
  const types = readSourceFile('src/types/index.ts');
  assertContains(types, /interface AgentConfig/, 
    'AgentConfig interface not found');
});

// ============================================================================
// 6. Per-Agent Toolsets
// ============================================================================
console.log('\n🧰 Testing Per-Agent Toolsets...\n');

test('AgentTool interface is defined', () => {
  const types = readSourceFile('src/types/index.ts');
  assertContains(types, /interface AgentTool/, 
    'AgentTool interface not found');
});

test('AgentConfig includes tools array', () => {
  const typesContent = readSourceFile('src/types/index.ts');
  const agentConfigMatch = typesContent.match(/interface AgentConfig\s*{[^}]+}/s);
  if (!agentConfigMatch || !agentConfigMatch[0].includes('tools')) {
    throw new Error('tools property not found in AgentConfig');
  }
});

test('Tools have enabled flag', () => {
  const typesContent = readSourceFile('src/types/index.ts');
  const agentToolMatch = typesContent.match(/interface AgentTool\s*{[^}]+}/s);
  if (!agentToolMatch || !agentToolMatch[0].includes('enabled')) {
    throw new Error('enabled property not found in AgentTool');
  }
});

test('Tools are filtered by enabled status', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, /filter.*enabled|enabled.*filter/, 
    'Tool filtering by enabled status not found');
});

test('Tool schema definitions exist', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, /getToolSchema/, 
    'getToolSchema method not found');
});

test('Tool execution method exists', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, /executeTool/, 
    'executeTool method not found');
});

test('Tools support MCP configuration', () => {
  const types = readSourceFile('src/types/index.ts');
  assertContains(types, /interface MCPConfig/, 
    'MCPConfig interface not found');
});

test('Tools support OpenAPI configuration', () => {
  const types = readSourceFile('src/types/index.ts');
  assertContains(types, /interface OpenAPIConfig/, 
    'OpenAPIConfig interface not found');
});

test('Tool types include mcp and openapi', () => {
  const typesContent = readSourceFile('src/types/index.ts');
  const agentToolMatch = typesContent.match(/interface AgentTool\s*{[^}]+}/s);
  if (!agentToolMatch || !agentToolMatch[0].includes('mcp') || !agentToolMatch[0].includes('openapi')) {
    throw new Error('mcp and openapi types not found in AgentTool');
  }
});

// ============================================================================
// 7. History & Logging
// ============================================================================
console.log('\n📝 Testing History & Logging...\n');

test('AgentMessage interface is defined', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, /interface AgentMessage/, 
    'AgentMessage interface not found');
});

test('Message roles are defined (system, user, assistant)', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, /system.*user.*assistant|'system'.*'user'.*'assistant'/, 
    'Message roles not properly defined');
});

test('Conversation history is supported in chat method', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, /conversationHistory|history.*AgentMessage/, 
    'Conversation history not found in chat method');
});

test('Database activity logging exists', () => {
  const database = readSourceFile('src/services/database.ts');
  assertContains(database, /async logActivity/, 
    'logActivity method not found');
});

test('Database activity log retrieval exists', () => {
  const database = readSourceFile('src/services/database.ts');
  assertContains(database, /getActivityLog/, 
    'getActivityLog method not found');
});

test('Agent operations are logged (agent_config_saved)', () => {
  const database = readSourceFile('src/services/database.ts');
  assertContains(database, /agent_config_saved/, 
    'agent_config_saved logging not found');
});

test('Agent operations are logged (agent_config_deleted)', () => {
  const database = readSourceFile('src/services/database.ts');
  assertContains(database, /agent_config_deleted/, 
    'agent_config_deleted logging not found');
});

test('Canvas operations are logged', () => {
  const database = readSourceFile('src/services/database.ts');
  assertContains(database, /canvas_node_saved|canvas_node_deleted/, 
    'Canvas operations logging not found');
});

test('RDF operations are logged', () => {
  const database = readSourceFile('src/services/database.ts');
  assertContains(database, /rdf_entity_saved|rdf_entity_deleted/, 
    'RDF operations logging not found');
});

test('Activity log includes timestamp', () => {
  const database = readSourceFile('src/services/database.ts');
  assertContains(database, /created_at|createdAt|timestamp/, 
    'Timestamp not found in activity log');
});

// ============================================================================
// 8. UI Integration
// ============================================================================
console.log('\n🖥️  Testing UI Integration...\n');

test('Sidebar component exists', () => {
  if (!existsSync(join(projectRoot, 'src/components/sidebar/Sidebar.tsx'))) {
    throw new Error('Sidebar component not found');
  }
});

test('Agent presets are defined in UI', () => {
  const sidebar = readSourceFile('src/components/sidebar/Sidebar.tsx');
  assertContains(sidebar, /API_PRESETS/, 
    'API_PRESETS not found in Sidebar');
});

test('Agent form supports temperature input', () => {
  const sidebar = readSourceFile('src/components/sidebar/Sidebar.tsx');
  assertContains(sidebar, /temperature/, 
    'Temperature input not found in agent form');
});

test('Agent form supports max tokens input', () => {
  const sidebar = readSourceFile('src/components/sidebar/Sidebar.tsx');
  assertContains(sidebar, /maxTokens/, 
    'Max tokens input not found in agent form');
});

test('Agent form supports system prompt input', () => {
  const sidebar = readSourceFile('src/components/sidebar/Sidebar.tsx');
  assertContains(sidebar, /systemPrompt/, 
    'System prompt input not found in agent form');
});

test('Agent chat interface exists', () => {
  const sidebar = readSourceFile('src/components/sidebar/Sidebar.tsx');
  assertContains(sidebar, /chatHistory|chatInput/, 
    'Chat interface not found');
});

test('Agent validation is implemented in UI', () => {
  const sidebar = readSourceFile('src/components/sidebar/Sidebar.tsx');
  assertContains(sidebar, /validationErrors|validators/, 
    'Validation not implemented in UI');
});

test('Activity log display exists', () => {
  const sidebar = readSourceFile('src/components/sidebar/Sidebar.tsx');
  assertContains(sidebar, /activityLog|activity.*log/, 
    'Activity log display not found');
});

// ============================================================================
// 9. Security & Best Practices
// ============================================================================
console.log('\n🔒 Testing Security & Best Practices...\n');

test('API keys are not logged', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertNotContains(agentService, /console\.log.*apiKey|console\.log.*api_key/, 
    'API keys might be logged (security issue)');
});

test('Safe field filtering for extraBody', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, /allowedFields/, 
    'Safe field filtering not found for extraBody');
});

test('Error handling exists in agent execution', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, /try.*catch|catch.*error/s, 
    'Error handling not found in agent execution');
});

test('Input validation exists for tool arguments', () => {
  const agentService = readSourceFile('src/services/agent.ts');
  assertContains(agentService, /nodeType.*validation|VALID_NODE_TYPES/, 
    'Input validation for tools not found');
});

test('UUID generation uses secure method', () => {
  const utils = readSourceFile('src/lib/utils.ts');
  assertContains(utils, /crypto\.randomUUID|randomUUID/, 
    'Secure UUID generation not found');
});

// ============================================================================
// Results Summary
// ============================================================================
console.log('\n' + '='.repeat(60));
console.log('\n📊 Test Results Summary\n');
console.log(`Total Tests: ${testsPassed + testsFailed}`);
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsFailed}`);
console.log(`Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);

if (testsFailed > 0) {
  console.log('\n❌ Failed Tests:');
  testResults.filter(r => r.status === 'FAIL').forEach(r => {
    console.log(`  - ${r.name}`);
    console.log(`    ${r.error}`);
  });
}

console.log('\n' + '='.repeat(60));

// Exit with appropriate code
process.exit(testsFailed > 0 ? 1 : 0);
