import { GenerativeModel, GoogleGenerativeAI } from "@google/generative-ai";
import chalk from "chalk";
import { globals } from "../globals";
import { Translations } from "../types/Translations";
import { ITranslator } from "./ITranslator";

export class GoogleTranslator implements ITranslator {
    private readonly genAI: GoogleGenerativeAI;
    private readonly model: GenerativeModel;

    constructor() {
        this.genAI = new GoogleGenerativeAI(globals.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    }

    translate(args: { text: string; originalLocal: string; targetLocal: string; }): Promise<string> {
        throw new Error("Method not implemented.");
    }

    async translateAll(translations: Translations, args: { originalLocal: string; targetLocal: string; }): Promise<Translations> {
        const prompt = `Translate the values of the following json object from ${args.originalLocal} to ${args.targetLocal}: ${JSON.stringify(translations)}`;

        const result = await this.model.generateContent(prompt);
        const text = result.response.text();
        console.log(text);

        return this.textToJson(text);
    }

    private textToJson(result: string) {
        const regex = /```json\n((?:.|\r|\n)*)```/;

        const match = result.match(regex);
        const jsonString = match?.[1];

        if(!jsonString) {
            throw new Error("Failed to parse json from response.");
        }

        return JSON.parse(jsonString);
    }
}

export async function testGoogleTranslator() {
    const translator = new GoogleTranslator();
    
    const translations: Translations = {
        "90d26048-d9a4-429b-a39f-d549ab059915": "Acties",
        "ac3b2a14-e029-404c-9fe1-2aab4279a3ac": "Beheer hier alle personen die toegang hebben tot Stamhoofd, en wijzig hun toegangsrechten.",
        "d012b9c7-518c-4a09-bbaa-c830146f815a": "Er zijn nog geen facturen aangemaakt",
        "9d8a368d-1e0a-4011-b415-402f0c8071f8": "Facturen",
        "f477755c-2d6e-473c-b9b9-2ebe0af173f3": "Verwijder deze vereniging",
        "eb91fb5c-72fc-44d4-9b84-4c9f7791e27a": "Bekijk alle leden van deze vereniging via het beheerdersportaal",
    };

    const result = await translator.translateAll(translations, {originalLocal: "nl", targetLocal: "en"});

    console.log(chalk.red('Did translate!'))
    console.log(result);
}
