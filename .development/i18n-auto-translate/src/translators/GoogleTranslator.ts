import { GenerativeModel, GoogleGenerativeAI, Schema, SchemaType } from "@google/generative-ai";
import chalk from "chalk";
import { globals } from "../globals";
import { Translations } from "../types/Translations";
import { validateTranslations } from "../validate-translations";
import { ITranslator } from "./ITranslator";

export class GoogleTranslator implements ITranslator {
    private readonly genAI: GoogleGenerativeAI;
    private readonly model: GenerativeModel;

    constructor() {
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

    private async getTextFromApi(textArray: string[],args: { originalLocal: string; targetLocal: string; }): Promise<string> {
        // - Try to use the same word for things you referenced in other translations to. E.g. 'vereniging' should be 'organization' everywhere.
        // - Be consistent and copy the caps and punctuation of the original language unless a capital letter is required in English (e.g. weekdays)
        // - Do not change inline replacement values, which are recognizable by either the # prefix or surrounding curly brackets: #groep, {name}

        const prompt = `Translate the values of the following json array from ${args.originalLocal} to ${args.targetLocal}: ${JSON.stringify(textArray)}. Do not translate text between curly brackets. Keep the original order. The response should be a valid json array. Make sure that double quotes are escaped`;
          
        const apiResult = await this.model.generateContent(prompt);
        const text = apiResult.response.text();
        console.log(text);
        return text;

        // return JSON.stringify(textArray);
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

    private async translateBatch(batch: string[], args: { originalLocal: string; targetLocal: string; }): Promise<string[]> {
        const text = await this.getTextFromApi(batch, args);
        const json = this.textToJson(text);

        if(json.length !== batch.length) {
            throw new Error("Json length does not match batch length.");
        }

        return json;
    }

    private async translateBatches(batches: string[][], {originalLocal, targetLocal, translations}: { originalLocal: string; targetLocal: string; translations: Translations}): Promise<Translations> {
        const result: Translations = {};
        const translationEntries = Object.entries(translations);

        let currentIndex = 0;

        for(let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            console.log(chalk.yellow(`Translating batch ${i + 1} of ${batches.length}.`));

            let translationCount = 0;

            try {
                const translatedBatch = await this.translateBatch(batch, {originalLocal, targetLocal});

                for(let j = 0; j < translatedBatch.length; j++) {
                    const [id, text] = translationEntries[currentIndex];
                    const translation = translatedBatch[j];
                    const isTranslationValid = this.validateTranslation(text, translation);

                    if(isTranslationValid) {
                        result[id] = translation;
                    }

                    currentIndex = currentIndex + 1;
                    translationCount = translationCount + 1;
                    
                }
            } catch(error) {
                currentIndex = currentIndex + batch.length - translationCount;
                console.error(error);
            }
        }

        return result;
    }

    async translateAll(translations: Translations, args: { originalLocal: string; targetLocal: string; }): Promise<Translations> {
        const {valid, message} = validateTranslations(translations);
        if(!valid) {
            throw new Error(message);
        }
        
        const batches = this.splitTranslationInBatches(translations);

        return this.translateBatches(batches, {originalLocal: args.originalLocal, targetLocal: args.targetLocal, translations});
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
                console.error(`Original arguments count does not match translation arguments count. Argument: ${argument}, Original count: ${count}, Translation count: ${translationCount}`);
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

export async function testGoogleTranslator() {
    const translator = new GoogleTranslator();
    
    const translations: Translations = {
        "90d26048-d9a4-429b-a39f-d549ab059915": "Acties",
        "ac3b2a14-e029-404c-9fe1-2aab4279a3ac": "Beheer hier alle {taart} personen die toegang hebben tot Stamhoofd, {appel} en wijzig hun toegangsrechten {taart}.",
        "d012b9c7-518c-4a09-bbaa-c830146f815a": "Er zijn nog geen facturen aangemaakt",
        "9d8a368d-1e0a-4011-b415-402f0c8071f8": "Facturen",
        "f477755c-2d6e-473c-b9b9-2ebe0af173f3": "Verwijder deze vereniging",
        "eb91fb5c-72fc-44d4-9b84-4c9f7791e27a": "Bekijk alle leden van deze vereniging via het beheerdersportaal",
        "abc": "Vandaag is {datum}."
    };

    const result = await translator.translateAll(translations, {originalLocal: "nl", targetLocal: "en"});

    console.log(chalk.red('Did translate!'))
    console.log(result);
}
