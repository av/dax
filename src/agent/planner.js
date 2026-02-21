import { getSystemPrompt } from './prompts';
import { setToolLLMConfig } from './tools';
// ── Helpers ────────────────────────────────────────────
function buildFileTreeSummary(nodes, indent = 0) {
    const lines = [];
    for (const node of nodes) {
        const prefix = '  '.repeat(indent);
        const sizeKB = (node.sizeBytes / 1024).toFixed(1);
        if (node.type === 'directory') {
            lines.push(`${prefix}${node.name}/ (dir)`);
            if (node.children) {
                lines.push(buildFileTreeSummary(node.children, indent + 1));
            }
        }
        else {
            lines.push(`${prefix}${node.name} [${node.extension ?? 'no-ext'}, ${sizeKB} KB] — ${node.path}`);
        }
    }
    return lines.join('\n');
}
function isValidPlanResponse(data) {
    if (typeof data !== 'object' || data === null)
        return false;
    const obj = data;
    if (!Array.isArray(obj['steps']))
        return false;
    for (const step of obj['steps']) {
        if (typeof step !== 'object' || step === null)
            return false;
        const s = step;
        if (typeof s['id'] !== 'string')
            return false;
        if (typeof s['description'] !== 'string')
            return false;
        if (typeof s['tool'] !== 'string')
            return false;
        if (typeof s['args'] !== 'object' || s['args'] === null)
            return false;
    }
    return true;
}
function parsePlanResponse(raw) {
    // Strip markdown code fences if the LLM adds them
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    const parsed = JSON.parse(cleaned);
    if (!isValidPlanResponse(parsed)) {
        throw new Error('Invalid plan format from LLM');
    }
    return parsed;
}
function convertToAgentSteps(response) {
    return response.steps.map((step) => ({
        id: step.id,
        description: step.description,
        tool: step.tool,
        args: step.args,
        status: 'pending',
    }));
}
// ── Main planner function ─────────────────────────────
export async function createPlan(goal, fileTree, config) {
    // Inject config so tools that need LLM can use it
    setToolLLMConfig(config);
    const treeSummary = buildFileTreeSummary(fileTree);
    const systemPrompt = getSystemPrompt();
    const messages = [
        { role: 'system', content: systemPrompt },
        {
            role: 'user',
            content: `Current file tree:\n\n${treeSummary}\n\nGoal: ${goal}`,
        },
    ];
    let attempts = 0;
    const maxAttempts = 2;
    while (attempts < maxAttempts) {
        attempts++;
        try {
            const response = await window.electronAPI.sendLLMMessage(messages, config);
            const parsed = parsePlanResponse(response);
            return convertToAgentSteps(parsed);
        }
        catch (error) {
            if (attempts >= maxAttempts) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                // Return an error step so the UI can display it
                return [
                    {
                        id: '1',
                        description: `Failed to create plan: ${errorMessage}`,
                        tool: 'error',
                        args: { error: errorMessage },
                        status: 'failed',
                    },
                ];
            }
            // On first failure, ask the LLM to try again with clearer instructions
            messages.push({
                role: 'user',
                content: 'Your previous response was not valid JSON with the required format. Please respond with ONLY a JSON object containing a "steps" array. No markdown, no code fences.',
            });
        }
    }
    // Should never reach here, but TypeScript needs it
    return [];
}
