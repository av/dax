import { useAgentStore } from '@/stores/agentStore';
import { useFileTreeStore } from '@/stores/fileTreeStore';
import { AgentState } from '@/types';
import { getToolByName, tools as allTools } from './tools';
export async function executeStep(step, toolsList = allTools) {
    const store = useAgentStore.getState();
    const fileTreeState = useFileTreeStore.getState();
    // Update step status to running
    store.updateStep(step.id, { status: 'running' });
    store.setStatus(AgentState.Acting);
    store.addLogEntry(`Running: ${step.description}`, 'info');
    // Move agent to the file being operated on
    const pathArg = step.args['path'] ??
        step.args['src'];
    if (pathArg) {
        const targetNode = fileTreeState.getNodeByPath(pathArg);
        if (targetNode) {
            store.moveTo(targetNode.position);
        }
    }
    // Find the tool
    const tool = getToolByName(step.tool) ?? toolsList.find((t) => t.name === step.tool);
    if (!tool) {
        const errorMsg = `Unknown tool: ${step.tool}`;
        store.updateStep(step.id, { status: 'failed', error: errorMsg });
        store.addLogEntry(`Failed: ${errorMsg}`, 'error');
        return { success: false, result: errorMsg };
    }
    // Execute the tool
    try {
        // Convert args to Record<string, string>
        const stringArgs = {};
        for (const [key, value] of Object.entries(step.args)) {
            stringArgs[key] = String(value);
        }
        const result = await tool.execute(stringArgs);
        store.updateStep(step.id, { status: 'done', result });
        store.completeStep(step.id);
        store.addLogEntry(`Completed: ${step.description}`, 'success');
        return { success: true, result };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        store.updateStep(step.id, { status: 'failed', error: errorMessage });
        store.addLogEntry(`Failed: ${step.description} — ${errorMessage}`, 'error');
        return { success: false, result: errorMessage };
    }
}
// ── Execute all approved steps sequentially ───────────
const STEP_DELAY_MS = 600;
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export async function executeApprovedPlan(steps) {
    const store = useAgentStore.getState();
    const approvedSteps = steps.filter((s) => s.status === 'approved');
    if (approvedSteps.length === 0) {
        store.addLogEntry('No approved steps to execute.', 'info');
        return;
    }
    store.setStatus(AgentState.Acting);
    store.addLogEntry(`Executing ${approvedSteps.length} approved step(s)…`, 'info');
    let failedCount = 0;
    for (const step of approvedSteps) {
        const result = await executeStep(step);
        if (!result.success) {
            failedCount++;
            store.addLogEntry(`Step "${step.description}" failed — continuing with remaining steps.`, 'error');
            // Continue executing remaining steps instead of halting
        }
        // Small delay between steps for visual feedback
        if (approvedSteps.indexOf(step) < approvedSteps.length - 1) {
            await delay(STEP_DELAY_MS);
        }
    }
    if (failedCount > 0) {
        store.setStatus(AgentState.Error);
        store.addLogEntry(`Completed with ${failedCount} failed step(s) out of ${approvedSteps.length}.`, 'error');
    }
    else {
        store.setStatus(AgentState.Idle);
        store.addLogEntry('All approved steps completed.', 'success');
    }
}
