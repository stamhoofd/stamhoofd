import { exec } from 'child_process';
import fs from "fs";
import { getChildDirectories, getChildFiles } from "./fs-helper";
import { globals } from "./globals";
import { isLanguage, isLocale } from "./i18n-helper";
import { readTranslationsAllowNull } from "./read-translations";
import { Translations, TranslationsWithConfig } from "./types/Translations";
import { validateTranslations } from "./validate-translations";

export class TranslationManager {
     readonly defaultLocale: string;
     readonly namespaces: string[];
     readonly locales: string[];
     readonly otherLanguages: Set<string>;
    static readonly SUFFIX_AI = 'ai';

    constructor() {
        this.defaultLocale = `${globals.DEFAULT_LANGUAGE}-${globals.DEFAULT_COUNTRY}`;
        this.locales = this.getAllLocalesInProject();
        this.namespaces = this.getAllNamespacesInProject();
        this.otherLanguages = this.getAllLanguagesInProject([globals.DEFAULT_LANGUAGE]);
    }

    private getSourcePath(locale: string, namespace?: string, suffix?: string) {
        if(namespace === globals.DEFAULT_NAMESPACE) {
            namespace = undefined;
        }

        const namespacePart = namespace ? '/' + namespace : '';
        const suffixPart = suffix ? '-' + suffix : '';
        
        return globals.I18NUUID_LOCALES_DIR + namespacePart + '/' + locale + suffixPart + '.json';
    }

    private getDistPath(locale: string, namespace: string = globals.DEFAULT_NAMESPACE) {
        if(isLanguage(locale)) {
            locale = locale + '-' + globals.DEFAULT_COUNTRY;
        }
        return globals.I18NUUID_LOCALES_DIR_DIST + '/' + namespace + '/' + locale + '.json';
    }

    private getAllLocalesInProject(): string[] {
        const localesDir = globals.I18NUUID_LOCALES_DIR;
    
        const jsonFiles = getChildFiles(localesDir).filter(file => file.endsWith(".json"));
        const jsonFileNames = jsonFiles.map(file => file.substring(0, file.length - 5));
        return jsonFileNames.filter(name => isLocale(name));
    }

    private getAllNamespacesInProject(): string[] {
        const localesDir = globals.I18NUUID_LOCALES_DIR;
        const exclude = ['platforms'];
        return getChildDirectories(localesDir).filter(name => !exclude.includes(name));
    }

    private getAllLanguagesInProject(exclude?: string[]): Set<string> {
        const localesDir = globals.I18NUUID_LOCALES_DIR;
    
        const jsonFiles = getChildFiles(localesDir).filter(file => file.endsWith(".json"));
        const jsonFileNames = jsonFiles.map(file => file.substring(0, file.length - 5));
        const result = new Set(jsonFileNames.filter(name => isLanguage(name)));
        if(exclude) {
            exclude.forEach(item => result.delete(item));
        }
        return result;
    }

    getLocalesForLanguage(language: string) {
        return this.locales.filter(locale => locale.startsWith(language));
    }

    readSource(locale: string, namespace?: string, suffix?: string, allowedObjects?: string[] | null): TranslationsWithConfig {
        return readTranslationsAllowNull(this.getSourcePath(locale, namespace, suffix), allowedObjects) ?? {};
    }

    readDist(locale: string, namespace: string = globals.DEFAULT_NAMESPACE, allowedObjects?: string[] | null): Translations {
        return readTranslationsAllowNull(this.getDistPath(locale, namespace), allowedObjects) ?? {};
    }

    addMachineTranslations(translations: Translations, args: {locale: string, namespace?: string}) {
        this.addTranslations(translations, {...args, suffix: TranslationManager.SUFFIX_AI, allowedObjects: ['consistent-words']});
    }

    // will merge translations with existing file
    addTranslations(translations: Translations, args: {locale: string, namespace?: string, suffix?: string, allowedObjects?: string[] | null}) {
        const existingTranslations = this.readSource(args.locale, args.namespace, args.suffix, args.allowedObjects);
        const mergedTranslations = {...existingTranslations, ...translations};
        this.setTranslations(mergedTranslations, args);
    }

    // will overwrite all translations in file
    setTranslations(translations: Translations, args: {locale: string, namespace?: string, suffix?: string, allowedObjects?: string[] | null}) {
        const isValid = validateTranslations(translations, args.allowedObjects);
        if(isValid.valid === false) {
            throw new Error(`Failed to write translations: ${isValid.message}`);
        }

        const filePath = this.getSourcePath(args.locale, args.namespace, args.suffix);
        fs.writeFileSync(filePath, JSON.stringify(translations, null, 2));
    }

    async buildTranslations() {
        console.log('Building translations...');
        const root = globals.I18NUUID_LOCALES_ROOT;
        const command = `cd ${root} && yarn build`;

        await new Promise(resolve => {
            console.log('Finished building translations.');
            exec(command, resolve);
        });
    }

    getConsistentWords(locale: string, namespace?: string): Record<string, string> | null {
        const key = 'consistent-words';
        const source = this.readSource(locale, namespace, TranslationManager.SUFFIX_AI, [key]);
        return source[key] ?? null;
    }
}
