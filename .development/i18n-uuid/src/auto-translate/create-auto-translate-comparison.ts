import { MachineTranslationComparer } from "./MachineTranslationComparer";
import { TranslationManager } from "./TranslationManager";

export function createAutoTranslateComparison() {
    const manager = new TranslationManager();
    const comparer = new MachineTranslationComparer(manager);
    comparer.createComparisons();
}
