import { exec } from "child_process";
import fs from "fs";
import { TranslatorType } from "./enums/TranslatorType";
import { globals } from "./globals";
import { getChildDirectories, getChildFiles } from "./helpers/fs-helpers";
import { isLanguage, isLocale } from "./helpers/i18n-helpers";
import {
    validateConsistentWords,
    validateTranslationDictionary,
    validateTranslations,
} from "./helpers/validate-translations";
import { ConsistentWords } from "./types/ConsistentWords";
import { TranslationDictionary } from "./types/TranslationDictionary";
import { Translations } from "./types/Translations";

export class TranslationManager {
    readonly namespaces: string[];
    readonly locales: string[];

    constructor() {
        this.locales = this.getAllLocalesInProject();
        this.namespaces = this.getAllNamespacesInProject();
    }

    readSource(locale: string, namespace?: string): Translations {
        return (
            this.readTranslationsAllowNull(
                this.getSourcePath(locale, namespace),
            ) ?? {}
        );
    }

    readMachineTranslationDictionary(
        translatorType: TranslatorType,
        locale: string,
        namespace: string,
    ): TranslationDictionary {
        const filePath = this.getMachinePath(translatorType, locale, namespace);
        return this.readTranslationDictionaryAllowNull(filePath) ?? {};
    }

    readMachineTranslations(
        translatorType: TranslatorType,
        locale: string,
        namespace: string,
    ): Translations {
        return Object.fromEntries(
            Object.entries(
                this.readMachineTranslationDictionary(
                    translatorType,
                    locale,
                    namespace,
                ),
            ).map(([key, value]) => {
                return [key, value.translation];
            }),
        );
    }

    readDist(
        locale: string,
        namespace: string = globals.DEFAULT_NAMESPACE,
    ): Translations {
        return (
            this.readTranslationsAllowNull(
                this.getDistPath(locale, namespace),
            ) ?? {}
        );
    }

    // readCompare(
    //     translator: TranslatorType,
    //     locale: string,
    //     namespace?: string,
    // ): TranslationsWithConfig {
    //     return (
    //         this.readTranslationsAllowNull(
    //             this.getComparePath(translator, locale, namespace),
    //         ) ?? {}
    //     );
    // }

    addMachineTranslationDictionary(
        dictionary: TranslationDictionary,
        args: { translator: TranslatorType; locale: string; namespace: string },
    ) {
        const isValid = validateTranslationDictionary(dictionary);
        if (isValid.valid === false) {
            throw new Error(
                `Failed to add translation dictionary: ${isValid.message}`,
            );
        }

        const filePath = this.getMachinePath(
            args.translator,
            args.locale,
            args.namespace,
        );

        const existingDictionary = this.readMachineTranslationDictionary(
            args.translator,
            args.locale,
            args.namespace,
        );

        const mergedDictionary = { ...existingDictionary, ...dictionary };

        fs.writeFileSync(filePath, JSON.stringify(mergedDictionary, null, 2));
    }

    // setComparison(comparison: MachineTranslationComparison, {locale, namespace}: {locale: string, namespace: string}) {
    //     const dir = this.getCompareDir();
    //     const path = `${dir}/comparison-${namespace}-${locale}.json`;
    //     fs.writeFileSync(path, JSON.stringify(comparison, null, 2));
    // }

    async buildTranslations() {
        console.log("Building translations...");
        const root = globals.I18NUUID_LOCALES_ROOT;
        const command = `cd ${root} && yarn build`;

        await new Promise((resolve) => {
            console.log("Finished building translations.");
            exec(command, resolve);
        });
    }

    getConsistentWords(
        locale: string,
        namespace: string,
    ): ConsistentWords | null {
        // for now the consistent-words are saved in the source ai file of the language
        const language = locale.split("-")[0];

        // first get default consistent words for locale
        const result =
            this.getConsistentWordsHelper(
                language,
                globals.DEFAULT_NAMESPACE,
            ) ?? {};

        if (namespace !== globals.DEFAULT_NAMESPACE) {
            const namespaceConsistentWords = this.getConsistentWordsHelper(
                language,
                namespace,
            );
            if (namespaceConsistentWords) {
                Object.entries(namespaceConsistentWords).forEach(
                    ([key, value]) => (result[key] = value),
                );
            }
        }

        return result;
    }

    // will merge translations with existing file
    // private addTranslations(
    //     translations: Translations,
    //     args: {
    //         locale: string;
    //         namespace?: string;
    //         allowedObjects?: string[] | null;
    //     },
    // ) {
    //     const existingTranslations = this.readSource(
    //         args.locale,
    //         args.namespace,
    //         args.allowedObjects,
    //     );
    //     const mergedTranslations = { ...existingTranslations, ...translations };
    //     this.setTranslations(mergedTranslations, args);
    // }

