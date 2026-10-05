import type { TranslatorType } from '../enums/TranslatorType.js';

export interface AutoTranslateOptions {
    apiKey?: string;
    fake: boolean;
    translatorType: TranslatorType;
    locales: string[] | undefined;
}
