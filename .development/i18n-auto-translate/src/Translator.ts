import { ITranslator } from "./types/ITranslator";


export class Translator implements ITranslator {
    constructor() {

    }

    async translate(args: {text: string, originalLocal: string, targetLocal: string}): Promise<string> {
        return `TRANSLATED from ${args.originalLocal} to ${args.targetLocal} > ${args.text}`;
    }
}
