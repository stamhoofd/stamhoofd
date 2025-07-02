import chalk from "chalk";
import OpenAI from "openai";
import { globals } from "../../shared/globals";
import { AutoTranslateOptions } from "../../types/AutoTranslateOptions";
import { Batch } from "../../types/Batch";
import { PromiseQueue } from "../PromiseQueue";
import { TranslationManager } from "../TranslationManager";
import { Translator } from "./Translator";

export class OpenAiTranslator extends Translator {
    protected readonly maxBatchLength = 15000;
    protected readonly queue = new PromiseQueue<Batch<any>>(10, 60 * 1000 / 45); // 500 requests per minute
    protected readonly openai: OpenAI;

    constructor(manager: TranslationManager, options: AutoTranslateOptions) {
        super(manager, options);

        this.openai = new OpenAI({
            apiKey: globals.OPENAI_API_KEY,
        });
    }

    protected async generateResponse(prompt: string): Promise<string> {
        const result = await this.openai.chat.completions.create({
            model: "gpt-4.1-mini-2025-04-14",
            store: true,
            messages: [{ role: "user", content: prompt }],
        });

        console.log(chalk.blue(JSON.stringify(result)));

        return result.choices[0].message.content ?? "";
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
}
