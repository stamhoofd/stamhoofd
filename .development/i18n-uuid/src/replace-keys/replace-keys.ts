import { addMissingKeys } from "./add-missing-keys";
import { compressUuids } from "./compress-uuids";
import { replaceKeysWithUuid } from "./replace-keys-with-uuid";

export function replaceKeys() {
    replaceKeysWithUuid();
    addMissingKeys();
    //compressUuids()
}
