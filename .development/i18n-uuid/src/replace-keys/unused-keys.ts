import { getTranslationsWithPath } from './get-translations-with-path.js';
import { findUnusedTranslationKeys } from './replace-keys-with-uuid.js';
import { writeTranslation } from './write-translations.js';
import type { ProgressCallback } from '../shared/progress.js';
import { reportProgress } from '../shared/progress.js';
import { getFilesToSearch, translatableFileTypes } from '../shared/get-files-to-search.js';

export async function unusedKeys(onProgress?: ProgressCallback) {
    const translationsWithPath = getTranslationsWithPath();
    const keys = new Set<string>();
    for (const translations of translationsWithPath.values()) {
        for (const key in translations) {
            if (key === 'replacements' || key === 'extends' || key === 'consistent-words') {
                continue;
            }
            if (typeof translations[key] === 'string') {
                keys.add(key);
            }
        }
    }

    const files = keys.size ? getFilesToSearch(translatableFileTypes) : [];
    const overallTotal = files.length + translationsWithPath.size;
    const unusedKeys = await findUnusedTranslationKeys(keys, files, progress => onProgress?.({ ...progress, overallCompleted: progress.completed, overallTotal }));
    let removed = 0;
    let completed = 0;
    for (const [filePath, translations] of translationsWithPath) {
        let changed = false;
        for (const key of unusedKeys) {
            if (typeof translations[key] === 'string') {
                delete translations[key];
                removed++;
                changed = true;
            }
        }

        if (changed) {
            writeTranslation(filePath, translations);
        }
        completed++;
        await reportProgress(onProgress, {
            phase: 'cleanup', completed, total: translationsWithPath.size, translationFile: filePath,
            overallCompleted: files.length + completed, overallTotal,
        });
    }
    return removed;
}
