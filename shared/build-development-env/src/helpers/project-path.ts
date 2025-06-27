import fs from 'node:fs/promises';
import path from 'node:path';

async function fileExists(path: string): Promise<boolean> {
    try {
        await fs.access(path);
        return true;
    }
    catch {
        return false;
    }
}

/**
 * Includes trailing slash
 */
export async function getProjectPath() {
    let depth = 2;

    while (true) {
        // check lerna.json exists at depth
        const fileName = __dirname + '/' + '../'.repeat(depth) + `lerna.json`;
        if (await fileExists(fileName)) {
            break;
        }
        depth++;

        if (depth >= 7) {
            throw new Error('Could not find lerna.json in the parent directories');
        }
    }

    const rootPath = path.normalize(__dirname + '/' + '../'.repeat(depth));
    return rootPath;
}
