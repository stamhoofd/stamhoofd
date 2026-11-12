import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const exec = promisify(execFile);
const runner = fileURLToPath(new URL('../bin/format.mjs', import.meta.url));

async function run(cwd, fix = false) {
    try {
        return { ...await exec(process.execPath, [runner, ...(fix ? ['--fix'] : [])], { cwd }), code: 0 };
    } catch (error) {
        if (typeof error.code !== 'number') throw error;
        return error;
    }
}

describe('formatting without semantic linting', () => {
    let cwd;

    beforeEach(async () => {
        cwd = await mkdtemp(path.join(tmpdir(), 'stam-format-'));
        const plugin = new URL('../src/index.js', import.meta.url).href;
        await writeFile(path.join(cwd, 'eslint.config.mjs'), `import plugin from '${plugin}';\nexport default plugin.configs.frontend;\n`);
    });

    afterEach(async () => {
        await rm(cwd, { recursive: true, force: true });
    });

    it('formats TypeScript without a project, without fixing semantic problems', async () => {
        const file = path.join(cwd, 'example.ts');
        await writeFile(file, 'const name: number = "Ada"\n');
        const result = await run(cwd, true);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        expect(await readFile(file, 'utf8')).toBe('const name: number = \'Ada\';\n');
        expect((await run(cwd)).code).toBe(0);
    });

    it('formats Vue templates and embedded TypeScript without a project', async () => {
        const file = path.join(cwd, 'Example.vue');
        await writeFile(file, '<template>\n<div><hr><h2>Title</h2></div>\n</template>\n<script setup lang="ts">\nconst name: number = "Ada"\n</script>\n');
        const result = await run(cwd, true);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        const output = await readFile(file, 'utf8');
        expect(output).toContain("const name: number = 'Ada';");
        expect(output).toMatch(/<hr>\n\s+<h2>/);
    });

    it('reports formatting warnings without changing the source in check mode', async () => {
        const file = path.join(cwd, 'example.ts');
        await writeFile(file, 'const name = "Ada"\n');
        const result = await run(cwd);
        expect(result.code).toBe(1);
        expect(result.stdout).toContain('@stylistic/quotes');
        expect(await readFile(file, 'utf8')).toBe('const name = "Ada"\n');
    });

    it('still reports syntax errors', async () => {
        await writeFile(path.join(cwd, 'example.ts'), 'const =');
        const result = await run(cwd);
        expect(result.code).toBe(1);
        expect(result.stdout).toContain('Parsing error');
    });
});