    // will overwrite all translations in file
    // private setTranslations(
    //     translations: Translations,
    //     args: {
    //         locale: string;
    //         namespace?: string;
    //         allowedObjects?: string[] | null;
    //     },
    // ) {
    //     const isValid = validateTranslations(translations, args.allowedObjects);
    //     if (isValid.valid === false) {
    //         throw new Error(`Failed to write translations: ${isValid.message}`);
    //     }

    //     const filePath = this.getSourcePath(
    //         args.locale,
    //         args.namespace,
    //     );
    //     fs.writeFileSync(filePath, JSON.stringify(translations, null, 2));
    // }

    private getSourceDir(namespace?: string): string {
        if (namespace === globals.DEFAULT_NAMESPACE) {
            namespace = undefined;
        }

        const namespacePart = namespace ? "/" + namespace : "";

        return globals.I18NUUID_LOCALES_DIR + namespacePart;
    }

    private getSourcePath(locale: string, namespace?: string): string {
        return `${this.getSourceDir(namespace)}/${locale}.json`;
    }

    private getDistPath(
        locale: string,
        namespace: string = globals.DEFAULT_NAMESPACE,
    ) {
        if (isLanguage(locale)) {
            locale = locale + "-" + globals.DEFAULT_COUNTRY;
        }

        return `${globals.I18NUUID_LOCALES_DIR_DIST}/${namespace}/${locale}.json`;
    }

    private getMachinePath(
        translatorType: TranslatorType,
        locale: string,
        namespace: string,
    ): string {
        return `${this.getSourceDir(namespace)}/machine-${translatorType}-${locale}.json`;
    }

    // private getCompareDir() {
    //     if(globals.COMPARE_OUTPUT_DIR.length === 0) {
    //         throw new Error('No COMPARE_OUTPUT_DIR set');
    //     }

    //     return globals.COMPARE_OUTPUT_DIR;
    // }

    // private getComparePath(translator: TranslatorType, locale: string, namespace?: string) {
    //     return `${this.getCompareDir()}/${translator}-${namespace ?? globals.DEFAULT_NAMESPACE}-${locale}.json`;
    // }

    private getAllLocalesInProject(): string[] {
        const localesDir = globals.I18NUUID_LOCALES_DIR;

        const jsonFiles = getChildFiles(localesDir).filter((file) =>
            file.endsWith(".json"),
        );
        const jsonFileNames = jsonFiles.map((file) =>
            file.substring(0, file.length - 5),
        );
        return jsonFileNames.filter((name) => isLocale(name));
    }

    private getAllNamespacesInProject(): string[] {
        const localesDir = globals.I18NUUID_LOCALES_DIR;
        const exclude = ["platforms"];
        const result = getChildDirectories(localesDir).filter(
            (name) => !exclude.includes(name),
        );

        if (!result.includes(globals.DEFAULT_NAMESPACE)) {
            result.push(globals.DEFAULT_NAMESPACE);
        }

        return result;
    }

    private getConsistentWordsHelper(
        locale: string,
        namespace: string,
    ): ConsistentWords | null {
        const filePath = `${this.getSourceDir(namespace)}/consistent-words-${locale}.json`;

        if (!fs.existsSync(filePath)) {
            return null;
        }

        const parsedConsistentWords = JSON.parse(
            fs.readFileSync(filePath, "utf8"),
        );

        const validationResult = validateConsistentWords(parsedConsistentWords);

        if (validationResult.valid === false) {
            throw new Error(
                `Failed to read consistent words (locale: ${locale}, namespace: ${namespace}): ${validationResult.message}`,
            );
        }

        if (Object.keys(parsedConsistentWords).length === 0) {
            return null;
        }

        return parsedConsistentWords;
    }

    private readTranslationDictionaryAllowNull(
        filePath: string,
    ): TranslationDictionary | null {
        if (!fs.existsSync(filePath)) {
            return null;
        }

        const parsedDictionary = JSON.parse(fs.readFileSync(filePath, "utf8"));

        const validationResult =
            validateTranslationDictionary(parsedDictionary);

        if (validationResult.valid === false) {
            throw new Error(
                `Failed to read translation dictionary: ${validationResult.message}`,
            );
        }

        return parsedDictionary;
    }

    private readTranslationsAllowNull(filePath: string): Translations | null {
        if (!fs.existsSync(filePath)) {
            return null;
        }

        const parsedTranslations = JSON.parse(
            fs.readFileSync(filePath, "utf8"),
        );
        for (const [key, value] of Object.entries(parsedTranslations)) {
            if (typeof value === "object") {
                delete parsedTranslations[key];
            }
        }

        const validationResult = validateTranslations(parsedTranslations);

        if (validationResult.valid === false) {
            throw new Error(
                `Failed to read translations: ${validationResult.message}`,
            );
        }

        return parsedTranslations;
    }
}
