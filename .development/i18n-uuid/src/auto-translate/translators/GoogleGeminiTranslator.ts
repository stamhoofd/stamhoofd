import type {
    GenerativeModel,
    Schema} from '@google/generative-ai';
import {
    GoogleGenerativeAI,
    SchemaType,
} from '@google/generative-ai';
import { globals } from '../../shared/globals.js';
import type { AutoTranslateOptions } from '../../types/AutoTranslateOptions.js';
import type { Batch } from '../../types/Batch.js';
import { PromiseQueue } from '../PromiseQueue.js';
import type { TranslationManager } from '../TranslationManager.js';
import { Translator } from './Translator.js';

export class GoogleGeminiTranslator extends Translator {
    private readonly genAI: GoogleGenerativeAI;
    private readonly model: GenerativeModel;
    protected readonly maxBatchLength = 15000;
    protected readonly queue = new PromiseQueue<Batch<any>>(2, 1000);

    constructor(manager: TranslationManager, options: AutoTranslateOptions) {
        super(manager, options);
        this.genAI = new GoogleGenerativeAI(globals.GEMINI_API_KEY);

        // https://ai.google.dev/gemini-api/docs/structured-output?lang=node
        const schema: Schema = {
            description: 'List of translations',
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    id: { type: SchemaType.NUMBER },
                    value: { type: SchemaType.STRING },
                },
            },
        };

        this.model = this.genAI.getGenerativeModel({
            model: 'gemini-1.5-flash',
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: schema,
            },
        });
    }

    protected async generateResponse(prompt: string): Promise<string> {
        const apiResult = await this.model.generateContent(prompt);
        return apiResult.response.text();
    }

    protected override transformParsedJson<T>(parsedJson: T): T {
        if (Array.isArray(parsedJson)) {
            return parsedJson.map((value) => {
                if (typeof value === 'string' && value.trim().length === 0) {
                    return null;
                }

                return value;
            }) as T;
        }

        return parsedJson;
    }
}
