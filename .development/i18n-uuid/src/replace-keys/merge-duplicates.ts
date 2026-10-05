import { decodeBase62, isBase62 } from './compress-uuids.js';
import { getTranslationsWithPath } from './get-translations-with-path.js';
import { replaceOccurrences } from './replace-keys-with-uuid.js';
import { reportProgress } from '../shared/progress.js';
import type { ProgressCallback } from '../shared/progress.js';

/**
 * Merge compact translation keys whose text and human-maintained locale-file coverage are identical.
 * Machine translations and reserved metadata do not participate in duplicate detection.
 *
 * Each key's (file path, text) pairs form a sorted JSON signature. Keys sharing a signature are
 * grouped together, and every duplicate maps directly to the group's smallest numeric base62 key.
 * For example, these dictionaries produce the group [%2, %5, %z]:
 *   nl.json: { "%2": "Opslaan", "%5": "Opslaan", "%z": "Opslaan" }
 *   fr.json: { "%2": "Enregistrer", "%5": "Enregistrer", "%z": "Enregistrer" }
 * Source usages such as $t('%5') and $t('%z') become $t('%2'). A key with different French text,
 * or with no entry in fr.json, belongs to a separate group even if its Dutch text matches.
 *
 * Only source usages are rewritten here; the subsequent unused-key cleanup removes redundant
 * locale entries. Returns the number of duplicate keys mapped to a surviving key (2 above),
 * rather than the number of source occurrences replaced.
 */
export async function mergeDuplicates(onProgress?: ProgressCallback) {
    const translationsWithPath = getTranslationsWithPath();

    // Index by key across files, e.g. %2 → { nl.json → 'Opslaan', fr.json → 'Enregistrer' }.
    // Paths also distinguish namespace overrides, such as fr.json and digit/fr.json.
    const translationsForKeys = new Map<string, Map<string, string>>();

    for (const [filePath, translations] of translationsWithPath) {
        for (const key in translations) {
            if (key === 'replacements' || key === 'extends' || key === 'consistent-words') {
                continue;
            }
            if (typeof translations[key] === 'string') {
                const existingMap = translationsForKeys.get(key);
                if (existingMap) {
                    existingMap.set(filePath, translations[key]);
                }
                else {
                    translationsForKeys.set(key, new Map([[
                        filePath, translations[key],
                    ]]));
                }
            }
        }
    }

    const groups = new Map<string, string[]>();
    const merge: Map<string, string> = new Map();
    let completed = 0;
    await reportProgress(onProgress, { phase: 'compare', completed, total: translationsForKeys.size });
    for (const [uuid, values] of translationsForKeys.entries()) {
        if (isBase62(uuid)) {
            // Sort by path so file insertion order does not affect equality. For example:
            // [['fr.json', 'Enregistrer'], ['nl.json', 'Opslaan']] becomes one JSON map key.
            // Including paths keeps Dutch-only keys separate from keys also translated in French.
            const signature = JSON.stringify([...values].sort(([a], [b]) => a.localeCompare(b)));
            // Matching signatures collect keys into a group, e.g. [%2, %5, %z].
            const group = groups.get(signature);
            if (group) group.push(uuid);
            else groups.set(signature, [uuid]);
        }
        await reportProgress(onProgress, { phase: 'compare', completed: ++completed, total: translationsForKeys.size });
    }

    for (const keys of groups.values()) {
        // Choose by decoded number, not spelling: [%10, %z, %2] selects %2 regardless of order.
        const target = keys.reduce((a, b) => decodeBase62(a) <= decodeBase62(b) ? a : b);
        // Every duplicate points to the final key: %10 → %2 and %z → %2. A singleton adds nothing.
        for (const key of keys) {
            if (key !== target) merge.set(key, target);
        }
    }

    // Run multiple times to avoid regex errors
    await replaceOccurrences(merge, undefined, onProgress);
    await replaceOccurrences(merge, undefined, onProgress);
    await replaceOccurrences(merge, undefined, onProgress);
    return merge.size;
}
