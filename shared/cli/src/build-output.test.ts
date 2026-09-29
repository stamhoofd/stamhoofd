import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, it } from 'vitest';

it('only discovers compiled commands that exist in the current source tree', async () => {
    const root = path.join(import.meta.dirname, '..');
    const sourceFiles = await fs.readdir(path.join(root, 'src/commands'), { recursive: true });
    const builtFiles = await fs.readdir(path.join(root, 'dist/commands'), { recursive: true });
    const expectedCommands = sourceFiles
        .filter(file => file.endsWith('.ts') && !file.endsWith('.test.ts') && !file.endsWith('.spec.ts'))
        .map(file => file.replace(/\.ts$/, '.js'))
        .sort();

    expect(builtFiles.filter(file => file.endsWith('.js')).sort()).toEqual(expectedCommands);
});
