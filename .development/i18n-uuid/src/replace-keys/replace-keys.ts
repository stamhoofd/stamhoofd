import { addMissingKeys } from './add-missing-keys.js';
import { compressUuids } from './compress-uuids.js';
import { replaceKeysWithUuid } from './replace-keys-with-uuid.js';

export function replaceKeys() {
    replaceKeysWithUuid();
    addMissingKeys();
    compressUuids();
}
