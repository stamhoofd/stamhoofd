import type { Language } from './Language.js';

export type LanguageMap = {
    [key in Language]?: string;
};
