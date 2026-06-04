import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CliStatus, formatStatusLabel } from './status.js';
import { formatTable, openUrl } from './ux.js';

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
});
