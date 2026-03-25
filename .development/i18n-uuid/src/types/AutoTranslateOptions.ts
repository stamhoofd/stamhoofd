import type { TranslatorType } from '../enums/TranslatorType.js';

export interface AutoTranslateOptions {
    fake: boolean;
    translatorType: TranslatorType;
    locales: string[] | undefined;
}
