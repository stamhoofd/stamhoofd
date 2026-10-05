import type { TranslatorType } from '../enums/TranslatorType.js';
import type { ProgressCallback } from '../shared/progress.js';

export interface AutoTranslateOptions {
    apiKey?: string;
    onProgress?: ProgressCallback;
    fake: boolean;
    translatorType: TranslatorType;
    locales: string[] | undefined;
}
