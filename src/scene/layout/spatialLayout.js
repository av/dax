const GRID_SPACING = 3.0;
const DIRECTORY_Y_STEP = 4.0;
const PLATFORM_PADDING = 2.0;
/**
 * Calculate spatial layout for all FileNodes.
 * Files are placed in a grid on their parent directory's platform.
 * Directories are elevated platforms.
 *
 * Returns a Map of node id → [x, y, z] world position, plus platform sizes for dirs.
 */
export function calculateLayout(nodes, rootPath) {
    const result = new Map();
    if (nodes.length === 0)
        return result;
    // Build a flat list from the tree, processing recursively
    layoutDirectory(nodes, 0, 0, 0, 0, result);
    // If we have a root, add a virtual root platform
    if (rootPath) {
        const rootFiles = nodes.filter((n) => n.type === 'file');
        const rootDirs = nodes.filter((n) => n.type === 'directory');
        const totalItems = rootFiles.length + rootDirs.length;
        const cols = Math.max(1, Math.ceil(Math.sqrt(totalItems)));
        const rows = Math.max(1, Math.ceil(totalItems / cols));
        const width = cols * GRID_SPACING + PLATFORM_PADDING * 2;
        const depth = rows * GRID_SPACING + PLATFORM_PADDING * 2;
        result.set('__root__', {
            id: '__root__',
            position: [0, -0.1, 0],
            platformSize: [Math.max(width, 10), Math.max(depth, 10)],
        });
    }
    return result;
}
function layoutDirectory(children, depth, offsetX, offsetY, offsetZ, result) {
    // Separate files and directories
    const files = children.filter((n) => n.type === 'file');
    const dirs = children.filter((n) => n.type === 'directory');
    // Layout files in a grid
    const totalItems = files.length;
    const cols = Math.max(1, Math.ceil(Math.sqrt(totalItems)));
    const rows = Math.max(1, Math.ceil(totalItems / cols));
    files.forEach((file, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = offsetX + (col - (cols - 1) / 2) * GRID_SPACING;
        const z = offsetZ + (row - (rows - 1) / 2) * GRID_SPACING;
        const y = offsetY + 0.5; // Slightly above the platform
        result.set(file.id, {
            id: file.id,
            position: [x, y, z],
        });
    });
    // Track total extents for this directory's platform
    const fileAreaWidth = cols * GRID_SPACING + PLATFORM_PADDING * 2;
    const fileAreaDepth = rows * GRID_SPACING + PLATFORM_PADDING * 2;
    // Layout sub-directories — place them side by side after the file grid
    let dirOffsetX = offsetX - ((dirs.length - 1) * GRID_SPACING * 3) / 2;
    const dirOffsetZ = offsetZ + (rows > 0 ? (rows * GRID_SPACING) / 2 + GRID_SPACING * 2 : 0);
    let maxDirWidth = 0;
    let maxDirDepth = 0;
    for (const dir of dirs) {
        const dirY = offsetY + DIRECTORY_Y_STEP;
        const dirChildren = dir.children ?? [];
        // Compute child layout first to get platform size
        const [childWidth, childDepth] = layoutDirectory(dirChildren, depth + 1, dirOffsetX, dirY, dirOffsetZ, result);
        const platformWidth = Math.max(childWidth, 6);
        const platformDepth = Math.max(childDepth, 6);
        result.set(dir.id, {
            id: dir.id,
            position: [dirOffsetX, dirY, dirOffsetZ],
            platformSize: [platformWidth, platformDepth],
        });
        dirOffsetX += platformWidth + GRID_SPACING;
        maxDirWidth += platformWidth + GRID_SPACING;
        maxDirDepth = Math.max(maxDirDepth, platformDepth);
    }
    const totalWidth = Math.max(fileAreaWidth, maxDirWidth);
    const totalDepth = fileAreaDepth + (dirs.length > 0 ? maxDirDepth + GRID_SPACING * 2 : 0);
    return [totalWidth, totalDepth];
}
