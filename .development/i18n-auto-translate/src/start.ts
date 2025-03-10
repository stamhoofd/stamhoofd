/**
 * TODO:
 * - calcualte tokens
 * - calculate estimated price?
 * - improve prompt
 * - provide context?
 * - context caching?
 * - add feedback while translating (if it takes a long time for example)
 */

import { AutoTranslator } from "./AutoTranslator";
import { cliArguments } from "./CliArguments";
import { globals } from "./globals";
import { MachineTranslationComparer } from "./MachineTranslationComparer";
import { TranslationManager } from "./TranslationManager";

export async function start() {
    const manager = new TranslationManager();
    const autoTranslator = new AutoTranslator(globals.TRANSLATOR, manager);
    await autoTranslator.start();

    if(cliArguments.isTestCompare) {
        const comparer = new MachineTranslationComparer(manager);
        comparer.createComparisons();
    }
}
