import { TranslatorType } from "./enums/TranslatorType";
import { isValidLocale } from "./helpers/i18n-helpers";
import { isTranslatorType } from "./helpers/validate-translator-type";

export class CliArguments {
    private _fake = false;
    private _translatorType?: TranslatorType;
    private _testCompare = false;
    private _locales?: string[];

    get fake() {
        return this._fake;
    }

    get translatorType() {
        return this._translatorType;
    }

    get isTestCompare() {
        return this._testCompare;
    }

    get locales() {
        return this._locales;
    }

    constructor() {
        this.init();
    }

    private init(): void {
        const args = process.argv.slice(2);

        let isReadingTranslator = false;
        let isReadingLocales = false;

        for (const arg of args) {
            if(isReadingTranslator) {
                if(!isTranslatorType(arg)) {
                    throw new Error('Unknown translator type: ' + arg);
                }
                this._translatorType = arg as TranslatorType;
                isReadingTranslator = false;
                continue;
            }

            if(isReadingLocales) {
                const locales: string[] = [];

                arg.split(',').forEach((l) => {
                    if(isValidLocale(l)) {
                        locales.push(l)
                    } else {
                        throw new Error('Invalid locale passed as cli argument: ' + l);
                    }
                });

                this._locales = locales;
                isReadingLocales = false;
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

            if (arg === "--test-compare") {
                this._testCompare = true;
                continue;
            }

            if(arg === "--locales") {
                isReadingLocales = true;
                continue;
            }

            throw new Error("Unknown argument: " + arg);
        }
    }
}

export const cliArguments = new CliArguments();
