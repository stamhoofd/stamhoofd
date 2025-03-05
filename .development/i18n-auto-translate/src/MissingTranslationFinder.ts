import { globals } from "./globals";
import { TranslationManager } from "./TranslationManager";

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
        readonly language: string,
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

    private async search({
        language,
        locale,
        namespace,
    }: {
        language: string;
        locale: string;
        namespace?: string;
    }): Promise<SearchResult> {
        const sourceTranslations = this.translationManager.readSource(
            locale,
            namespace,
        );
        const distTranslations = this.translationManager.readDist(
            locale,
            namespace,
        );
        const missingTranslations = this.getMissingTranslations(
            sourceTranslations,
            distTranslations,
        );

        const searchResult = this.getSearchResult({
            language,
            locale,
            namespace,
            missingTranslations,
        });

        return searchResult;
    }

    private async getSearchResultsForLanguage(
        language: string,
    ): Promise<SearchResult[]> {
        const results: SearchResult[] = [];

        if (language !== globals.DEFAULT_LANGUAGE) {
            results.push(await this.search({ language, locale: language }));
        }

        const locales = this.translationManager.getLocalesForLanguage(language);

        for (const locale of locales) {
            results.push(await this.search({ language, locale }));
        }

        for (const namespace of this.translationManager.namespaces) {
            if (language !== globals.DEFAULT_LANGUAGE) {
                results.push(
                    await this.search({
                        language,
                        locale: language,
                        namespace,
                    }),
                );
            }

            for (const locale of locales) {
                results.push(
                    await this.search({ language, locale, namespace }),
                );
            }
        }

        return results;
    }

    private init() {
        this.allTranslationRefs.clear();
        this.dictionary.clear();
        const allNamespaces = [
            globals.DEFAULT_NAMESPACE,
            ...this.translationManager.namespaces,
        ];

        for (const namespace of allNamespaces) {
            const toAdd = this.translationManager.readDist(
                this.translationManager.defaultLocale,
                namespace,
            );
            this.addToDictionary({
                language: globals.DEFAULT_LANGUAGE,
                namespace,
                toAdd,
            });
        }
    }

    async findAll(): Promise<MissingTranslationsOutput> {
        this.init();

        // first check default country
        const searchResults = await this.getSearchResultsForLanguage(
            globals.DEFAULT_LANGUAGE,
        );

        for (const language of this.translationManager.otherLanguages) {
            searchResults.push(
                ...(await this.getSearchResultsForLanguage(language)),
            );
        }

        return {
            allTranslationRefs: this.allTranslationRefs,
            searchResults,
        };
    }

    private addToDictionary(args: {
        language: Language;
        namespace?: Namespace;
        toAdd: Translations | TextToTranslateRef[];
    }) {
        const language = args.language;
        const toAdd = args.toAdd;
        const namespace = args.namespace ?? globals.DEFAULT_NAMESPACE;

        let languageMap = this.dictionary.get(language);
        if (!languageMap) {
            languageMap = new Map();
            this.dictionary.set(language, languageMap);
        }

        let namespaceMap = languageMap.get(namespace);
        if (!namespaceMap) {
            namespaceMap = new Map();
            languageMap.set(namespace, namespaceMap);
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
        language: Language;
        namespace?: Namespace;
        id: TranslationId;
        value: string;
    }): string | TextToTranslateRef | null {
        const languageMap = this.dictionary.get(args.language);
        if (!languageMap || languageMap.size === 0) {
            return null;
        }

        const namespace = args.namespace ?? globals.DEFAULT_NAMESPACE;

        const namespaceMap = languageMap.get(namespace);
        if (namespaceMap) {
            const existingTranslation = namespaceMap.get(args.id);
            if (existingTranslation) {
                return existingTranslation;
            }
        }

        for (const [
            currentNamespace,
            currentNamespaceMap,
        ] of languageMap.entries()) {
            if (currentNamespace === namespace) {
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

    private getSearchResult(args: {
        language: Language;
        locale: string;
        namespace?: string;
        missingTranslations: Translations;
    }): SearchResult {
        const {
            language,
            locale,
            namespace = globals.DEFAULT_NAMESPACE,
            missingTranslations,
        } = args;

        const existingTranslationsToAdd: Translations = {};
        const translationRefs: TextToTranslateRef[] = [];
        const newTranslationRefs: TextToTranslateRef[] = [];

        for (const [id, text] of Object.entries(missingTranslations)) {
            const existingTranslation = this.getExistingTranslation({
                language,
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
                language,
                namespace,
                id,
                text,
            );

            this.allTranslationRefs.add(newTranslationRef);
            newTranslationRefs.push(newTranslationRef);
            translationRefs.push(newTranslationRef);
        }

        this.addToDictionary({
            language,
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
        sourceTranslations: Translations,
        distTranslations: Translations,
    ): Translations {
        return Object.fromEntries(
            Object.entries(distTranslations).filter(
                (entry) =>
                    sourceTranslations.hasOwnProperty(entry[0]) === false,
            ),
        );
    }
}
