import { getChildDirectories, getChildFiles } from "./fs-helper";
import { globals } from "./globals";
import { isLanguage, isLocale } from "./i18n-helper";
import { readTranslationsAllowNull } from "./read-translations";

type Language = string;
type Namespace = string;
type TranslationId = string;

type Translations = Record<string, string>;

interface SearchResult {
    locale: string;
    namespace: string;
    existingTranslationsToAdd: Translations;
    translationRefs: TextToTranslateRef[];
}

class TextToTranslateRef {
    constructor(readonly language: string, readonly id: string,  readonly text: string) {
    }
}

export class MissingTranslationFinder {
    private readonly dictionary: Map<Language, Map<Namespace, Map<TranslationId, string | TextToTranslateRef>>> = new Map();
    private readonly defaultLanguage: Language;
    private readonly otherLanguages: Set<Language>;
    // todo: add default namespace to env?
    private readonly defaultNamespace = 'stamhoofd';
    // todo: add default country to env?
    private readonly defaultCountry = 'BE';
    private readonly namespaces: string[];
    private readonly locales: string[];
    private readonly defaultLocale: string;

    constructor(private readonly translator: (text: string) => Promise<string>) {
        this.defaultLanguage = this.getDefaultLanguage();
        this.defaultLocale = `${this.defaultLanguage}-${this.defaultCountry}`;
        this.otherLanguages = this.getAllLanguagesInProject([this.defaultLanguage]);
        this.locales = this.getAllLocalesInProject();
        this.namespaces = this.getAllNamespacesInProject();
    }

    private async search({language, locale, namespace}: {language: string, locale: string, namespace?: string}): Promise<SearchResult> {
        const sourceTranslations = this.getSourceTranslations(locale, namespace);
        // todo: maybe do on start for all?
        this.addToDictionary({language, namespace, toAdd: sourceTranslations});
        const distTranslations = this.getDistTranslations(locale, namespace);
        const missingTranslations = this.getMissingTranslations(sourceTranslations, distTranslations);
        const searchResult = this.getSearchResult({language, locale, namespace, missingTranslations});

        return searchResult;
    }

    private async translateAll(translations: Translations) {
        const translated: Translations = {};

        for(const [id, text] of Object.entries(translations)) {
            translated[id] = await this.translator(text);
        }

        return translated;
    }

    private async getSearchResultsForLanguage(language: string): Promise<SearchResult[]> {
        const results: SearchResult[] = [];

        if(language !== this.defaultLanguage) {
            results.push(await this.search({language, locale: language}));
        }

        const locales = this.getLocalesForLanguage(language);

        for(const locale of locales) {
            results.push(await this.search({language, locale}));
        }

        for(const namespace of this.namespaces) {
            if(language !== this.defaultLanguage) {
                results.push(await this.search({language, locale: language, namespace}));
            }
            
            for(const locale of locales) {
                results.push(await this.search({language, locale, namespace}));
            }
        }

        return results;
    }

    private initDictionary() {
        this.dictionary.clear();
        const allNamespaces = [this.defaultNamespace, ...this.namespaces];

        for(const namespace of allNamespaces) {
            const toAdd = this.getDistTranslations(this.defaultLocale, namespace);
            this.addToDictionary({language: this.defaultLanguage, namespace, toAdd});
        }
    }

    async findAll() {
        // todo: load existing translations in cache from default dist language for each namespace
        this.initDictionary();

        // first check default country
        const output = await this.getSearchResultsForLanguage(this.defaultLanguage);

        for(const language of this.otherLanguages) {
            output.push(...await this.getSearchResultsForLanguage(language));
        }

        return output;
    }

    private addToDictionary(args: {language: Language, namespace?: Namespace, toAdd: Translations | TextToTranslateRef[]}) {
        const language = args.language;
        const toAdd = args.toAdd;
        const namespace = args.namespace ?? this.defaultNamespace;
    
        let languageMap = this.dictionary.get(language);
        if(!languageMap) {
            languageMap = new Map();
            this.dictionary.set(language, languageMap);
        }
    
        let namespaceMap = languageMap.get(namespace);
        if(!namespaceMap) {
            namespaceMap = new Map();
            languageMap.set(namespace, namespaceMap);
        }

        if(Array.isArray(toAdd)) {
            for(const textRef of toAdd) {
                namespaceMap.set(textRef.id, textRef.text);
            }
        } else {
            for(const [id, text] of Object.entries(toAdd)) {
                namespaceMap.set(id, text);
            }
        }
    }

