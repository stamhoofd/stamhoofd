import { AnyDecoder, AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import type { Language } from '@stamhoofd/types/Language';

/**
 * The full content of an email or email template in a single language.
 * html and text are derived from the editor json, so they always belong together as a set.
 */
export class EmailContent extends AutoEncoder {
    @field({ decoder: StringDecoder })
    subject = '';

    /**
     * Template converted to HTML, with the {{replacements}} still in place
     */
    @field({ decoder: StringDecoder })
    html = '';

    @field({ decoder: StringDecoder })
    text = '';

    /**
     * Raw editor json used to edit the content
     */
    @field({ decoder: AnyDecoder })
    json: any = {};
}

/**
 * Strict language selection: only searches the provided translations map and falls back to
 * the default content (which holds the default language when one is set). It never falls back
 * to a different template (level), so the content always stays correct — better correct content
 * in the wrong language than wrong content in the right language.
 */
export function getEmailContentForLanguage(defaultContent: EmailContent, translations: Map<Language, EmailContent>, language: Language | null): EmailContent {
    if (language !== null) {
        const translated = translations.get(language);
        if (translated) {
            return translated;
        }
    }
    return defaultContent;
}

/**
 * An email or email template only supports these states:
 * 1. Untranslated: no language set and no translations
 * 2. One language: language set, no translations (the default content is that language)
 * 3. Multiple languages: language set, the default content holds that language and
 *    translations hold every other language — never the default language itself
 */
export function validateEmailTranslations({ language, translations }: { language: Language | null; translations: Map<Language, EmailContent> }) {
    if (language === null && translations.size > 0) {
        throw new SimpleError({
            code: 'invalid_translations',
            message: 'Translations require a default language',
            human: $t('De vertalingen konden niet worden opgeslagen omdat de standaardtaal ontbreekt. Herlaad de pagina en probeer opnieuw.'),
            field: 'translations',
        });
    }

    if (language !== null && translations.has(language)) {
        throw new SimpleError({
            code: 'invalid_translations',
            message: 'Translations cannot contain the default language',
            human: $t('De vertalingen konden niet worden opgeslagen omdat de standaardtaal ook een vertaling bevat. Herlaad de pagina en probeer opnieuw.'),
            field: 'translations',
        });
    }
}
