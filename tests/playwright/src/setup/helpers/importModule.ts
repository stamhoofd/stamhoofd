import { createRequire } from "node:module";
import { resolve } from "node:path";

export function importModule(id: string) {
    // todo: this may fail in CI
    const monoRepoRoot = resolve(__dirname, "../../../../../node_modules");
    const require = createRequire(monoRepoRoot);
    return require(id);
}
