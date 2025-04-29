import { exec } from "child_process";
import fs from "fs";
import { TranslatorType } from "../enums/TranslatorType";
import { getChildDirectories, getChildFiles } from "../helpers/fs-helpers";
import { isLanguage, isLocale } from "../helpers/i18n-helpers";
import {
    validateConsistentWords,
    validateTranslationDictionary,
    validateTranslations,
} from "../helpers/validate-translations";
import { globals } from "../shared/globals";
import { ConsistentWords } from "../types/ConsistentWords";
import { TranslationDictionary } from "../types/TranslationDictionary";
import { Translations } from "../types/Translations";
import { MachineTranslationComparison } from "./MachineTranslationComparer";

export class TranslationManager {
    readonly namespaces: string[];
    readonly locales: string[];

    constructor() {
        this.locales = this.getAllLocalesInProject();
        this.namespaces = this.getAllNamespacesInProject();
    }

    async buildDist() {
        await new Promise(resolve => {
            exec(`cd ${globals.I18NUUID_LOCALES_ROOT} && yarn -s build`, resolve);
        });
    }

    iterateNonDefaultLocalesWithNamespace(callbackfn: (locale: string, namespace: string) => void, locales?: string[]) {
        const otherLocales = this.locales.filter(
            (locale) => {
                if (locale === globals.DEFAULT_LOCALE || this.getMappedLocale(locale) ===
                globals.DEFAULT_LOCALE) {
                    return false;
                }

                if (locales) {
                    return locales.includes(locale);
                }

                return true;
            },
        );

        for(const namespace of this.namespaces) {
            for (const locale of otherLocales) {
                callbackfn(locale, namespace);
            }
        }
    }

    async iterateNonDefaultLocalesWithNamespaceAsync(callbackfn: (locale: string, namespace: string) => Promise<void>, locales?: string[]) {
        const otherLocales = this.locales.filter(
            (locale) => {
                if (locale === globals.DEFAULT_LOCALE || this.getMappedLocale(locale) ===
                globals.DEFAULT_LOCALE) {
                    return false;
                }

                if (locales) {
                    return locales.includes(locale);
                }

                return true;
            },
        );

        for(const namespace of this.namespaces) {
            for (const locale of otherLocales) {
                await callbackfn(locale, namespace);
            }
        }
    }

    getMappedLocale(locale: string): string {
        const parts = locale.split("-");
        const language = parts[0];
        const country = parts[1];

        const dict = globals.DEFAULT_LOCALES[language];

        if (!dict) {
            return language;
        }

        if (dict.countries) {
            for (const [defaultCountry, countryList] of Object.entries(
                dict.countries,
            )) {
                if (countryList.includes(country)) {
                    return language + "-" + defaultCountry;
                }
            }
        }

        return language + "-" + dict.default;
    }

    readSource(locale: string, namespace: string): Translations {
        return (
            this.readTranslationsAllowNull(
                this.getSourcePath(locale, namespace),
            ) ?? {}
        );
    }

    readSourceBaseReplacements(namespace: string): Record<string, string> {
        return (
            this.readReplacementsAllowNull(
                this.getSourcePath('base', namespace),
            ) ?? {}
        );
    }

    readSourceReplacements(locale: string, namespace: string): Record<string, string> {
        return (
            this.readReplacementsAllowNull(
                this.getSourcePath(locale, namespace),
            ) ?? {}
        );
    }

    setSourceTranslation({key, value, locale, namespace}: {key: string, value: string, locale: string, namespace: string}) {
        const path = this.getSourcePath(locale, namespace);
        const source = this.readCompleteSource(path) ?? {};
        source[key] = value;

        fs.writeFileSync(path, JSON.stringify(source, null, 2));
    }

    readMachineTranslationDictionary(
        translatorType: TranslatorType,
        locale: string,
        namespace: string,
    ): TranslationDictionary {
        const filePath = this.getMachinePath(translatorType, locale, namespace);
        return this.readTranslationDictionaryAllowNull(filePath) ?? {};
    }

    static convertMachineTranslationDictionaryToTranslations(
        dictionary: TranslationDictionary,
    ): Translations {
        return Object.fromEntries(
            Object.entries(dictionary).map(([key, value]) => {
                return [key, value.translation];
            }),
        );
    }

    readMachineTranslations(
        translatorType: TranslatorType,
        locale: string,
        namespace: string,
    ): Translations {
        return TranslationManager.convertMachineTranslationDictionaryToTranslations(
            this.readMachineTranslationDictionary(
                translatorType,
                locale,
                namespace,
            ),
        );
    }

    readDist(locale: string, namespace: string): Translations {
        const path = this.getDistPath(locale, namespace);
        return this.readTranslationsAllowNull(path) ?? {};
    }

    removeFromMachineTranslationDictionary(args: { translator: TranslatorType; locale: string; namespace: string, key: string }) {
        const existingDictionary = this.readMachineTranslationDictionary(
            args.translator,
            args.locale,
            args.namespace,
        );

        delete existingDictionary[args.key];
        this.setMachineTranslationDictionary(existingDictionary, args);
    }

    addMachineTranslationDictionary(
        dictionary: TranslationDictionary,
        args: { translator: TranslatorType; locale: string; namespace: string },
    ) {
        const existingDictionary = this.readMachineTranslationDictionary(
            args.translator,
            args.locale,
            args.namespace,
        );

        const mergedDictionary = { ...existingDictionary, ...dictionary };

        this.setMachineTranslationDictionary(mergedDictionary, args);
    }

    setMachineTranslationDictionary(
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

        fs.writeFileSync(filePath, JSON.stringify(dictionary, null, 2));
    }

    setComparison(comparison: MachineTranslationComparison, {locale, namespace}: {locale: string, namespace: string}) {
        if(globals.COMPARE_OUTPUT_DIR.length === 0) {
            throw new Error('No COMPARE_OUTPUT_DIR set');
        }
        const dir = globals.COMPARE_OUTPUT_DIR;
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

    private getSourceDir(namespace: string): string {
        const namespacePart =
            namespace === globals.DEFAULT_NAMESPACE ? "" : "/" + namespace;

        return globals.I18NUUID_LOCALES_DIR + namespacePart;
    }

    private getSourcePath(locale: string, namespace: string): string {
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

    private readCompleteSource(filePath: string): (Translations & any) | null {
        if (!fs.existsSync(filePath)) {
            return null;
        }

        return JSON.parse(
            fs.readFileSync(filePath, "utf8"),
        );
    }

    private readReplacementsAllowNull(filePath: string): Record<string, string> | null {
        const parsedTranslations = this.readCompleteSource(filePath);
        if(parsedTranslations === null) {
            return null;
        }

        const replacements = parsedTranslations.replacements ?? {};

        for (const [key, value] of Object.entries(replacements)) {
            if (typeof value !== "string") {
                delete replacements[key];
            }
        }

        return replacements;
    }

    private readTranslationsAllowNull(filePath: string): Translations | null {
        const parsedTranslations = this.readCompleteSource(filePath);
        if(parsedTranslations === null) {
            return null;
        }

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
