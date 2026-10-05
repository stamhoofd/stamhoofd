import { getTranslationsWithPath } from './get-translations-with-path.js';
import { findUnusedTranslationKeys } from './replace-keys-with-uuid.js';
import { writeTranslation } from './write-translations.js';
import type { ProgressCallback } from '../shared/progress.js';

export async function unusedKeys(onProgress?: ProgressCallback) {
    const translationsWithPath = getTranslationsWithPath();
    let removed = 0;
    for (const [filePath, translations] of translationsWithPath) {
        const keys = new Set<string>();

        for (const key in translations) {
            if (key === 'replacements' || key === 'extends' || key === 'consistent-words') {
                continue;
            }
            if (typeof translations[key] === 'string') {
                keys.add(key);
            }
        }

        const unusedKeys = await findUnusedTranslationKeys(keys, undefined, progress => onProgress?.({ ...progress, translationFile: filePath }));

        if (unusedKeys.size) {
            for (const key of unusedKeys.values()) {
                delete translations[key];
                removed++;
            }

            writeTranslation(filePath, translations);
        }
    }
    return removed;
}
