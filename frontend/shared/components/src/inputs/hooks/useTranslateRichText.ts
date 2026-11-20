import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import { LanguageHelper, RichText, TranslatedRichText } from '@stamhoofd/structures';
import { isTipTapDocument } from '@stamhoofd/structures/endpoints/TranslateRequest.js';
import { TranslateRequest } from '@stamhoofd/structures/endpoints/TranslateRequest.js';
import type { TranslatableValue } from '@stamhoofd/structures/endpoints/TranslateRequest.js';
import type { Language } from '@stamhoofd/types/Language';

import { useTranslator } from '#hooks/useTranslator.ts';
import { CenteredMessage } from '../../overlays/CenteredMessage';
import { Toast } from '../../overlays/Toast';
import type { RichTextEditorOptions } from '../../editor/richTextEditor';
import { richTextFromJSON } from '../../editor/richTextEditor';

/**
 * The language a translation starts from: the interface language when it has content, otherwise the
 * first language that has content.
 */
export function getTranslationSourceLanguage(value: TranslatedRichText): Language | null {
    if (value.isDefault) {
        return null;
    }
    const languages = I18nController.shared.availableLanguages.filter(language => value.getIfExists(language)?.text);
    if (languages.length === 0) {
        return null;
    }
    return languages.includes($getLanguage()) ? $getLanguage() : languages[0];
}

/**
 * Translates one language of a TranslatedRichText into every other available language with AI,
 * the same way as the automatic translation of an email.
 */
export function useTranslateRichText(options: RichTextEditorOptions = {}) {
    const translate = useTranslator();

    return async function translateToOtherLanguages(value: TranslatedRichText): Promise<TranslatedRichText | null> {
        const source = getTranslationSourceLanguage(value);
        if (source === null) {
            return null;
        }

        const targetLanguages = I18nController.shared.availableLanguages.filter(language => language !== source);
        if (targetLanguages.length === 0) {
            return null;
        }

        const existing = targetLanguages.filter(language => value.getIfExists(language)?.text);
        if (existing.length > 0 && !await CenteredMessage.confirm({
            title: $t('%Znj'),
            description: $t('%Znz', { languages: existing.map(language => LanguageHelper.getName(language)).join(', ') }),
            confirmText: $t('%ko'),
            destructive: true,
        })) {
            return null;
        }

        const content = value.get(source);
        if (!content.text) {
            return null;
        }

        // Content stored before the json field existed is translated as plain text
        const inputs = new Map<string, TranslatableValue>([
            ['body', isTipTapDocument(content.json) ? content.json : content.text],
        ]);

        const toast = new Toast($t('%Znw'), 'spinner').setHide(null).show();
        try {
            const response = await translate(TranslateRequest.create({
                inputs,
                sourceLanguage: source,
                targetLanguages,
            }));

            let translated = value;
            for (const language of targetLanguages) {
                const body = response.translations.get(language)?.get('body');
                if (body === undefined) {
                    continue;
                }
                translated = translated.patch({
                    [language]: isTipTapDocument(body) ? richTextFromJSON(body, options) : RichText.fromText(body),
                });
            }

            Toast.success($t('%Znk', { languages: targetLanguages.map(language => LanguageHelper.getName(language)).join(', ') })).show();
            return translated;
        } catch (e) {
            Toast.fromError(e).show();
            return null;
        } finally {
            toast.hide();
        }
    };
}
