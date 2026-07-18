import type { Language } from '@stamhoofd/types/Language';
import { Formatter } from '@stamhoofd/utility';

export type TranslatedUrl = Record<Language | '', string>;

export function buildTranslatedUrl(url: Record<Language, string>): TranslatedUrl {
    return {
        '': url[$getLanguage()] ?? url['en'],
        ...url,
    };
}

export function getUrls(urls: TranslatedUrl) {
    const url = urls[''] ?? urls[$getLanguage()] ?? urls[Object.keys(urls)[0] as Language];
    return {
        url,
        alternativeUrls: Object.values(urls).filter(u => u !== url),
    };
}

export function extendTranslatedUrl(url: TranslatedUrl, part: TranslatedUrl | string): TranslatedUrl {
    const languages = Formatter.uniqueArray([
        '',
        ...Object.keys(url),
        ...(typeof part !== 'string' ? Object.keys(part) : []),
    ]) as (Language | '')[];
    const result: TranslatedUrl = {} as TranslatedUrl;
    for (const lang of languages) {
        result[lang] = (url[lang] ?? url['']) + '/' + (
            typeof part !== 'string'
                ? (part[lang] ?? part[''])
                : part
        );
    }
    return result;
}
