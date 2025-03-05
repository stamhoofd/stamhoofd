import { exec } from "child_process";
import fs from "fs";
import { globals } from "./globals";
import { getChildDirectories, getChildFiles } from "./helpers/fs-helpers";
import { isLanguage, isLocale } from "./helpers/i18n-helpers";
import { validateTranslations } from "./helpers/validate-translations";
import { Translations, TranslationsWithConfig } from "./types/Translations";

export class TranslationManager {
    // readonly defaultLocale: string;
    readonly namespaces: string[];
    readonly locales: string[];
    // readonly otherLanguages: Set<string>;
    static readonly SUFFIX_AI = "ai";

    constructor() {
        // this.defaultLocale = globals.DEFAULT_LOCALE;
        this.locales = this.getAllLocalesInProject();
        this.namespaces = this.getAllNamespacesInProject();
        // this.otherLanguages = this.getAllLanguagesInProject([
        //     globals.DEFAULT_LOCALE,
        // ]);
    }

    private getSourcePath(locale: string, namespace?: string, suffix?: string) {
        if (namespace === globals.DEFAULT_NAMESPACE) {
            namespace = undefined;
        }

        const namespacePart = namespace ? "/" + namespace : "";
        const suffixPart = suffix ? "-" + suffix : "";

        return (
            globals.I18NUUID_LOCALES_DIR +
            namespacePart +
            "/" +
            locale +
            suffixPart +
            ".json"
        );
    }

    private getDistPath(
        locale: string,
        namespace: string = globals.DEFAULT_NAMESPACE,
    ) {
        if (isLanguage(locale)) {
            locale = locale + "-" + globals.DEFAULT_COUNTRY;
        }
        return (
            globals.I18NUUID_LOCALES_DIR_DIST +
            "/" +
            namespace +
            "/" +
            locale +
            ".json"
        );
    }

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

        if(!result.includes(globals.DEFAULT_NAMESPACE)) {
            result.push(globals.DEFAULT_NAMESPACE);
        }

        return result;
    }

    // private getAllLanguagesInProject(exclude?: string[]): Set<string> {
    //     const localesDir = globals.I18NUUID_LOCALES_DIR;

    //     const jsonFiles = getChildFiles(localesDir).filter((file) =>
    //         file.endsWith(".json"),
    //     );
    //     const jsonFileNames = jsonFiles.map((file) =>
    //         file.substring(0, file.length - 5),
    //     );
    //     const result = new Set(
    //         jsonFileNames.filter((name) => isLanguage(name)),
    //     );
    //     if (exclude) {
    //         exclude.forEach((item) => result.delete(item));
    //     }
    //     return result;
    // }

    // getLocalesForLanguage(language: string) {
    //     return this.locales.filter((locale) => locale.startsWith(language));
    // }

    readSource(
        locale: string,
        namespace?: string,
        suffix?: string,
        allowedObjects?: string[] | null,
    ): TranslationsWithConfig {
        return (
            this.readTranslationsAllowNull(
                this.getSourcePath(locale, namespace, suffix),
                allowedObjects,
            ) ?? {}
        );
    }

    readAi(
        locale: string,
        namespace?: string,
        allowedObjects?: string[] | null,
    ): TranslationsWithConfig {
        return this.readSource(locale, namespace, TranslationManager.SUFFIX_AI, allowedObjects);
    }

    readDist(
        locale: string,
        namespace: string = globals.DEFAULT_NAMESPACE,
        allowedObjects?: string[] | null,
    ): Translations {
        return (
            this.readTranslationsAllowNull(
                this.getDistPath(locale, namespace),
                allowedObjects,
            ) ?? {}
        );
    }

    addMachineTranslations(
        translations: Translations,
        args: { locale: string; namespace?: string },
    ) {
        this.addTranslations(translations, {
            ...args,
            suffix: TranslationManager.SUFFIX_AI,
            allowedObjects: ["consistent-words"],
        });
    }

    // will merge translations with existing file
    addTranslations(
        translations: Translations,
        args: {
            locale: string;
            namespace?: string;
            suffix?: string;
            allowedObjects?: string[] | null;
        },
    ) {
        const existingTranslations = this.readSource(
            args.locale,
            args.namespace,
            args.suffix,
            args.allowedObjects,
        );
        const mergedTranslations = { ...existingTranslations, ...translations };
        this.setTranslations(mergedTranslations, args);
    }

    // will overwrite all translations in file
    setTranslations(
        translations: Translations,
        args: {
            locale: string;
            namespace?: string;
            suffix?: string;
            allowedObjects?: string[] | null;
        },
    ) {
        const isValid = validateTranslations(translations, args.allowedObjects);
        if (isValid.valid === false) {
            throw new Error(`Failed to write translations: ${isValid.message}`);
        }

        const filePath = this.getSourcePath(
            args.locale,
            args.namespace,
            args.suffix,
        );
        fs.writeFileSync(filePath, JSON.stringify(translations, null, 2));
    }

    async buildTranslations() {
        console.log("Building translations...");
        const root = globals.I18NUUID_LOCALES_ROOT;
        const command = `cd ${root} && yarn build`;

        await new Promise((resolve) => {
            console.log("Finished building translations.");
            exec(command, resolve);
        });
    }

    // Currently the locale will always be a language!
    getConsistentWords(
        language: string,
        namespace?: string,
    ): Record<string, string> | null {
        // todo!!!!!!

        // if (isLocale(language)) {
        //     throw new Error(
        //         "A locale containing a country is currently not supported: " +
        //             language,
        //     );
        // }

        // first get default consistent words for locale
        const result =
            this.getConsistentWordsHelper(
                language,
                globals.DEFAULT_NAMESPACE,
            ) ?? {};

        if (
            namespace === undefined ||
            namespace !== globals.DEFAULT_NAMESPACE
        ) {
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

    private getConsistentWordsHelper(locale: string, namespace?: string) {
        const key = "consistent-words";

        const source = this.readSource(
            locale,
            namespace,
            TranslationManager.SUFFIX_AI,
            [key],
        );
        return source[key] ?? null;
    }

    private readTranslationsAllowNull(
        filePath: string,
        allowedObjects: string[] | null = [],
    ): Translations | null {
        if (!fs.existsSync(filePath)) {
            return null;
        }

        const parsedTranslations = JSON.parse(
            fs.readFileSync(filePath, "utf8"),
        );

        if (allowedObjects !== null) {
            for (const [key, value] of Object.entries(parsedTranslations)) {
                if (typeof value === "object") {
                    if (allowedObjects.includes(key)) {
                        continue;
                    }
                    delete parsedTranslations[key];
                }
            }
        }

        const validationResult = validateTranslations(
            parsedTranslations,
            allowedObjects,
        );

        if (validationResult.valid === false) {
            throw new Error(
                `Failed to read translations: ${validationResult.message}`,
            );
        }

        return parsedTranslations;
    }
}
