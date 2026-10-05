import { addMissingKeys } from './add-missing-keys.js';
import { compressUuids } from './compress-uuids.js';
import { replaceKeysWithUuid } from './replace-keys-with-uuid.js';
import type { ProgressCallback } from '../shared/progress.js';

export async function replaceKeys(onProgress?: ProgressCallback) {
    await replaceKeysWithUuid(onProgress);
    const added = await addMissingKeys(onProgress);
    await compressUuids(onProgress);
    return added;
}
