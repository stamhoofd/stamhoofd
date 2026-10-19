import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../../../../', import.meta.url);

function readJson(relativePath: string) {
    return JSON.parse(readFileSync(new URL(relativePath, root), 'utf8'));
}

const typecheckPackages = [
    'shared/metabase',
    'shared/structures',
    'backend/shared/models',
    'backend/shared/sql',
    'backend/shared/vies',
    'backend/app/api',
    'backend/app/redirecter',
    'backend/app/renderer',
    'backend/app/statistics-syncer',
];

describe('check cache configuration', () => {
    it('prepares declarations without runtime builds and fingerprints transitive source and Vue globals', () => {
        const { tasks, globalDependencies } = readJson('turbo.jsonc');

        expect(tasks['check-inputs']).toEqual({ dependsOn: ['^check-inputs'] });
        expect(tasks.typecheck).toEqual({
            dependsOn: ['build:types', 'check-inputs', '@stamhoofd/components#build:types', '@stamhoofd/components#check-inputs'],
            cache: true,
            outputs: [],
        });
        expect(tasks['build:types']).toEqual({
            dependsOn: ['^build:types'],
            outputs: ['dist-types/**', '.cache/types*.tsbuildinfo'],
        });
        expect(globalDependencies).toEqual(expect.arrayContaining([
            'tsconfig*.json',
            'frontend/tsconfig*.json',
            'frontend/*.d.ts',
            'backend/*.d.ts',
            'shared/*.d.ts',
        ]));
    });

    it.each(typecheckPackages)('%s checks production in build:types and tests without emitting', (packagePath) => {
        const { scripts } = readJson(`${packagePath}/package.json`);
        expect(scripts['build:types']).toMatch(/^tsc --project tsconfig.types.json/);
        expect(scripts.typecheck).toBe('tsc --project tsconfig.test.json --noEmit --composite false --incremental false');
        expect(readJson(`${packagePath}/tsconfig.test.json`).references).toEqual([{ path: './tsconfig.types.json' }]);
    });

    it('invalidates typed lint checks for dependency types, shared rules, and inherited configs', () => {
        const { tasks, globalDependencies } = readJson('turbo.jsonc');

        expect(tasks.lint).toEqual({
            dependsOn: ['build:types', 'check-inputs', 'eslint-plugin-stamhoofd#check-inputs', '@stamhoofd/components#build:types', '@stamhoofd/components#check-inputs'],
            cache: true,
            outputs: [],
        });
        expect(globalDependencies).toEqual(expect.arrayContaining([
            'eslint.config.js',
            'frontend/eslint.config.js',
            'backend/eslint.config.js',
        ]));
        expect(readJson('package.json').scripts.lint).toBe('pnpm exec turbo run lint');
    });

    it('keeps root and CLI checks on the same Turbo entrypoint', () => {
        expect(readJson('package.json').scripts.typecheck).toBe('pnpm exec turbo run typecheck');
        const runner = readFileSync(new URL('shared/cli/src/runtime/monorepo-runner.ts', root), 'utf8');

        expect(runner).toContain("['run', 'typecheck']");
    });
});
