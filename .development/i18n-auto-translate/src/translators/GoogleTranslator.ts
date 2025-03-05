import { GenerativeModel, GoogleGenerativeAI, Schema, SchemaType } from "@google/generative-ai";
import { globals } from "../globals";
import { promptLogger } from "../PromptLogger";
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

    protected async translateBatch(batch: string[], args: { originalLocal: string; targetLocal: string; consistentWords: Record<string, string> | null; namespace: string, batchNumber: number, totalBatches: number }): Promise<string[]> {
        const text = await this.getTextFromApi(batch, args);
        const json = this.textToJson(text);

        if(json.length !== batch.length) {
            throw new Error("Json length does not match batch length.");
        }

        return json;
    }

    // private async getTextFromApi(textArray: string[], {originalLocal, targetLocal, consistentWords, namespace, batchNumber, totalBatches}: { originalLocal: string; targetLocal: string; consistentWords: Record<string, string> | null, namespace: string,batchNumber: number, totalBatches: number }): Promise<string> {
    //     // - Try to use the same word for things you referenced in other translations to. E.g. 'vereniging' should be 'organization' everywhere.
    //     // - Be consistent and copy the caps and punctuation of the original language unless a capital letter is required in English (e.g. weekdays)
    //     // - Do not change inline replacement values, which are recognizable by either the # prefix or surrounding curly brackets: #groep, {name}

    //     const consistentWordsText = consistentWords ? ` Use this dictionary of translations for consistency: ` + JSON.stringify(consistentWords) + '.' : '';

    //     const prompt = `Translate the values of the json array from ${originalLocal} to ${targetLocal}. Do not translate text between curly brackets. Keep the original order.${consistentWordsText} This is the array: ${JSON.stringify(textArray)}`;

    //     const logResult = promptLogger.prompt(prompt, {
    //         originalLocal,
    //         targetLocal,
    //         namespace,
    //         batchNumber,
    //         totalBatches
    //     });
          
    //     const apiResult = await this.model.generateContent(prompt);
    //     const text = apiResult.response.text();
    //     // const text = JSON.stringify(textArray);

    //     logResult(text);
        
    //     return text;
    // }

    private async getTextFromApi(textArray: string[], {originalLocal, targetLocal, consistentWords, namespace, batchNumber, totalBatches}: { originalLocal: string; targetLocal: string; consistentWords: Record<string, string> | null, namespace: string,batchNumber: number, totalBatches: number }): Promise<string> {
        // - Try to use the same word for things you referenced in other translations to. E.g. 'vereniging' should be 'organization' everywhere.
        // - Be consistent and copy the caps and punctuation of the original language unless a capital letter is required in English (e.g. weekdays)
        // - Do not change inline replacement values, which are recognizable by either the # prefix or surrounding curly brackets: #groep, {name}

        const consistentWordsText = consistentWords ? ` Use this dictionary of translations for consistency: ` + JSON.stringify(consistentWords) + '.' : '';

        const prompt = `Translate the values of the json array from ${originalLocal} to ${targetLocal}. Do not translate text between curly brackets. Keep the original order.${consistentWordsText} This is the array: ${JSON.stringify(textArray)}`;

        const logResult = promptLogger.prompt(prompt, {
            originalLocal,
            targetLocal,
            namespace,
            batchNumber,
            totalBatches
        });
          
        const apiResult = await this.model.generateContent(prompt);
        const text = apiResult.response.text();

        logResult(text);
        
        return text;
    }

    private textToJson(result: string): string[] {
        const json = JSON.parse(result);
        const {isValid, message} = this.validateJson(json);

        if(!isValid) {
            throw new Error(message);
        }

        return json;
    }

    private validateJson(json: any): {isValid: boolean, message?: string} {
        if(typeof json !== "object") {
            return {
                isValid: false,
                message: "Json is not an object."
            }
        }

        if(!Array.isArray(json)) {
            return {
                isValid: false,
                message: "Json is not an array."
            }
        }

        if(json.some(item => typeof item !== "string")) {
            return {
                isValid: false,
                message: "Json is not an array of strings."
            }
        }

        return {
            isValid: true
        }
    }
}
