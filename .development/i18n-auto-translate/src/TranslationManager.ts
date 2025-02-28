import fs from "fs";
import { getChildDirectories, getChildFiles } from "./fs-helper";
import { globals } from "./globals";
import { isLanguage, isLocale } from "./i18n-helper";
import { readTranslationsAllowNull } from "./read-translations";
import { Translations } from "./types/Translations";
import { validateTranslations } from "./validate-translations";

export class TranslationManager {
     readonly defaultLocale: string;
     readonly namespaces: string[];
     readonly locales: string[];
     readonly otherLanguages: Set<string>;

    constructor() {
        this.defaultLocale = `${globals.DEFAULT_LANGUAGE}-${globals.DEFAULT_COUNTRY}`;
        this.locales = this.getAllLocalesInProject();
        this.namespaces = this.getAllNamespacesInProject();
        this.otherLanguages = this.getAllLanguagesInProject([globals.DEFAULT_LANGUAGE]);
    }

    private getSourcePath(locale: string, namespace?: string) {
        if(namespace === globals.DEFAULT_NAMESPACE) {
            namespace = undefined;
        }
        
        return namespace ? globals.I18NUUID_LOCALES_DIR + '/' + namespace + '/' + locale + '.json' : globals.I18NUUID_LOCALES_DIR + '/' + locale + '.json';
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

    readSource(locale: string, namespace?: string): Translations {
        return readTranslationsAllowNull(this.getSourcePath(locale, namespace)) ?? {};
    }

    readDist(locale: string, namespace: string = globals.DEFAULT_NAMESPACE): Translations {
        return readTranslationsAllowNull(this.getDistPath(locale, namespace)) ?? {};
    }

    // will merge translations with existing file
    addTranslations(translations: Translations, args: {locale: string, namespace?: string}) {
        const existingTranslations = this.readSource(args.locale, args.namespace);
        const mergedTranslations = {...existingTranslations, ...translations};
        this.setTranslations(mergedTranslations, args);
    }

    // will overwrite all translations in file
    setTranslations(translations: Translations, args: {locale: string, namespace?: string}) {
        const isValid = validateTranslations(translations);
        if(isValid.valid === false) {
            throw new Error(`Failed to write translations: ${isValid.message}`);
        }

        const filePath = this.getSourcePath(args.locale, args.namespace);
        fs.writeFileSync(filePath, JSON.stringify(translations, null, 2));
    }
}
