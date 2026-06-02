import { afterEach, describe, expect, it, vi } from 'vitest';
import { setActiveOutputTarget, writeOutputLine } from './output-target.js';

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

        expect(target.log).toHaveBeenCalledWith('hello');
    });

    it('falls back to console when no active target exists', () => {
        const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);

        writeOutputLine('hello');

        expect(consoleLog).toHaveBeenCalledWith('hello');
    });
});
