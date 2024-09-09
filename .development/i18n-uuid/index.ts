import { addMissingKeys } from "./src/add-missing-keys";
import { replaceKeysWithUuid } from "./src/replace-keys-with-uuid";
import { syncMainLocales } from "./src/sync-main-locales";

replaceKeysWithUuid();
addMissingKeys();
syncMainLocales();

