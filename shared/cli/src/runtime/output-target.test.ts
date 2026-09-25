import { afterEach, describe, expect, it, vi } from 'vitest';
import { OutputStream, setActiveOutputTarget, writeOutputChunk, writeOutputLine } from './output-target.js';

describe('output target', () => {
    afterEach(() => {
        setActiveOutputTarget(undefined);
        vi.restoreAllMocks();
    });

    it('routes output to the active target when present', () => {
        const target = {
            log: vi.fn(),
            write: vi.fn(),
        };

        setActiveOutputTarget(target);
        writeOutputLine('hello');
        writeOutputLine('failure', OutputStream.Stderr);

        expect(target.log).toHaveBeenCalledWith('hello');
        expect(target.write).toHaveBeenCalledWith('failure\n', OutputStream.Stderr);
    });

    it('falls back to console when no active target exists', () => {
        const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);

        writeOutputLine('hello');

        expect(consoleLog).toHaveBeenCalledWith('hello');
    });

    it('preserves chunk boundaries and streams for an active target', () => {
        const target = { log: vi.fn(), write: vi.fn() };
        setActiveOutputTarget(target);

        writeOutputChunk('partial', OutputStream.Stdout);
        writeOutputChunk('error\n', OutputStream.Stderr);

        expect(target.write).toHaveBeenNthCalledWith(1, 'partial', OutputStream.Stdout);
        expect(target.write).toHaveBeenNthCalledWith(2, 'error\n', OutputStream.Stderr);
    });
});
