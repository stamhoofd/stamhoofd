import { getCliArguments } from "./cli-arguments";
import { translateVueFiles } from "./translate-vue-files";

export function start() {
    const args = getCliArguments();

    translateVueFiles(args);
}
