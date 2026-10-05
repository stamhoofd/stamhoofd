import { afterEach, expect, it, vi } from 'vitest';
import { config } from 'dotenv';
import winston from 'winston';
import { getFilesToSearch } from './shared/get-files-to-search.js';

vi.mock('dotenv', () => ({ config: vi.fn() }));
vi.mock('./shared/get-files-to-search.js', () => ({ getFilesToSearch: vi.fn(() => []) }));
vi.mock('winston', async importOriginal => {
    const original = await importOriginal<{ default: typeof winston }>();
    return {
        ...original,
        default: {
            ...original.default,
            createLogger: vi.fn(),
            transports: { ...original.default.transports, File: vi.fn(function () {}) },
        },
    };
});

afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    vi.resetModules();
});

it('does not load environment files or capture credentials when imported', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-import-key');
    const { globals } = await import('./shared/globals.js');
    expect(config).not.toHaveBeenCalled();
    expect(globals).not.toHaveProperty('OPENAI_API_KEY');
});

it('does not open or truncate logs when translation is imported', async () => {
    await import('./auto-translate/auto-translate.js');
    expect(winston.createLogger).not.toHaveBeenCalled();
    expect(winston.transports.File).not.toHaveBeenCalled();
});

it('does not scan the repository when source migration is imported', async () => {
    await import('./replace-text/replace-text.js');
    expect(getFilesToSearch).not.toHaveBeenCalled();
});
