import { globals } from "./globals";
import { TranslationManager } from "./TranslationManager";
import { TranslationsWithConfig } from "./types/Translations";

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

interface MissingTranslationsOutput {
    allTranslationRefs: Set<TextToTranslateRef>;
    searchResults: SearchResult[];
}

export class TextToTranslateRef {
    private _didTry = false;
    private _translation: string | null = null;

    get isTranslated(): boolean {
        return this._translation !== null;
    }

    get didTry(): boolean {
        return this._didTry;
    }

    get translation(): string {
        const translation = this._translation;
        if (translation === null) {
            throw new Error("Not translated.");
        }
        return translation;
    }

    constructor(
        readonly locale: string,
        readonly namespace: string,
        readonly id: string,
        readonly text: string,
    ) {}

    markDidTry() {
        this._didTry = true;
    }

    setTranslation(value: string) {
        this._translation = value;
    }
}

export class MissingTranslationFinder {
    private readonly dictionary: Map<
        Language,
        Map<Namespace, Map<TranslationId, string | TextToTranslateRef>>
    > = new Map();
    private readonly allTranslationRefs: Set<TextToTranslateRef> = new Set();
    private readonly translationManager: TranslationManager;

    constructor(options: { translationManager?: TranslationManager } = {}) {
        this.translationManager =
            options.translationManager ?? new TranslationManager();
    }

    async findAll(): Promise<MissingTranslationsOutput> {
        this.init();

        const searchResults: SearchResult[] = [];

        const otherLocales = this.translationManager.locales.filter(
            (locale) => locale !== globals.DEFAULT_LOCALE,
        );

        const namespaces = this.translationManager.namespaces.sort((a, b) => {
            if (a === b) {
                return 0;
            }

            // default namespace should come first
            if (a === globals.DEFAULT_NAMESPACE) {
                return -1;
            }

            if (b === globals.DEFAULT_NAMESPACE) {
                return 1;
            }

            return 0;
        });

        for (const namespace of namespaces) {
            for (const locale of otherLocales) {
                if (this.getMappedLocale(locale) === globals.DEFAULT_LOCALE) {
                    continue;
                }

                searchResults.push(
                    await this.search({
                        locale,
                        namespace,
                    }),
                );
            }
        }

        return {
            allTranslationRefs: this.allTranslationRefs,
            searchResults,
        };
    }

    private async search({
        locale,
        namespace,
    }: {
        locale: string;
        namespace?: string;
    }): Promise<SearchResult> {
        const sourceTranslations = this.translationManager.readSource(
            locale,
            namespace,
        );
        const aiTranslations = this.translationManager.readAi(
            locale,
            namespace,
        );

        const baseTranslations = Object.fromEntries(
            Object.entries(aiTranslations).concat(
                Object.entries(sourceTranslations),
            ),
        ) as TranslationsWithConfig;

        const distTranslations = this.translationManager.readDist(
            locale,
            namespace,
        );
        const missingTranslations = this.getMissingTranslations(
            baseTranslations,
            distTranslations,
        );

        const searchResult = this.getSearchResult({
            locale,
            namespace,
            missingTranslations,
        });

        return searchResult;
    }

    private init() {
        this.allTranslationRefs.clear();
        this.dictionary.clear();

        for (const namespace of this.translationManager.namespaces) {
            const toAdd = this.translationManager.readDist(
                globals.DEFAULT_LOCALE,
                namespace,
            );
            this.addToDictionary({
                locale: globals.DEFAULT_LOCALE,
                namespace,
                toAdd,
            });
        }
    }

    private addToDictionary(args: {
        locale: string;
        namespace?: Namespace;
        toAdd: Translations | TextToTranslateRef[];
    }) {
        const locale = args.locale;
        const toAdd = args.toAdd;
        const namespace = args.namespace ?? globals.DEFAULT_NAMESPACE;

        let localeMap = this.dictionary.get(locale);
        if (!localeMap) {
            localeMap = new Map();
            this.dictionary.set(locale, localeMap);
        }

        let namespaceMap = localeMap.get(namespace);
        if (!namespaceMap) {
            namespaceMap = new Map();
            localeMap.set(namespace, namespaceMap);
        }

        if (Array.isArray(toAdd)) {
            for (const textRef of toAdd) {
                namespaceMap.set(textRef.id, textRef);
            }
        } else {
            for (const [id, text] of Object.entries(toAdd)) {
                namespaceMap.set(id, text);
            }
        }
    }

    private getExistingTranslation(args: {
        locale: string;
        namespace: Namespace;
        id: TranslationId;
        value: string;
    }): string | TextToTranslateRef | null {
        const localeMap = this.dictionary.get(args.locale);
        if (!localeMap || localeMap.size === 0) {
            return null;
        }

        const namespaceMap = localeMap.get(args.namespace);
        if (namespaceMap) {
            const existingTranslation = namespaceMap.get(args.id);
            if (existingTranslation) {
                return existingTranslation;
            }
        }

        for (const [
            currentNamespace,
            currentNamespaceMap,
        ] of localeMap.entries()) {
            if (currentNamespace === args.namespace) {
                continue;
            }

            const existingTranslation = currentNamespaceMap.get(args.id);

            if (existingTranslation) {
                if (existingTranslation instanceof TextToTranslateRef) {
                    if (existingTranslation.text === args.value) {
                        return existingTranslation;
                    }
                    continue;
                }

                if (existingTranslation === args.value) {
                    return existingTranslation;
                }
            }
        }

        return null;
    }

    private getMappedLocale(locale: string): string {
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

    private getSearchResult(args: {
        locale: string;
        namespace?: string;
        missingTranslations: Translations;
    }): SearchResult {
        const {
            locale,
            namespace = globals.DEFAULT_NAMESPACE,
            missingTranslations,
        } = args;

        const mappedLocale = this.getMappedLocale(locale);

        const existingTranslationsToAdd: Translations = {};
        const translationRefs: TextToTranslateRef[] = [];
        const newTranslationRefs: TextToTranslateRef[] = [];

        for (const [id, text] of Object.entries(missingTranslations)) {
            const existingTranslation = this.getExistingTranslation({
                locale: mappedLocale,
                namespace,
                id,
                value: text,
            });
            if (existingTranslation) {
                if (existingTranslation instanceof TextToTranslateRef) {
                    translationRefs.push(existingTranslation);
                    continue;
                }

                existingTranslationsToAdd[id] = existingTranslation;
                continue;
            }

            const newTranslationRef = new TextToTranslateRef(
                mappedLocale,
                namespace,
                id,
                text,
            );

            this.allTranslationRefs.add(newTranslationRef);
            newTranslationRefs.push(newTranslationRef);
            translationRefs.push(newTranslationRef);
        }

        this.addToDictionary({
            locale: mappedLocale,
            namespace,
            toAdd: newTranslationRefs,
        });

        return {
            locale,
            namespace,
            existingTranslationsToAdd,
            translationRefs,
        };
    }

    private getMissingTranslations(
        baseTranslations: Translations,
        distTranslations: Translations,
    ): Translations {
        return Object.fromEntries(
            Object.entries(distTranslations).filter(
                (entry) => baseTranslations.hasOwnProperty(entry[0]) === false,
            ),
        );
    }
}
