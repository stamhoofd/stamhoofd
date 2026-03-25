import { MachineTranslationComparer } from './MachineTranslationComparer.js';
import { TranslationManager } from './TranslationManager.js';

export function createAutoTranslateComparison() {
    const manager = new TranslationManager();
    const comparer = new MachineTranslationComparer(manager);
    comparer.createComparisons();
}
