import { exec } from "child_process";
import fs from "fs";
import { cliArguments } from "./CliArguments";
import { TranslatorType } from "./enums/TranslatorType";
import { globals } from "./globals";
import { getChildDirectories, getChildFiles } from "./helpers/fs-helpers";
import { isLanguage, isLocale } from "./helpers/i18n-helpers";
import { validateTranslations } from "./helpers/validate-translations";
import { MachineTranslationComparison } from "./MachineTranslationComparer";
import { Translations, TranslationsWithConfig } from "./types/Translations";

export class TranslationManager {
    readonly namespaces: string[];
    readonly locales: string[];
    static readonly SUFFIX_AI = "ai";

    constructor() {
        this.locales = this.getAllLocalesInProject();
        this.namespaces = this.getAllNamespacesInProject();
    }

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
        return this.readSource(
            locale,
            namespace,
            TranslationManager.SUFFIX_AI,
            allowedObjects,
        );
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

    readCompare(
        translator: TranslatorType,
        locale: string,
        namespace?: string,
    ): TranslationsWithConfig {
        return (
            this.readTranslationsAllowNull(
                this.getComparePath(translator, locale, namespace),
            ) ?? {}
        );
    }

    addMachineTranslations(
        translations: Translations,
        args: { translator: TranslatorType, locale: string; namespace: string },
    ) {
        if(cliArguments.isTestCompare) {
            const existing = this.readCompare(args.translator, args.locale, args.namespace);
            const mergedTranslations = { ...existing, ...translations };

            const isValid = validateTranslations(mergedTranslations);
            if (isValid.valid === false) {
                throw new Error(`Failed to write translations: ${isValid.message}`);
            }
    
            const filePath = this.getComparePath(
                args.translator,
                args.locale,
                args.namespace,
            );
            fs.writeFileSync(filePath, JSON.stringify(mergedTranslations, null, 2));

        } else {
            this.addTranslations(translations, {
                ...args,
                suffix: TranslationManager.SUFFIX_AI,
                allowedObjects: ["consistent-words"],
            });
        }
    }

    setComparison(comparison: MachineTranslationComparison, {locale, namespace}: {locale: string, namespace: string}) {
        const dir = this.getCompareDir();
        const path = `${dir}/comparison-${namespace}-${locale}.json`;
        fs.writeFileSync(path, JSON.stringify(comparison, null, 2));
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

    getConsistentWords(
        locale: string,
        namespace?: string,
    ): Record<string, string> | null {
        // for now the consistent-words are saved in the source ai file of the language
        const language = locale.split("-")[0];

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

    // will merge translations with existing file
    private addTranslations(
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
    private setTranslations(
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

    private getCompareDir() {
        if(globals.COMPARE_OUTPUT_DIR.length === 0) {
            throw new Error('No COMPARE_OUTPUT_DIR set');
        }

        return globals.COMPARE_OUTPUT_DIR;
    }

    private getComparePath(translator: TranslatorType, locale: string, namespace?: string) {
        return `${this.getCompareDir()}/${translator}-${namespace ?? globals.DEFAULT_NAMESPACE}-${locale}.json`;
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

        if (!result.includes(globals.DEFAULT_NAMESPACE)) {
            result.push(globals.DEFAULT_NAMESPACE);
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
