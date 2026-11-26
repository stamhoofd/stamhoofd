import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const runner = fileURLToPath(new URL('../bin/format-file.mjs', import.meta.url));

it.each([
    ['backend/app/api/src/historical.ts', 'const x= "example"', 'const x = \'example\';\n'],
    ['frontend/app/web-app/src/historical.ts', 'const x= "example"', 'const x = \'example\';\n'],
    ['shared/locales/historical.json', '{ "x":   1}', '{ "x":   1}'],
])('formats historical content on stdin for %s', (file, input, expected) => {
    const result = spawnSync(process.execPath, [runner, file], { input, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe(expected);
});
