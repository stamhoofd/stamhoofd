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
    it('prepares dependency builds and fingerprints transitive source and Vue globals', () => {
        const { tasks, globalDependencies } = readJson('turbo.jsonc');

        expect(tasks['check-inputs']).toEqual({ dependsOn: ['^check-inputs'] });
        expect(tasks.typecheck).toEqual({
            dependsOn: ['^build', 'check-inputs', '@stamhoofd/components#check-inputs'],
            cache: true,
            outputs: [],
        });
        expect(globalDependencies).toEqual(expect.arrayContaining([
            'tsconfig*.json',
            'frontend/tsconfig*.json',
            'frontend/*.d.ts',
            'backend/*.d.ts',
            'shared/*.d.ts',
        ]));
    });

    it.each(typecheckPackages)('%s checks production and tests without emitting', (packagePath) => {
        const { scripts } = readJson(`${packagePath}/package.json`);
        const commands = scripts.typecheck.split(' && ');

        expect(commands).toEqual([
            'tsc --project tsconfig.build.json --noEmit --composite false --incremental false',
            'tsc --project tsconfig.test.json --noEmit --composite false --incremental false',
        ]);
        expect(readJson(`${packagePath}/tsconfig.test.json`).references ?? []).toEqual([]);
    });

    it('keeps root and CLI checks on the same Turbo entrypoint', () => {
        expect(readJson('package.json').scripts.typecheck).toBe('pnpm exec turbo run typecheck');
        const runner = readFileSync(new URL('shared/cli/src/runtime/monorepo-runner.ts', root), 'utf8');

        expect(runner).toContain("['run', 'typecheck']");
    });
});
