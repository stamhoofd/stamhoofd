import { createRequire } from "node:module";
import { resolve } from "node:path";
import { getCurrentDir } from "./getCurrentDir";

export function importModule(id: string) {
    const monoRepoRoot = resolve(getCurrentDir(import.meta), "../../../../../node_modules");
    const require = createRequire(monoRepoRoot);
    return require(id);
}
