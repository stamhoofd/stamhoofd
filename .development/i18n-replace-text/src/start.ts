import { getCliArguments } from "./node-cli-argument-reader";
import { translateVueFiles } from "./translate-vue-files";

export function start() {
    const args = getCliArguments();

    translateVueFiles(args);
}
