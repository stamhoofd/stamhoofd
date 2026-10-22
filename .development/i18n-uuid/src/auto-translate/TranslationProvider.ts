import type { Translations } from '../types/Translations.js';
import type { MachineTranslationComparison } from './MachineTranslationComparison.js';

export interface TranslationProvider {
    readonly locales: readonly string[];
    readonly namespaces: readonly string[];
    getMappedLocale(locale: string): string;
    readDist(locale: string, namespace: string): Translations;
    readMachineTranslations(locale: string, namespace: string): Translations;
    setComparison(comparison: MachineTranslationComparison, args: { locale: string; namespace: string }): void;
}
