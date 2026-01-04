# Agent Features Quick Reference Guide

This guide provides a quick overview of all agent-related features in DAX and how to use them.

## Table of Contents
1. [Creating an Agent](#creating-an-agent)
2. [Configuring Agent Parameters](#configuring-agent-parameters)
3. [Using Agent Tools](#using-agent-tools)
4. [Managing Multiple Agents](#managing-multiple-agents)
5. [Viewing History & Logs](#viewing-history--logs)

---

## Creating an Agent

### Using Presets (Recommended)

1. Open the Sidebar (left panel)
2. Click the **"Agents"** tab
3. Click **"+ New Agent"** button
4. Select a preset:
   - **OpenAI** - For GPT-4, GPT-3.5, etc.
   - **OpenRouter** - For access to multiple models
   - **Anthropic** - For Claude models

### Manual Configuration

1. Create new agent
2. Configure fields:
   - **Name**: Give your agent a descriptive name
   - **Icon**: Choose Lucide icon or emoji
   - **API URL**: Enter the API endpoint
   - **API Key**: Paste your API key (stored securely)

---

## Configuring Agent Parameters

### Model Selection

In the **Extra Body** section, add model configuration:
```json
{
  "model": "gpt-4",
  "top_p": 0.9
}
```

Supported fields:
- `model` - Model identifier (e.g., "gpt-4", "claude-3-opus")
- `top_p` - Nucleus sampling (0.0 to 1.0)
- `frequency_penalty` - Reduce repetition (-2.0 to 2.0)
- `presence_penalty` - Encourage new topics (-2.0 to 2.0)
- `stop` - Stop sequences (array of strings)

### Temperature

**Range:** 0.0 to 2.0  
**Default:** 0.7

- **Lower (0.0-0.3)**: More focused and deterministic
- **Medium (0.4-0.9)**: Balanced creativity
- **Higher (1.0-2.0)**: More creative and varied

**How to set:**
1. Open agent configuration
2. Adjust the Temperature slider
3. Save changes

### Max Tokens

**Default:** 2000

Controls the maximum length of the response.

**How to set:**
1. Open agent configuration
2. Enter value in "Max Tokens" field
3. Common values: 500 (short), 2000 (medium), 4000 (long)

### System Prompts

Define the agent's behavior and personality.

**Example prompts:**
```
You are a helpful data analysis assistant. 
Always provide clear, structured responses.
```

```
You are an expert in RDF data modeling.
Help users design efficient knowledge graphs.
```

**How to set:**
1. Open agent configuration
2. Enter prompt in "System Prompt" text area
3. Save changes

---

## Using Agent Tools

### Built-in Tools

Each agent can use these tools:

#### 1. read_canvas
**Purpose:** Read nodes from the canvas

**Parameters:**
- `type` (optional): Filter by node type
  - `data` - Data source nodes
  - `agent` - Agent nodes
  - `transform` - Transformation nodes
  - `output` - Output nodes

**Example prompt:**
```
"Show me all data nodes on the canvas"
```

#### 2. write_canvas
**Purpose:** Create, update, or delete canvas nodes

**Actions:**
- `add` - Create new node
- `update` - Modify existing node
- `delete` - Remove node

**Example prompts:**
```
"Create a new data node titled 'Customer Database'"

"Update the node with ID 'node-123' to have title 'Updated Title'"

"Delete the node with ID 'node-456'"
```

#### 3. query_rdf
**Purpose:** Query the RDF knowledge graph

**Query types:**
- By type: `"Find all entities of type 'Person'"`
- By attribute: `"Find entities where age equals 25"`
- By search: `"Search for 'john'"`
- Get all: `"Show me all RDF entities"`

### Enabling/Disabling Tools

1. Open agent configuration
2. Scroll to "Tools" section
3. Click toggle switch next to each tool
4. Green = Enabled, Gray = Disabled
5. Save changes

### Adding Custom Tools

#### MCP (Model Context Protocol)
1. Click "Add Tool"
2. Select type: "MCP"
3. Configure:
   - Name
   - Description
   - Server URL
   - Methods

#### OpenAPI
1. Click "Add Tool"
2. Select type: "OpenAPI"
3. Configure:
   - Name
   - Description
   - Spec URL
   - Operations
   - Authentication

---

## Managing Multiple Agents

### Creating Multiple Agents

You can create unlimited agents, each with different:
- API providers
- Models
- Temperature settings
- System prompts
- Toolsets

**Use cases:**
- **Data Analyst** - Low temperature, focused on analysis
- **Creative Writer** - High temperature, expansive thinking
- **Technical Expert** - Specialized system prompt
- **Quick Responder** - Lower max tokens for speed

### Switching Between Agents

1. Open the "Agents" tab
2. Click on agent name in the list
3. The chat will now use that agent

### Editing Agents

1. Select agent from list
2. Click the Edit icon (pencil)
3. Modify settings
4. Click "Save"

### Deleting Agents

1. Select agent from list
2. Click the Delete icon (trash)
3. Confirm deletion

---

## Viewing History & Logs

### Conversation History

**Location:** Agents tab, chat interface

**Features:**
- Scrollable message history
- User messages vs Assistant responses
- Persists during session
- Clear button to reset

**How to clear:**
1. Click "Clear Chat" button
2. Confirm action

### Activity Log

**Location:** "Log" tab in Sidebar

**Shows:**
- All operations performed
- Timestamp for each action
- Resource type and ID
- Automatic logging

**Logged operations:**
- Agent created/deleted
- Canvas nodes added/updated/deleted
- RDF entities created/updated
- Preferences changed

**How to view:**
1. Click "Log" tab
2. Scroll through recent activities
3. Most recent shown first

---

## Tips & Best Practices

### For Best Results

1. **Use specific system prompts** - Define agent's role clearly
2. **Adjust temperature per task**:
   - Analysis: 0.1-0.3
   - General chat: 0.7
   - Creative: 1.0-1.5
3. **Enable only needed tools** - Reduces API complexity
4. **Test with different models** - Each has strengths
5. **Keep conversation history** - Provides context

### Common Issues

**Problem:** Agent not responding
- Check API key is valid
- Verify API URL is correct
- Check internet connection

**Problem:** Responses are too short
- Increase max tokens
- Adjust system prompt to be less restrictive

**Problem:** Responses are too random
- Lower temperature
- Add more specific instructions in prompt

**Problem:** Tools not working
- Ensure tools are enabled
- Check tool has correct permissions
- Verify database is accessible

---

## Security Notes

- API keys are stored securely in local database
- Never shared in logs or console
- Only transmitted in request headers
- Each user has isolated data (multi-tenancy ready)

---

## Advanced Features

### Custom Headers

Add provider-specific headers:
```
X-Custom-Header: value
HTTP-Referer: https://your-site.com
```

### Query Parameters

Add URL parameters:
```
api-version=2023-06-01
region=us-east-1
```

### Tool Configuration

Customize tool behavior via config object:
```json
{
  "serverUrl": "https://mcp-server.example.com",
  "methods": ["method1", "method2"]
}
```

---

## API Compatibility

### Supported Providers

✅ **OpenAI**
- GPT-4, GPT-3.5 Turbo
- Function calling supported
- Streaming not yet implemented

✅ **OpenRouter**
- Access to 100+ models
- Unified API format
- Model routing

✅ **Anthropic**
- Claude 3 Opus, Sonnet, Haiku
- Alternative response format
- Long context support

✅ **Custom APIs**
- Any OpenAI-compatible API
- Local LLMs (Ollama, LM Studio)
- Self-hosted models

### API Format Requirements

Endpoint must accept:
```json
{
  "messages": [
    {"role": "system", "content": "..."},
    {"role": "user", "content": "..."}
  ],
  "temperature": 0.7,
  "max_tokens": 2000,
  "tools": [...]
}
```

And return:
```json
{
  "choices": [
    {
      "message": {
        "content": "...",
        "tool_calls": [...]
      }
    }
  ],
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 50,
    "total_tokens": 150
  }
}
```

---

## Related Documentation

- [AGENT_FEATURES_VERIFICATION_REPORT.md](./AGENT_FEATURES_VERIFICATION_REPORT.md) - Full verification report
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [README.md](./README.md) - General documentation

---

**Quick Reference Version:** 1.0  
**Last Updated:** 2026-01-04  
**Verified Against:** DAX v1.0.0
