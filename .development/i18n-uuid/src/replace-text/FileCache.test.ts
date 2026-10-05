import fs from 'fs';
import path from 'node:path';
import { expect, it, vi } from 'vitest';
import { fileCache } from './FileCache.js';

it('reads source-processing caches from the translation package directory', () => {
    const read = vi.spyOn(fs, 'readFileSync').mockReturnValue('/example.vue');
    expect(fileCache.hasFile('/example.vue')).toBe(true);
    expect(read).toHaveBeenNthCalledWith(1, path.resolve(import.meta.dirname, '../..', 'file-cache.txt'), 'utf8');
    expect(read).toHaveBeenNthCalledWith(2, path.resolve(import.meta.dirname, '../..', 'file-cache-doubt.txt'), 'utf8');
});
