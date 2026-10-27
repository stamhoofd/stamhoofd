import { logger } from '@node/logging';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withMigrationOutput } from './migrationOutput.js';

describe('migration output', () => {
    const stdout = logger.stdout;
    const stderr = logger.stderr;
    let messages: string[];

    beforeEach(() => {
        messages = [];
        logger.stdout = { write: message => messages.push(message), clearLine: vi.fn() };
        logger.stderr = { write: message => messages.push(message), clearLine: vi.fn() };
    });

    afterEach(() => {
        logger.stdout = stdout;
        logger.stderr = stderr;
    });

    it('hides successful migration output by default', async () => {
        await withMigrationOutput(async () => {
            logger.log('[Migration] Running example.sql');
            await Promise.resolve();
            logger.log('[Migration] Migration example.sql ran successfully');
        }, false);

        expect(messages).toEqual([]);
    });

    it('streams migration output in verbose mode', async () => {
        await withMigrationOutput(async () => {
            logger.log('[Migration] Running example.sql');
            expect(messages).toEqual(['[Migration] Running example.sql\n']);
        }, true);
    });

    it('replays buffered output before a migration error without duplicating it', async () => {
        const error = new Error('Migration failed');
        const originalStdout = logger.stdout;
        const originalStderr = logger.stderr;

        await expect(withMigrationOutput(async () => {
            logger.log('[Migration] Running example.sql');
            logger.error('[Migration] example.sql failed: invalid SQL');
            throw error;
        }, false)).rejects.toBe(error);

        expect(messages).toEqual(['[Migration] Running example.sql\n', '[Migration] example.sql failed: invalid SQL\n']);
        expect(logger.stdout).toBe(originalStdout);
        expect(logger.stderr).toBe(originalStderr);
    });

    it('replays output when a migration throws without logging an error', async () => {
        await expect(withMigrationOutput(async () => {
            logger.log('[Migration] Running example.sql');
            throw new Error('Connection lost');
        }, false)).rejects.toThrow('Connection lost');

        expect(messages).toEqual(['[Migration] Running example.sql\n']);
    });

    it('never hides errors even if the callback completes successfully', async () => {
        await withMigrationOutput(async () => {
            logger.error('Migration warning');
        }, false);

        expect(messages).toEqual(['Migration warning\n']);
    });

    it('does not swallow concurrent setup output and restores logging after success', async () => {
        let finish!: () => void;
        const pending = new Promise<void>((resolve) => { finish = resolve; });
        const migration = withMigrationOutput(async () => {
            logger.log('[Migration] Running example.sql');
            await pending;
        }, false);

        logger.log('SSO server started.');
        finish();
        await migration;
        logger.log('Running tests.');

        expect(messages).toEqual(['SSO server started.\n', 'Running tests.\n']);
    });
});
