import { Mistral } from '@mistralai/mistralai';
import chalk from 'chalk';
import { globals } from "../globals";
import { PromiseQueue } from "../PromiseQueue";
import { TranslationManager } from "../TranslationManager";
import { Translator } from "./Translator";

export class MistralTranslator extends Translator {
    protected readonly maxBatchLength = 3000;
    protected readonly queue = new PromiseQueue<(string | null)[]>(3, 500);
    private readonly client: Mistral;

    constructor(manager: TranslationManager) {
        super(manager);
        this.client = new Mistral({apiKey: globals.MISTRAL_API_KEY});
    }

    protected async generateResponse(prompt: string): Promise<string> {
        const chatResponse = await this.client.chat.complete({
            // model: 'mistral-large-latest',
            model: 'mistral-small-latest',
            messages: [{role: 'user', content: prompt}],
          });

          const text = chatResponse.choices?.[0].message.content?.toString() ?? '';
          
          console.log(chalk.blue('Chat:', chatResponse.choices?.[0].message.content));

          return text;
    }

    protected override transformParsedJson<T>(parsedJson: T): T {
        if(Array.isArray(parsedJson)) {
            return parsedJson.map(value => {
                if(typeof value === 'string' && value.trim().length === 0) {
                    return null;
                }

                return value;
            }) as T;
        }

        return parsedJson;
    }

    protected createPrompt(
        textArray: string[],
        {
            originalLocal,
            targetLocal,
            consistentWords,
            namespace,
        }: {
            originalLocal: string;
            targetLocal: string;
            consistentWords: Record<string, string> | null;
            namespace: string;
        },
    ): string {
        const consistentWordsText = consistentWords
            ? ` Use this dictionary of translations for consistency: ` +
              JSON.stringify(consistentWords) +
              "."
            : "";

        const prompt = `Translate the values of the json array from ${originalLocal} to ${targetLocal}. Keep the original order.${consistentWordsText}

Important: do not translate words between curly brackets (even if it is a consistent word). For example {vereniging} must remain {vereniging}.

Translate this array: ${JSON.stringify(textArray)}`;

        return prompt;
    }
}
