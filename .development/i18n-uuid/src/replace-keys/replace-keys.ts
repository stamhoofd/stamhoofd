import { addMissingKeys } from "./add-missing-keys";
import { replaceKeysWithUuid } from "./replace-keys-with-uuid";

export function replaceKeys() {
    replaceKeysWithUuid();
    addMissingKeys();
}
