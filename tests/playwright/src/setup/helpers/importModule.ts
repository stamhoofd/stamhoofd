import { createRequire } from "node:module";
import { resolve } from "node:path";

export function importModule(id: string) {
    const monoRepoRoot = resolve(__dirname, "../../../../../node_modules");
    const require = createRequire(monoRepoRoot);
    return require(id);
}
