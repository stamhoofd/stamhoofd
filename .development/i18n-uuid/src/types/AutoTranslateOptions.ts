import { TranslatorType } from "../enums/TranslatorType";

export interface AutoTranslateOptions {
    fake: boolean;
    translatorType: TranslatorType;
    locales: string[] | undefined;
}