    private getExistingTranslation(args: {language: Language, namespace?: Namespace, id: TranslationId, value: string}): string | TextToTranslateRef | null {
        const languageMap = this.dictionary.get(args.language);
        if(!languageMap || languageMap.size === 0) {
            return null;
        }

        const namespace = args.namespace ?? this.defaultNamespace;
    
        // todo: is necessary?
        // if(namespace) {
            const namespaceMap = languageMap.get(namespace);
            if(namespaceMap) {
                const existingTranslation = namespaceMap.get(args.id);
                if(existingTranslation) {
                    return existingTranslation;
                }
            }
        // }
    
        for(const [currentNamespace, currentNamespaceMap] of languageMap.entries()) {
            if(currentNamespace === namespace) {
                continue;
            }

            const existingTranslation = currentNamespaceMap.get(args.id);

            if(existingTranslation) {
                if(existingTranslation instanceof TextToTranslateRef) {
                    if(existingTranslation.text === args.value) {
                        return existingTranslation;
                    }
                    continue;
                }

                if(existingTranslation === args.value) {
                    return existingTranslation;
                }
            }
        }
    
        return null;
    }

    private getSearchResult(args: {language: Language, locale: string, namespace?: string, missingTranslations: Translations}): SearchResult {
        const {language, locale, namespace = this.defaultNamespace, missingTranslations} = args;
    
        const existingTranslationsToAdd: Translations = {};
        const translationRefs: TextToTranslateRef[] = [];
        const newTranslationRefs: TextToTranslateRef[] = [];
    
        for(const [id, text] of Object.entries(missingTranslations)) {
            const existingTranslation = this.getExistingTranslation({language, namespace, id, value: text});
            if(existingTranslation) {
                if(existingTranslation instanceof TextToTranslateRef) {
                    translationRefs.push(existingTranslation);
                    continue;
                }

                existingTranslationsToAdd[id] = existingTranslation;
                continue;
            }

            const newTranslationRef = new TextToTranslateRef(language, id, text);
            newTranslationRefs.push(newTranslationRef);
            translationRefs.push(newTranslationRef);
        }

        this.addToDictionary({language, namespace, toAdd: newTranslationRefs});
    
        return {
            locale,
            namespace,
            existingTranslationsToAdd,
            translationRefs
        }
    }
    
    private getMissingTranslations(sourceTranslations: Translations, distTranslations: Translations): Translations {
        return Object.fromEntries(Object.entries(distTranslations).filter(entry => sourceTranslations.hasOwnProperty(entry[0]) === false));
    }
    
    private getDefaultLanguage() {
        const defaultLanguage = globals.I18NUUID_DEFAULT_LOCALE;
        if(!isLanguage(defaultLanguage)) {
            throw new Error(`Default language ${defaultLanguage} should be a language`);
        }
        return defaultLanguage;
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

    private getLocalesForLanguage(language: Language) {
        return this.locales.filter(locale => locale.startsWith(language));
    }

    private getSourceTranslations(locale: string, namespace?: string): Translations {
        // const path = globals.I18NUUID_LOCALES_DIR + '/' + locale + '.json';
        const filePath = namespace ? globals.I18NUUID_LOCALES_DIR + '/' + locale + '/' + namespace + '.json' : globals.I18NUUID_LOCALES_DIR + '/' + locale + '.json';
        return readTranslationsAllowNull(filePath) ?? {};
    }

    private getDistTranslations(locale: string, namespace: string = this.defaultNamespace): Translations {
        if(isLanguage(locale)) {
            locale = locale + '-' + this.defaultCountry;
        }
        const filePath = globals.I18NUUID_LOCALES_DIR_DIST + '/' + namespace + '/' + locale + '.json';

        console.log(filePath)
        return readTranslationsAllowNull(filePath) ?? {};
    }
}
