import { addMissingKeys } from "./src/add-missing-keys";
import { replaceKeysWithUuid } from "./src/replace-keys-with-uuid";
import { syncMainLanguages } from "./src/sync-main-languages";

replaceKeysWithUuid();
addMissingKeys();
syncMainLanguages();

