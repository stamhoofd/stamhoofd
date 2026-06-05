import { beforeEach, describe, expect, it, vi } from 'vitest';
import DbCopy from './copy.js';
import DbMove from './move.js';
import DbRemove from './remove.js';
import { input, select } from '@inquirer/prompts';
import { run } from '../../runtime/command-runner.js';
import { resetContainerRuntimeCacheForTests } from '../../services/docker.js';

vi.mock('@inquirer/prompts', () => ({
    input: vi.fn(),
    select: vi.fn(),
}));

vi.mock('../../runtime/command-runner.js', () => ({
    run: vi.fn(),
}));

describe('database management commands', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetContainerRuntimeCacheForTests();
        vi.mocked(run).mockImplementation(async (_command, args) => {
            if (args[0] === '--version') {
                return { stdout: 'podman version 5.0.0', stderr: '', status: 0 };
            }
            if (args.includes('SHOW DATABASES;')) {
                return { stdout: 'source-db\nother-db\n', stderr: '', status: 0 };
            }
            return undefined;
        });
    });

    it('copies a database from explicit flags without prompting', async () => {
        const command = createCommand(DbCopy, { from: 'source-db', to: 'target-db' });

        await command.run();

        expect(select).not.toHaveBeenCalled();
        expect(run).toHaveBeenNthCalledWith(1, 'podman', ['--version'], { capture: true, allowFailure: true });
        expect(run).toHaveBeenNthCalledWith(2, 'podman', ['info'], { quiet: true });
        expect(run).toHaveBeenNthCalledWith(3, 'podman', ['exec', 'stamhoofd-mysql', 'mysql', '-h127.0.0.1', '-uroot', '-proot', '-e', 'CREATE DATABASE IF NOT EXISTS `target-db` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;'], expect.anything());
        expect(run).toHaveBeenNthCalledWith(4, 'podman', ['exec', 'stamhoofd-mysql', 'sh', '-c', "mysqldump -h'127.0.0.1' -u'root' -p'root' --single-transaction --routines --triggers --events 'source-db' | mysql -h'127.0.0.1' -u'root' -p'root' 'target-db'"], expect.anything());
    });

    it('moves a database by copying and dropping the source', async () => {
        const command = createCommand(DbMove, { from: 'source-db', to: 'target-db' });

        await command.run();

        expect(run).toHaveBeenCalledWith('podman', ['exec', 'stamhoofd-mysql', 'mysql', '-h127.0.0.1', '-uroot', '-proot', '-e', 'DROP DATABASE IF EXISTS `source-db`;'], expect.anything());
    });

    it('removes a database selected by explicit from flag', async () => {
        const command = createCommand(DbRemove, { from: 'source-db' });

        await command.run();

        expect(select).not.toHaveBeenCalled();
        expect(run).toHaveBeenCalledWith('podman', ['exec', 'stamhoofd-mysql', 'mysql', '-h127.0.0.1', '-uroot', '-proot', '-e', 'DROP DATABASE IF EXISTS `source-db`;'], expect.anything());
    });

    it('prompts for missing from and to databases', async () => {
        vi.mocked(select).mockResolvedValueOnce('source-db').mockResolvedValueOnce('stamhoofd-development');
        const command = createCommand(DbCopy, {});

        await command.run();

        expect(select).toHaveBeenNthCalledWith(1, {
            message: 'Select the database to copy from',
            choices: [
                { name: 'source-db', value: 'source-db' },
                { name: 'other-db', value: 'other-db' },
            ],
        });
        expect(select).toHaveBeenNthCalledWith(2, {
            message: 'Select the database to copy to',
            choices: [
                { name: 'source-db', value: 'source-db' },
                { name: 'other-db', value: 'other-db' },
                { name: 'stamhoofd-development (current setup)', value: 'stamhoofd-development' },
                { name: 'Enter a custom database name...', value: '__stamhoofd_custom_database__' },
            ],
        });
    });

    it('allows a custom target database name for missing to option', async () => {
        vi.mocked(select).mockResolvedValueOnce('source-db').mockResolvedValueOnce('__stamhoofd_custom_database__');
        vi.mocked(input).mockResolvedValueOnce('custom-target-db');
        const command = createCommand(DbCopy, {});

        await command.run();

        expect(input).toHaveBeenCalledWith({
            message: 'Enter the target database name',
            validate: expect.any(Function),
        });
        expect(run).toHaveBeenCalledWith('podman', ['exec', 'stamhoofd-mysql', 'mysql', '-h127.0.0.1', '-uroot', '-proot', '-e', 'CREATE DATABASE IF NOT EXISTS `custom-target-db` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;'], expect.anything());
    });

    it('marks existing current setup database in interactive choices', async () => {
        vi.mocked(run).mockImplementation(async (_command, args) => {
            if (args[0] === '--version') {
                return { stdout: 'podman version 5.0.0', stderr: '', status: 0 };
            }
            if (args.includes('SHOW DATABASES;')) {
                return { stdout: 'stamhoofd-development\nother-db\n', stderr: '', status: 0 };
            }
            return undefined;
        });
        vi.mocked(select).mockResolvedValueOnce('stamhoofd-development');
        const command = createCommand(DbRemove, {});

        await command.run();

        expect(select).toHaveBeenCalledWith({
            message: 'Select the database to remove',
            choices: [
                { name: 'stamhoofd-development (current setup)', value: 'stamhoofd-development' },
                { name: 'other-db', value: 'other-db' },
            ],
        });
    });
});

function createCommand<T extends DbCopy | DbMove | DbRemove>(CommandClass: new (argv: string[], config: any) => T, flags: { from?: string; to?: string }): T {
    const command = new CommandClass([], {} as any);
    (command as any).config = {};
    (command as any).parse = vi.fn(async () => ({ flags: { env: 'stamhoofd', verbose: false, ...flags } }));
    (command as any).createContext = vi.fn(async () => ({
        rootDir: '/repo',
        generatedDir: '/repo/.development/cli/generated',
        env: 'stamhoofd',
        workspace: 'main',
        verbose: false,
        instance: {
            name: 'stamhoofd',
            prefix: '',
            primary: true,
            portOffset: 0,
        },
    }));
    command.log = vi.fn();
    return command;
}
