import { SimpleError } from '@simonbackx/simple-errors';
import type { TipTapDocument, TranslatableValue } from '@stamhoofd/structures/endpoints/TranslateRequest.js';
import { isTipTapDocument } from '@stamhoofd/structures/endpoints/TranslateRequest.js';
import { Language } from '@stamhoofd/types/Language';
import OpenAI from 'openai';

export const TRANSLATION_MODEL = 'gpt-5.5';

const LANGUAGE_NAMES: Record<Language, string> = {
    [Language.Dutch]: 'Dutch',
    [Language.English]: 'English',
    [Language.French]: 'French',
};

export type TranslationRequest = {
    inputs: Map<string, TranslatableValue>;
    sourceLanguage: Language | null;
    targetLanguages: Language[];
    context: string | null;
};

type ModelOutput = {
    translations?: Record<string, unknown>;
};

export class TranslationService {
    static get isConfigured(): boolean {
        return !!STAMHOOFD.OPENAI_API_KEY;
    }

    private static createClient(): OpenAI {
        const apiKey = STAMHOOFD.OPENAI_API_KEY;
        if (!apiKey) {
            throw new SimpleError({
                code: 'translation_not_configured',
                message: 'OpenAI is not configured',
                human: $t('Automatische vertalingen zijn niet geconfigureerd op deze server'),
            });
        }
        return new OpenAI({ apiKey });
    }

    /**
     * Translates all inputs into every target language. Each language is a separate model call, so
     * one failing language fails the whole request.
     */
    static async translate(request: TranslationRequest): Promise<Map<Language, Map<string, TranslatableValue>>> {
        const client = this.createClient();
        const uniqueLanguages = [...new Set(request.targetLanguages)];

        const results = await Promise.all(uniqueLanguages.map(async (language) => {
            const translations = await this.translateToLanguage(client, request, language);
            return [language, translations] as const;
        }));

        return new Map(results);
    }

    private static async translateToLanguage(client: OpenAI, request: TranslationRequest, targetLanguage: Language): Promise<Map<string, TranslatableValue>> {
        const inputs = Object.fromEntries(request.inputs);

        let response: OpenAI.Chat.Completions.ChatCompletion;
        try {
            response = await client.chat.completions.create({
                model: TRANSLATION_MODEL,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: this.buildSystemPrompt(request, targetLanguage) },
                    {
                        role: 'user',
                        content: JSON.stringify({
                            targetLanguage: LANGUAGE_NAMES[targetLanguage],
                            inputs,
                        }),
                    },
                ],
            });
        } catch (e) {
            console.error('OpenAI translation request failed', e);
            throw new SimpleError({
                code: 'translation_failed',
                message: 'Translation request to OpenAI failed',
                human: $t('De vertaling is mislukt. Probeer het later opnieuw.'),
            });
        }

        const content = response.choices[0]?.message?.content;
        const parsed = this.parseOutput(content);

        const result = new Map<string, TranslatableValue>();
        for (const [key, original] of request.inputs) {
            result.set(key, this.validateTranslation(key, original, parsed.translations?.[key]));
        }
        return result;
    }

    private static buildSystemPrompt(request: TranslationRequest, targetLanguage: Language): string {
        const lines = [
            `You are a professional translator. Translate the values of the "inputs" object in the user message into ${LANGUAGE_NAMES[targetLanguage]}.`,
            request.sourceLanguage ? `The inputs are written in ${LANGUAGE_NAMES[request.sourceLanguage]}.` : 'Detect the source language of the inputs.',
            'The inputs belong together (e.g. a name and a description of the same item): use them as context for each other, keep terminology consistent across them.',
            'Input values are either plain strings or TipTap/ProseMirror JSON documents.',
            '- Plain strings: return the translated string. Keep placeholders like {{name}} or {firstName} exactly as they are.',
            '- TipTap documents: return a document with exactly the same structure, node types, attrs and marks. Only translate the "text" property of text nodes. Never add, remove or reorder nodes, and never translate attrs such as ids, hrefs or smart variable names.',
            'Preserve the tone and formatting of the original. Do not add explanations.',
            'Respond with a JSON object of the form {"translations": {...}} where "translations" has exactly the same keys as "inputs", each mapped to its translated value.',
        ];

        if (request.context) {
            lines.push('', 'Additional requirements from the user:', request.context);
        }

        return lines.join('\n');
    }

    private static parseOutput(content: string | null | undefined): ModelOutput {
        if (!content) {
            throw this.invalidOutputError('OpenAI returned an empty response');
        }
        try {
            const parsed = JSON.parse(content) as unknown;
            if (typeof parsed !== 'object' || parsed === null) {
                throw new Error('not an object');
            }
            return parsed as ModelOutput;
        } catch {
            throw this.invalidOutputError('OpenAI returned invalid JSON');
        }
    }

    private static validateTranslation(key: string, original: TranslatableValue, translated: unknown): TranslatableValue {
        if (typeof original === 'string') {
            if (typeof translated !== 'string') {
                throw this.invalidOutputError(`Missing or invalid translation for "${key}"`);
            }
            return translated;
        }

        if (!isTipTapDocument(translated) || translated.type !== original.type) {
            throw this.invalidOutputError(`Missing or invalid document translation for "${key}"`);
        }
        return translated as TipTapDocument;
    }

    private static invalidOutputError(message: string): SimpleError {
        return new SimpleError({
            code: 'translation_invalid_output',
            message,
            human: $t('De vertaling is mislukt. Probeer het later opnieuw.'),
        });
    }
}
