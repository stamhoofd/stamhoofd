import { TranslatorType } from '../enums/TranslatorType.js';

export type MachineTranslationComparisonItem = {
    original: string;
    translations: Record<TranslatorType, string>;
};

export type MachineTranslationComparison = Record<string, MachineTranslationComparisonItem>;
