import { useFileTreeStore } from '@/stores/fileTreeStore';
// ── Helpers ────────────────────────────────────────────
function getFileTreeSnapshot() {
    const state = useFileTreeStore.getState();
    const result = [];
    for (const id of state.rootChildren) {
        const node = state.nodes.get(id);
        if (node)
            result.push(node);
    }
    return result;
}
function flattenNodes(nodes) {
    const flat = [];
    function recurse(list) {
        for (const node of list) {
            flat.push(node);
            if (node.children)
                recurse(node.children);
        }
    }
    recurse(nodes);
    return flat;
}
function formatFileTree(nodes, indent = 0) {
    const lines = [];
    for (const node of nodes) {
        const prefix = '  '.repeat(indent);
        const sizeKB = (node.sizeBytes / 1024).toFixed(1);
        if (node.type === 'directory') {
            lines.push(`${prefix}📁 ${node.name}/`);
            if (node.children) {
                lines.push(formatFileTree(node.children, indent + 1));
            }
        }
        else {
            lines.push(`${prefix}📄 ${node.name} (${sizeKB} KB)`);
        }
    }
    return lines.join('\n');
}
// ── Send LLM helper (used by summarize & suggest) ─────
async function sendToLLM(messages, config) {
    return window.electronAPI.sendLLMMessage(messages, config);
}
/** Lazily injected by the planner/executor so tools can access LLM config */
let _llmConfig = null;
export function setToolLLMConfig(config) {
    _llmConfig = config;
}
function requireLLMConfig() {
    if (!_llmConfig) {
        throw new Error('LLM config has not been injected into agent tools');
    }
    return _llmConfig;
}
// ── Tool definitions ──────────────────────────────────
const readFileTool = {
    name: 'readFile',
    description: 'Read the contents of a file at the given path.',
    parameters: [
        { name: 'path', description: 'Absolute path of the file to read', required: true },
    ],
    execute: async (args) => {
        const content = await window.electronAPI.readFileContent(args['path']);
        return content;
    },
};
const writeFileTool = {
    name: 'writeFile',
    description: 'Write content to a file at the given path (creates or overwrites).',
    parameters: [
        { name: 'path', description: 'Absolute path of the file to write', required: true },
        { name: 'content', description: 'Content to write to the file', required: true },
    ],
    execute: async (args) => {
        await window.electronAPI.writeFileContent(args['path'], args['content']);
        return `File written: ${args['path']}`;
    },
};
const moveFileTool = {
    name: 'moveFile',
    description: 'Move a file from source path to destination path.',
    parameters: [
        { name: 'src', description: 'Source file path', required: true },
        { name: 'dest', description: 'Destination file path', required: true },
    ],
    execute: async (args) => {
        await window.electronAPI.moveFile(args['src'], args['dest']);
        return `File moved: ${args['src']} → ${args['dest']}`;
    },
};
const deleteFileTool = {
    name: 'deleteFile',
    description: 'Delete a file at the given path (moves to trash).',
    parameters: [
        { name: 'path', description: 'Absolute path of the file to delete', required: true },
    ],
    execute: async (args) => {
        await window.electronAPI.deleteFile(args['path']);
        return `File deleted: ${args['path']}`;
    },
};
const renameFileTool = {
    name: 'renameFile',
    description: 'Rename a file. Provide the current path and the new file name.',
    parameters: [
        { name: 'path', description: 'Absolute path of the file to rename', required: true },
        { name: 'newName', description: 'New name for the file (not full path)', required: true },
    ],
    execute: async (args) => {
        await window.electronAPI.renameFile(args['path'], args['newName']);
        return `File renamed: ${args['path']} → ${args['newName']}`;
    },
};
const listDirectoryTool = {
    name: 'listDirectory',
    description: 'List contents of a directory, returning a formatted tree listing.',
    parameters: [
        { name: 'path', description: 'Absolute path of the directory to list', required: true },
    ],
    execute: async (args) => {
        const nodes = await window.electronAPI.readDirectory(args['path']);
        return formatFileTree(nodes);
    },
};
const summarizeFileTool = {
    name: 'summarizeFile',
    description: 'Read a file and generate a summary using the LLM. Stores summary in file metadata.',
    parameters: [
        { name: 'path', description: 'Absolute path of the file to summarize', required: true },
    ],
    execute: async (args) => {
        const config = requireLLMConfig();
        const content = await window.electronAPI.readFileContent(args['path']);
        const truncated = content.length > 8000 ? content.slice(0, 8000) + '\n...(truncated)' : content;
        const messages = [
            { role: 'system', content: 'You are a concise code/file summarizer. Summarize the following file content in 2-3 sentences.' },
            { role: 'user', content: `File: ${args['path']}\n\n${truncated}` },
        ];
        const summary = await sendToLLM(messages, config);
        // Store summary in file metadata
        const fileTreeState = useFileTreeStore.getState();
        const node = fileTreeState.getNodeByPath(args['path']);
        if (node) {
            fileTreeState.updateNode(node.id, {
                metadata: { ...node.metadata, summary },
            });
        }
        return summary;
    },
};
const searchFilesTool = {
    name: 'searchFiles',
    description: 'Search the file tree for files matching a query by name, extension, or path.',
    parameters: [
        { name: 'query', description: 'Search query (matches against file name, extension, or path)', required: true },
    ],
    execute: async (args) => {
        const tree = getFileTreeSnapshot();
        const allNodes = flattenNodes(tree);
        const query = args['query'].toLowerCase();
        const matches = allNodes.filter((node) => {
            const nameLower = node.name.toLowerCase();
            const pathLower = node.path.toLowerCase();
            const extLower = (node.extension ?? '').toLowerCase();
            return (nameLower.includes(query) ||
                pathLower.includes(query) ||
                extLower.includes(query));
        });
        if (matches.length === 0) {
            return `No files found matching "${args['query']}"`;
        }
        const lines = matches.map((n) => `${n.type === 'directory' ? '📁' : '📄'} ${n.path} (${(n.sizeBytes / 1024).toFixed(1)} KB)`);
        return `Found ${matches.length} result(s):\n${lines.join('\n')}`;
    },
};
const suggestActionsTool = {
    name: 'suggestActions',
    description: 'Analyze the current file tree and suggest organizational improvements.',
    parameters: [],
    execute: async () => {
        const config = requireLLMConfig();
        const tree = getFileTreeSnapshot();
        const listing = formatFileTree(tree);
        const messages = [
            {
                role: 'system',
                content: 'You are a project organization expert. Analyze the file tree and suggest 3-5 concrete actions that would improve the project structure. Be specific — refer to actual files and directories.',
            },
            { role: 'user', content: `Current file tree:\n\n${listing}` },
        ];
        const suggestions = await sendToLLM(messages, config);
        return suggestions;
    },
};
// ── Exports ───────────────────────────────────────────
export const tools = [
    readFileTool,
    writeFileTool,
    moveFileTool,
    deleteFileTool,
    renameFileTool,
    listDirectoryTool,
    summarizeFileTool,
    searchFilesTool,
    suggestActionsTool,
];
export function getToolByName(name) {
    return tools.find((t) => t.name === name);
}
