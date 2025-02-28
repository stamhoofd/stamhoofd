import { ITranslator } from "./types/ITranslator";


export class Translator implements ITranslator {
    constructor() {

    }

    async translate(text: string): Promise<string> {
        return `TRANSLATED TEST > ${text}`;
    }
}
