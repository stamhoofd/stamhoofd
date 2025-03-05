import { GenerativeModel, GoogleGenerativeAI, Schema, SchemaType } from "@google/generative-ai";
import { globals } from "../globals";
import { TranslationManager } from "../TranslationManager";
import { Translator } from "./Translator";

export class GoogleTranslator extends Translator {
    private readonly genAI: GoogleGenerativeAI;
    private readonly model: GenerativeModel;
    protected readonly maxBatchLength = 15000;


    constructor(manager: TranslationManager) {
        super(manager);
        this.genAI = new GoogleGenerativeAI(globals.GEMINI_API_KEY);

        const schema: Schema = {
            description: "List of translations",
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.STRING
            },
          };

        this.model = this.genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        });
    }


    protected async generateResponse(prompt: string): Promise<string> {
        const apiResult = await this.model.generateContent(prompt);
        return apiResult.response.text();
    }

    protected createPrompt(textArray: string[], { originalLocal, targetLocal, consistentWords, namespace }: { originalLocal: string; targetLocal: string; consistentWords: Record<string, string> | null; namespace: string; }): string {
                // - Try to use the same word for things you referenced in other translations to. E.g. 'vereniging' should be 'organization' everywhere.
        // - Be consistent and copy the caps and punctuation of the original language unless a capital letter is required in English (e.g. weekdays)
        // - Do not change inline replacement values, which are recognizable by either the # prefix or surrounding curly brackets: #groep, {name}

        const consistentWordsText = consistentWords ? ` Use this dictionary of translations for consistency: ` + JSON.stringify(consistentWords) + '.' : '';

        const prompt = `Translate the values of the json array from ${originalLocal} to ${targetLocal}. Do not translate text between curly brackets. Keep the original order.${consistentWordsText} This is the array: ${JSON.stringify(textArray)}`;

        return prompt;
    }
}
