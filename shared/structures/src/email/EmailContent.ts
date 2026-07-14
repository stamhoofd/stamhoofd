import { AnyDecoder, AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { Language } from '@stamhoofd/types/Language';

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
 * the default content. It never falls back to a different template (level), so the content
 * always stays correct — better correct content in the wrong language than wrong content
 * in the right language.
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
