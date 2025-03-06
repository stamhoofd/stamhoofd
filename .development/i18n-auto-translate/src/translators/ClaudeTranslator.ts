import Anthropic from '@anthropic-ai/sdk';
import chalk from 'chalk';
import { PromiseQueue } from "../PromiseQueue";
import { TranslationManager } from "../TranslationManager";
import { Translator } from "./Translator";

export class ClaudeTranslator extends Translator {
    protected readonly maxBatchLength = 3000;
    protected readonly queue = new PromiseQueue<(string | null)[]>(3, 500);
    protected readonly anthropic: Anthropic;

    constructor(manager: TranslationManager) {
        super(manager);

        this.anthropic = new Anthropic({
            apiKey: 'my_api_key', // defaults to process.env["ANTHROPIC_API_KEY"]
          });

          throw new Error('Not implemented');
    }

    protected async generateResponse(prompt: string): Promise<string> {
        const msg = await this.anthropic.messages.create({
            model: "claude-3-7-sonnet-20250219",
            max_tokens: 1024,
            messages: [{ role: "user", content: prompt }],
          });

          console.log(chalk.yellow(msg));

          // todo
          return JSON.stringify(msg);
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
