import chalk from "chalk";
import OpenAI from "openai";
import { globals } from "../globals";
import { PromiseQueue } from "../PromiseQueue";
import { TranslationManager } from "../TranslationManager";
import { Translator } from "./Translator";

export class OpenAiTranslator extends Translator {
    protected readonly maxBatchLength = 3000;
    protected readonly queue = new PromiseQueue<(string | null)[]>(3, 500);
    protected readonly openai: OpenAI;

    constructor(manager: TranslationManager) {
        super(manager);

        this.openai = new OpenAI({
            apiKey: globals.OPENAI_API_KEY,
        });

        throw new Error('Not implemented')
    }

    protected async generateResponse(prompt: string): Promise<string> {
        const result = await this.openai.chat.completions.create({
            model: "gpt-4o-mini",
            store: true,
            messages: [{ role: "user", content: prompt }],
        });

        console.log(chalk.blue(JSON.stringify(result)));

        return result.choices[0].message.content ?? "";
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
