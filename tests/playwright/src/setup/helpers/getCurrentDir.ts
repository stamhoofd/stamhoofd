import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export function getCurrentDir(importMeta: ImportMeta) {
    return dirname(fileURLToPath(importMeta.url));
}
