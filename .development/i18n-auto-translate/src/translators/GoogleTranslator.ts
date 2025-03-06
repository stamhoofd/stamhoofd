import {
    GenerativeModel,
    GoogleGenerativeAI,
    Schema,
    SchemaType,
} from "@google/generative-ai";
import { globals } from "../globals";
import { PromiseQueue } from "../PromiseQueue";
import { TranslationManager } from "../TranslationManager";
import { Translator } from "./Translator";

export class GoogleTranslator extends Translator {
    private readonly genAI: GoogleGenerativeAI;
    private readonly model: GenerativeModel;
    protected readonly maxBatchLength = 3000;
    protected readonly queue = new PromiseQueue<(string | null)[]>(3, 500);

    constructor(manager: TranslationManager) {
        super(manager);
        this.genAI = new GoogleGenerativeAI(globals.GEMINI_API_KEY);

        const schema: Schema = {
            description: "List of translations",
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.STRING,
            },
        };

        this.model = this.genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        });
    }

    protected async generateResponse(prompt: string): Promise<string> {
        const apiResult = await this.model.generateContent(prompt);
        return apiResult.response.text();
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
