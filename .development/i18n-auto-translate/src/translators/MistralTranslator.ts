import { Mistral } from '@mistralai/mistralai';
import chalk from 'chalk';
import { globals } from "../globals";
import { PromiseQueue } from "../PromiseQueue";
import { TranslationManager } from "../TranslationManager";
import { Batch } from '../types/Batch';
import { Translator } from "./Translator";

export class MistralTranslator extends Translator {
    protected readonly maxBatchLength = 15000;

    // Mistral current Requests per second: 1 rps -> 1200ms (with extrta margin)
    protected readonly queue = new PromiseQueue<Batch>(20, 1200);
    private readonly client: Mistral;

    constructor(manager: TranslationManager) {
        super(manager);
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
            // model: 'mistral-large-latest',
            model: 'mistral-small-latest',
            messages: [{role: 'user', content: prompt}],
          });

          const text = chatResponse.choices?.[0].message.content?.toString() ?? '';
          
          console.log(chalk.blue('Chat:', chatResponse.choices?.[0].message.content));

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
