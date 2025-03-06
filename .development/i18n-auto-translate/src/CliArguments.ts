import { TranslatorType } from "./enums/TranslatorType";
import { isTranslatorType } from "./helpers/validate-translator-type";

export class CliArguments {
    private _fake = false;
    private _translatorType?: TranslatorType;

    get fake() {
        return this._fake;
    }

    get translatorType() {
        return this._translatorType;
    }

    constructor() {
        this.init();
    }

    private init(): void {
        const args = process.argv.slice(2);

        let isReadingTranslator = false;

        for (const arg of args) {
            if(isReadingTranslator) {
                if(!isTranslatorType(arg)) {
                    throw new Error('Unknown translator type: ' + arg);
                }
                this._translatorType = arg as TranslatorType;
                isReadingTranslator = false;
                continue;
            }

            if (arg === "--fake") {
                this._fake = true;
                continue;
            }

            if (arg === "--translator") {
                isReadingTranslator = true;
                continue;
            }

            throw new Error("Unknown argument: " + arg);
        }
    }
}

export const cliArguments = new CliArguments();
