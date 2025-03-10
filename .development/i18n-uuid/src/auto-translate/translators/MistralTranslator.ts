import { Mistral } from '@mistralai/mistralai';
import { globals } from '../../shared/globals';
import { AutoTranslateOptions } from '../../types/AutoTranslateOptions';
import { Batch } from '../../types/Batch';
import { PromiseQueue } from "../PromiseQueue";
import { TranslationManager } from "../TranslationManager";
import { Translator } from "./Translator";

abstract class MistralTranslator extends Translator {
    protected readonly maxBatchLength = 15000;

    // Mistral current Requests per second: 1 rps -> 1200ms (with extrta margin)
    protected readonly queue = this.options.fake ? new PromiseQueue<Batch>(100, 0) : new PromiseQueue<Batch>(20, 1200);
    private readonly client: Mistral;
    protected abstract readonly model: string;

    constructor(manager: TranslationManager, options: AutoTranslateOptions) {
        super(manager, options);
        this.client = new Mistral({apiKey: globals.MISTRAL_API_KEY});
    }

    protected override canRetryBatch(error: any): boolean {
        if(error?.statusCode === 429 || error?.body?.includes('Requests rate limit exceeded')) {
            // Requests rate limit exceeded
            return true;
        }

        return false;
    }

    protected async generateResponse(prompt: string): Promise<string> {
        const chatResponse = await this.client.chat.complete({
            model: this.model,
            messages: [{role: 'user', content: prompt}],
          });

          const text = chatResponse.choices?.[0].message.content?.toString() ?? '';

          return this.extractJsonArrayFromResponse(text);
    }

    private extractJsonArrayFromResponse(response: string): string {
        const regex = /```json\n((?:.|\r|\n)*)```/;

        const match = response.match(regex);
        const jsonString = match?.[1];

        if(!jsonString) {
            return response;
        }

        return jsonString;
    }
}

export class MistralSmallTranslator extends MistralTranslator {
    protected readonly model = 'mistral-small-latest';
}

export class MistralLargeTranslator extends MistralTranslator {
    protected readonly model = 'mistral-large-latest';
}
