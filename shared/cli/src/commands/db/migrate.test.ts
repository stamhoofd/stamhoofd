import { beforeEach, describe, expect, it, vi } from 'vitest';
import DbMigrate from './migrate.js';
import { ensureMysqlRunning } from '../../runtime/database-command-helpers.js';
import { migrate } from '../../runtime/monorepo-runner.js';

vi.mock('../../runtime/database-command-helpers.js', () => ({
    ensureMysqlRunning: vi.fn(),
}));

vi.mock('../../runtime/monorepo-runner.js', () => ({
    migrate: vi.fn(),
}));

describe('DbMigrate command', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('passes the selected env and name context into migrations', async () => {
        const context = {
            rootDir: '/repo',
            generatedDir: '/repo/.development/cli/generated',
            env: 'keeo',
            workspace: 'main',
            verbose: true,
            instance: {
                name: 'feature-payments',
                prefix: 'feature-payments',
                primary: false,
                portOffset: 1200,
            },
        };
        const command = new DbMigrate([], {} as any);
        (command as any).config = {};
        (command as any).parse = vi.fn(async () => ({ flags: { env: 'keeo', name: 'feature-payments', verbose: true } }));
        (command as any).createContext = vi.fn(async () => context);

        await command.run();

        expect(migrate).toHaveBeenCalledWith(context);
        expect(ensureMysqlRunning).toHaveBeenCalledWith(context);
        expect(vi.mocked(ensureMysqlRunning).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(migrate).mock.invocationCallOrder[0]);
    });
});
