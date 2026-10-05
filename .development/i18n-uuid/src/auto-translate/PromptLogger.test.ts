import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { promptLogger } from './PromptLogger.js';

it('writes and flushes logs in the explicitly selected directory', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'translation-logs-'));
    try {
        promptLogger.initialize(directory);
        try {
            const complete = promptLogger.prompt('Translate this text', {
                originalLocal: 'nl-BE', targetLocal: 'fr', namespace: 'stamhoofd', batchNumber: 1, totalBatches: 1,
            });
            complete('Translated result');
            promptLogger.error('Translation error');
        }
        finally {
            await promptLogger.close();
        }
        const prompts = await fs.readFile(path.join(directory, 'prompts.log'), 'utf8');
        expect(prompts).toContain('Translate this text');
        expect(prompts).toContain('Translated result');
        expect(await fs.readFile(path.join(directory, 'errors.log'), 'utf8')).toContain('Translation error');
    }
    finally {
        await fs.rm(directory, { recursive: true, force: true });
    }
});
