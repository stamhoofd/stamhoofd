import { GenerativeModel, GoogleGenerativeAI, Schema, SchemaType } from "@google/generative-ai";
import chalk from "chalk";
import { globals } from "../globals";
import { promptLogger } from "../PromptLogger";
import { TranslationManager } from "../TranslationManager";
import { Translations } from "../types/Translations";
import { validateTranslations } from "../validate-translations";
import { ITranslator } from "./ITranslator";

export class GoogleTranslator implements ITranslator {
    private readonly genAI: GoogleGenerativeAI;
    private readonly model: GenerativeModel;

    constructor(private readonly manager: TranslationManager) {
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

    translate(args: { text: string; originalLocal: string; targetLocal: string; }): Promise<string> {
        throw new Error("Method not implemented.");
    }

    private async getTextFromApi(textArray: string[], args: { originalLocal: string; targetLocal: string; consistentWords: Record<string, string> | null, namespace: string }): Promise<string> {
        // - Try to use the same word for things you referenced in other translations to. E.g. 'vereniging' should be 'organization' everywhere.
        // - Be consistent and copy the caps and punctuation of the original language unless a capital letter is required in English (e.g. weekdays)
        // - Do not change inline replacement values, which are recognizable by either the # prefix or surrounding curly brackets: #groep, {name}

        const consistentWordsText = args.consistentWords ? `Use this dictionary of translations for consistency: ` + JSON.stringify(args.consistentWords) + '.' : null;

        const prompt = `Translate the values of the json array from ${args.originalLocal} to ${args.targetLocal}. Do not translate text between curly brackets. Keep the original order.${consistentWordsText} This is the array: ${JSON.stringify(textArray)}`;

        const logResult = promptLogger.logPrompt(prompt, {
            originalLocal: args.originalLocal,
            targetLocal: args.targetLocal,
            namespace: args.namespace,
            batchNumber: 1,
            totalBatches: 1
        });
          
        // const apiResult = await this.model.generateContent(prompt);
        // const text = apiResult.response.text();
        const text = JSON.stringify(textArray);

        logResult(text);
        
        return text;
    }

    private splitTranslationInBatches(translations: Translations): string[][] {
        const maxTextLength = 15000;

        const batches: string[][] = [];

        let currentLength = 0;
        let currentIndex = 0;

        for(const [id, text] of Object.entries(translations)) {
            if(currentLength > maxTextLength) {
                currentIndex = currentIndex + 1;
                currentLength = 0;
            }

            let array = batches[currentIndex];
            if(!array) {
                array = [];
                batches[currentIndex] = array;
            }

            array.push(text);
            currentLength += text.length;
        }

        return batches;
    }

    private async translateBatch(batch: string[], args: { originalLocal: string; targetLocal: string; consistentWords: Record<string, string> | null; namespace: string, batchNumber: number, totalBatches: number }): Promise<string[]> {
        // const text = JSON.stringify(batch);
        const text = await this.getTextFromApi(batch, args);
        const json = this.textToJson(text);

        if(json.length !== batch.length) {
            throw new Error("Json length does not match batch length.");
        }

        return json;
    }

    private async translateBatches(batches: string[][], {originalLocal, targetLocal, translations, consistentWords, namespace}: { originalLocal: string; targetLocal: string; translations: Translations, consistentWords: Record<string, string> | null, namespace: string}): Promise<Translations> {
        const result: Translations = {};
        const translationEntries = Object.entries(translations);

        const promises: Promise<(string | null)[]>[] = batches.map(async (batch, i) => {
            const batchNumber = i + 1;
            const totalBatches = batches.length;

            try {
                console.log(chalk.gray(`Start translating batch ${batchNumber} of ${totalBatches}`));
                const result = this.translateBatch(batch, {originalLocal, targetLocal, consistentWords, namespace, batchNumber, totalBatches});
                console.log(chalk.gray(`Finished translating batch ${batchNumber} of ${totalBatches}`));
                return result;
            } catch(error) {
                console.error(chalk.gray(`Failed translating batch ${batchNumber} of ${totalBatches}: ${error.message}`));
                return batch.map(() => null);
            }
        });

        const translatedText = await Promise.all(promises);

        translatedText.flatMap(x => x).forEach((translation, i) => {
            if(translation === null) {
                return;
            }

            const [id, text] = translationEntries[i];
            const isTranslationValid = this.validateTranslation(text, translation);

            if(isTranslationValid) {
                result[id] = translation;
            }
        })

        return result;
    }

    async translateAll(translations: Translations, args: { originalLocal: string; targetLocal: string; namespace: string; }): Promise<Translations> {
        console.log(chalk.white(`Start translate ${Object.keys(translations).length} items from ${args.originalLocal} to ${args.targetLocal} for namespace ${args.namespace}`));
        const {valid, message} = validateTranslations(translations);
        if(!valid) {
            throw new Error(message);
        }
        
        const batches = this.splitTranslationInBatches(translations);

        const consistentWords = this.manager.getConsistentWords(args.targetLocal, args.namespace);

        const result = await this.translateBatches(batches, {originalLocal: args.originalLocal, targetLocal: args.targetLocal, translations, consistentWords, namespace: args.namespace});
        console.log(chalk.green(`Finished translate ${Object.keys(translations).length} items from ${args.originalLocal} to ${args.targetLocal} for namespace ${args.namespace}`));
        return result;
    }

    private validateTranslation(original: string, translation: string): boolean {
        const regex = /{((?:.|\r|\n)*?)}/g;
        const originalMatches = original.matchAll(regex);
        const translationMatches = translation.matchAll(regex);
        const originalArguments = [...originalMatches].map(match => match[1]);
        const translationArguments = [...translationMatches].map(match => match[1]);

        if(originalArguments.length !== translationArguments.length) {
            console.error(`Original arguments length (${originalArguments.length}) does not match translation arguments length (${translationArguments.length}). Original: ${original}, translation: ${translation}`);
            return false;
        }

        const orginalMap = this.createArgumentOccurrencMap(originalArguments);
        const translationMap = this.createArgumentOccurrencMap(translationArguments);

        for(const [argument, count] of orginalMap.entries()) {
            const translationCount = translationMap.get(argument);
            if(translationCount !== count) {
                console.error(`Original arguments count does not match translation arguments count. Argument: ${argument}, Original count: ${count}, Translation count: ${translationCount}, original: ${original}, translation: ${translation}`);
                return false;
            }
        }

        return true;
    }

    private createArgumentOccurrencMap(array: string[]): Map<string, number> {
        const map = new Map<string, number>();

        array.forEach(item => {
            const count = map.get(item) ?? 0;
            map.set(item, count + 1);
        })

        return map;
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

export async function testGoogleTranslator(manager: TranslationManager) {
    const translator = new GoogleTranslator(manager);
    
    const translations: Translations = {
        "90d26048-d9a4-429b-a39f-d549ab059915": "Acties",
        "ac3b2a14-e029-404c-9fe1-2aab4279a3ac": "Beheer hier alle {taart} personen die toegang hebben tot Stamhoofd, {appel} en wijzig hun toegangsrechten {taart}.",
        "d012b9c7-518c-4a09-bbaa-c830146f815a": "Er zijn nog geen facturen aangemaakt",
        "9d8a368d-1e0a-4011-b415-402f0c8071f8": "Facturen",
        "f477755c-2d6e-473c-b9b9-2ebe0af173f3": "Verwijder deze vereniging",
        "eb91fb5c-72fc-44d4-9b84-4c9f7791e27a": "Bekijk alle leden van deze vereniging via het beheerdersportaal",
        "abc": "Vandaag is {datum}."
    };

    const result = await translator.translateAll(translations, {originalLocal: "nl", targetLocal: "en", namespace: 'stamhoofd'});

    console.log(chalk.red('Did translate!'))
    console.log(result);
}
