import OpenAI from 'openai';
import type { AutoTranslateOptions } from '../../types/AutoTranslateOptions.js';
import type { Batch } from '../../types/Batch.js';
import { PromiseQueue } from '../PromiseQueue.js';
import type { TranslationManager } from '../TranslationManager.js';
import { Translator } from './Translator.js';

export class OpenAiTranslator extends Translator {
    protected readonly maxBatchLength = 5000;
    protected readonly queue = new PromiseQueue<Batch<any>>(2, 60 * 1000 / 45); // 500 requests per minute
    protected readonly openai: OpenAI | undefined;

    constructor(manager: TranslationManager, options: AutoTranslateOptions) {
        super(manager, options);

        this.openai = options.fake ? undefined : new OpenAI({ apiKey: options.apiKey });
    }

    protected async generateResponse(prompt: string): Promise<string> {
        const result = await this.openai!.chat.completions.create({
            model: 'gpt-4.1-2025-04-14',
            store: true,
            messages: [{ role: 'user', content: prompt }],
            response_format: {
                type: 'json_schema',
                json_schema: {
                    name: 'translations',
                    strict: true,
                    schema: {
                        type: 'object',
                        properties: {
                            translations: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'integer' },
                                        value: { type: 'string' },
                                    },
                                    additionalProperties: false,
                                    required: ['id', 'value'],
                                },
                            },
                        },
                        additionalProperties: false,
                        required: ['translations'],
                    },
                },
            },
        });

        return result.choices[0].message.content ?? '';
    }

    protected override validateJson(json: any): { isValid: boolean; message?: string } {
        return {
            isValid: true,
        };
    }

    protected override transformParsedJson<T>(parsedJson: T): T {
        if (typeof parsedJson !== 'object' || parsedJson === null) {
            throw new Error('Parsed JSON is not an object or is null');
        }
        if (!('translations' in parsedJson)) {
            throw new Error("Parsed JSON does not contain 'translations' property");
        }

        if (!Array.isArray((parsedJson).translations)) {
            throw new Error("'translations' property is not an array");
        }

        return parsedJson.translations.map((value) => {
            if (typeof value === 'string' && value.trim().length === 0) {
                return null;
            }

            return value;
        }) as T;
    }
}
