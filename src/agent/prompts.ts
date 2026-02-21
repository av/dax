import { tools } from './tools';

// ── Build tool descriptions for the system prompt ─────

function buildToolDescriptions(): string {
  return tools
    .map((t) => {
      const params =
        t.parameters.length > 0
          ? t.parameters
              .map((p) => `    - ${p.name} (${p.required ? 'required' : 'optional'}): ${p.description}`)
              .join('\n')
          : '    (no parameters)';
      return `  ${t.name}: ${t.description}\n${params}`;
    })
    .join('\n\n');
}

// ── System prompt ─────────────────────────────────────

export function getSystemPrompt(): string {
  return `You are Dax, an intelligent file workspace agent. You help users organize, analyze, and manage their project files.

When the user gives you a goal, you must create a step-by-step plan using the available tools.

Available tools:

${buildToolDescriptions()}

IMPORTANT RULES:
1. Always respond with valid JSON only — no markdown, no code fences, no explanation text outside the JSON.
2. Your response MUST be a JSON object with a "steps" array.
3. Each step must have: "id" (string, sequential starting at "1"), "description" (human-readable), "tool" (tool name), "args" (object with string values matching the tool's parameters), "status" (always "pending").
4. Keep plans focused and minimal — prefer fewer steps that accomplish the goal.
5. Use absolute file paths based on the file tree provided.
6. Do not invent files that don't exist in the file tree (unless the goal is to create them).

Response format:
{
  "steps": [
    {
      "id": "1",
      "description": "Human-readable description of this step",
      "tool": "toolName",
      "args": { "param": "value" },
      "status": "pending"
    }
  ]
}`;
}

// ── Refine plan prompt ────────────────────────────────

export function getRefinePlanPrompt(
  originalGoal: string,
  completedSteps: string[],
  failedStep: string,
  errorMessage: string,
): string {
  return `The user's goal was: "${originalGoal}"

The following steps were completed successfully:
${completedSteps.length > 0 ? completedSteps.map((s) => `  - ${s}`).join('\n') : '  (none)'}

The following step failed:
  - ${failedStep}
  Error: ${errorMessage}

Please create a revised plan to complete the remaining work, taking into account the error. Respond with the same JSON format as before. If the goal cannot be completed, return an empty steps array.`;
}
