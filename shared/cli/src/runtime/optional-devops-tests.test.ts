import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ present: false }));
vi.mock('node:fs', async (importOriginal) => ({
    ...(await importOriginal<typeof import('node:fs')>()),
    existsSync: vi.fn(() => state.present),
}));

describe('optional DevOps test target', () => {
    beforeEach(() => vi.resetModules());

    it.each([false, true])(
        'only registers DevOps when its checkout is present: %s',
        async (present) => {
            state.present = present;
            const { unitTestPackages } = await import('./monorepo-runner.js');
            expect(unitTestPackages.find((pkg) => pkg.name === 'devops')).toEqual(
                present
                    ? {
                          name: 'devops',
                          path: 'devops',
                          needsDatabase: false,
                      }
                    : undefined,
            );
            expect(unitTestPackages.some((pkg) => pkg.name === 'cli')).toBe(true);
        },
    );
});
