import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { stripVTControlCharacters } from 'node:util';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CliStatus, formatStatusLabel } from './status.js';
import { formatTable, openUrl, Table } from './ux.js';

vi.mock('node:child_process', () => ({
    spawn: vi.fn(),
}));

describe('ux helpers', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('formats bordered tables with a title', () => {
        const output = formatTable(['Service', 'Status'], [['MySQL', 'ready']], { title: 'Shared services' });

        expect(output).toContain('Shared services');
        expect(output).toContain('┌');
        expect(output).toContain('│ Service');
        expect(output).toContain('│ MySQL');
        expect(output).toContain('└');
    });

    it('keeps table lines within the terminal width', () => {
        const originalColumns = process.stdout.columns;
        Object.defineProperty(process.stdout, 'columns', { configurable: true, value: 48 });

        try {
            const output = formatTable(
                ['Service', 'Status', 'Access', 'Login'],
                [['Caddy', formatStatusLabel(CliStatus.Running), 'https://dashboard.very-long-development-domain.stamhoofd', 'username / password']],
                { title: 'Checking Stamhoofd local development setup with a very long title' },
            );

            for (const line of output.split('\n')) {
                expect(stripVTControlCharacters(line).length).toBeLessThanOrEqual(47);
            }
        }
        finally {
            Object.defineProperty(process.stdout, 'columns', { configurable: true, value: originalColumns });
        }
    });

    it('formats standard status labels', () => {
        expect(formatStatusLabel(CliStatus.Ready)).toContain('ready');
        expect(formatStatusLabel(CliStatus.Running)).toContain('running');
        expect(formatStatusLabel(CliStatus.Stopped)).toContain('stopped');
        expect(formatStatusLabel(CliStatus.Missing)).toContain('missing');
        expect(formatStatusLabel(CliStatus.Failed)).toContain('failed');
        expect(formatStatusLabel(CliStatus.Checking)).toContain('checking');
    });

    it('treats browser opening as best effort', () => {
        const child = new EventEmitter() as EventEmitter & { unref: ReturnType<typeof vi.fn> };
        child.unref = vi.fn();
        vi.mocked(spawn).mockReturnValue(child as never);

        expect(() => openUrl('https://example.com')).not.toThrow();
        expect(() => child.emit('error', new Error('missing opener'))).not.toThrow();
        expect(child.unref).toHaveBeenCalledTimes(1);
    });

    it('waits to render static tables until all rows are ready', async () => {
        const messages: string[] = [];
        vi.spyOn(console, 'log').mockImplementation((message?: unknown) => {
            messages.push(typeof message === 'string' ? message : '');
        });
        const row = Table.row(['Check', Table.cell('checking', { indeterminate: true }), '']);
        const table = Table.create({
            title: 'Setup',
            headers: ['Check', 'Status', 'Details'],
            rows: [row],
            live: false,
        });

        row.update(['Check', 'ready', 'ok']);

        expect(messages).toEqual([]);

        await table.wait();

        expect(messages.join('\n')).toContain('Setup');
        expect(messages.join('\n')).toContain('ready');
    });

    it('resolves wait when a row removes its indeterminate cell', async () => {
        const messages: string[] = [];
        vi.spyOn(console, 'log').mockImplementation((message?: unknown) => {
            messages.push(typeof message === 'string' ? message : '');
        });
        const row = Table.row(['Service', Table.cell('checking', { indeterminate: true })]);
        const table = Table.create({ headers: ['Service', 'Status'], rows: [row], live: false });

        const waitPromise = table.wait();
        row.update(['Service', 'running']);
        await waitPromise;

        expect(messages.join('\n')).toContain('running');
    });

    it('keeps logs above a live table while rows update', async () => {
        const originalIsTTY = process.stdout.isTTY;
        Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: true });
        const writes: string[] = [];
        vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
            writes.push(String(chunk));
            return true;
        });
        try {
            const row = Table.row(['Service', Table.cell('starting', { indeterminate: true })]);
            const table = Table.create({ headers: ['Service', 'Status'], rows: [row], live: true });
            const beforeLog = writes.length;

            process.stdout.write('podman rm -f stamhoofd-mysql\n');

            expect(writes.slice(beforeLog).join('')).toContain('\x1b[5A\x1b[0Jpodman rm -f stamhoofd-mysql');
            row.update(['Service', 'running']);
            await table.wait();
            expect(writes.join('')).toContain('podman rm -f stamhoofd-mysql');
        }
        finally {
            Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: originalIsTTY });
        }
    });
});
