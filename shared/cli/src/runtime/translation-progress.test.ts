import { beforeEach, expect, it, vi } from 'vitest';
import { formatTranslationProgress, translationStep } from './translation-progress.js';

const { spinner } = vi.hoisted(() => ({ spinner: {
    text: '', start: vi.fn(), stopAndPersist: vi.fn(), fail: vi.fn(),
} }));
vi.mock('ora', () => ({ default: vi.fn(() => spinner) }));

beforeEach(() => {
    vi.clearAllMocks();
    spinner.start.mockReturnValue(spinner);
    spinner.text = '';
});

it('updates the active spinner and persists a concise summary after completion', async () => {
    const result = await translationStep('Remove unused keys', async (report) => {
        report({ phase: 'scan', completed: 25, total: 100, translationFile: '/repo/fr.json' });
        expect(spinner.text).toBe('Remove unused keys — Scanning source files (fr.json) 25/100');
        expect(spinner.stopAndPersist).not.toHaveBeenCalled();
        return 3;
    }, count => `Removed ${count} entries`);
    expect(result).toBe(3);
    expect(spinner.stopAndPersist).toHaveBeenCalledWith(expect.objectContaining({ text: 'Removed 3 entries' }));
    expect(spinner.fail).not.toHaveBeenCalled();
});

it('stops the spinner with failure and preserves the original error', async () => {
    const error = new Error('source file could not be read');
    await expect(translationStep('Register keys', async () => { throw error; })).rejects.toBe(error);
    expect(spinner.fail).toHaveBeenCalledExactlyOnceWith('Register keys');
    expect(spinner.stopAndPersist).not.toHaveBeenCalled();
});

it('formats machine progress with its namespace, locale, and completed batch count', () => {
    expect(formatTranslationProgress({ phase: 'translate', locale: 'fr', namespace: 'stamhoofd', completed: 2, total: 4 }))
        .toBe('Translating batches (stamhoofd/fr) 2/4');
    expect(formatTranslationProgress({ phase: 'build' })).toBe('Building locales');
});

it('shows overall progress across the shared scan and all translation files', () => {
    expect(formatTranslationProgress({ phase: 'scan', completed: 550, total: 3213, overallCompleted: 550, overallTotal: 3225 }))
        .toBe('Overall 17% — Scanning source files 550/3213');
    expect(formatTranslationProgress({ phase: 'cleanup', completed: 12, total: 12, translationFile: '/repo/fr.json', overallCompleted: 3225, overallTotal: 3225 }))
        .toBe('Overall 100% — Cleaning translation files (fr.json) 12/12');
});
