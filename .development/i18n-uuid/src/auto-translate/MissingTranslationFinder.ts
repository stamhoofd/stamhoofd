import chalk from "chalk";
import { TranslatorType } from "../enums/TranslatorType";
import { globals } from "../shared/globals";
import { TranslationDictionary } from "../types/TranslationDictionary";
import { TextToTranslateRef } from "./TextToTranslateRef";
import { TranslationManager } from "./TranslationManager";

type Language = string;
type Namespace = string;
type TranslationId = string;

type Translations = Record<string, string>;

interface SearchResult {
    locale: string;
    namespace: string;
    existingTranslationsToAdd: TranslationDictionary;
    translationRefs: TextToTranslateRef[];
}

interface MissingTranslationsOutput {
    allTranslationRefs: Set<TextToTranslateRef>;
    searchResults: SearchResult[];
}

export class MissingTranslationFinder {
    private readonly dictionary: Map<
        Language,
        Map<Namespace, Map<TranslationId, string | TextToTranslateRef>>
    > = new Map();
    private readonly allTranslationRefs: Set<TextToTranslateRef> = new Set();
    private readonly translationManager: TranslationManager;

    constructor(options: { translationManager: TranslationManager }) {
        this.translationManager = options.translationManager;
    }

    async findAll(
        translator: TranslatorType,
        locales?: string[],
    ): Promise<MissingTranslationsOutput> {
        console.log(
            chalk.blue(
                `Start finding missing translations for ${locales ? locales?.join(" ") : "all locales"}`,
            ),
        );
        this.init();

        const searchResults: SearchResult[] = [];

        const otherLocales = this.translationManager.locales.filter(
            (locale) => {
                if (locale === globals.DEFAULT_LOCALE) {
                    return false;
                }

                if (locales) {
                    return locales.includes(locale);
                }

                return true;
            },
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
                if (
                    this.translationManager.getMappedLocale(locale) ===
                    globals.DEFAULT_LOCALE
                ) {
                    continue;
                }

                searchResults.push(
                    await this.search({
                        translator,
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
        translator,
        locale,
        namespace,
    }: {
        translator: TranslatorType;
        locale: string;
        namespace: string;
    }): Promise<SearchResult> {
        const sourceTranslations = this.translationManager.readSource(
            locale,
            namespace,
        );

        const machineTranslations =
            this.translationManager.readMachineTranslations(
                translator,
                locale,
                namespace,
            );

        const baseTranslations: Translations = Object.fromEntries(
            Object.entries(machineTranslations).concat(
                Object.entries(sourceTranslations),
            ),
        );

        const distTranslations = this.translationManager.readDist(
            locale,
            namespace,
        );

        const defaultDistTranslations = this.translationManager.readDist(
            globals.DEFAULT_LOCALE,
            namespace,
        );

        const missingTranslationIds = this.getMissingTranslationIds(
            baseTranslations,
            distTranslations,
            locale,
            namespace,
        );

        const missingTranslations: Translations = Object.fromEntries(
            missingTranslationIds.map((id) => {
                const text = defaultDistTranslations[id];
                if (text === undefined) {
                    throw new Error(
                        `Missing default translation for ${id} (namespace: ${namespace})`,
                    );
                }
                return [id, text] as [string, string];
            }),
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

        const mappedLocale = this.translationManager.getMappedLocale(locale);

        const existingTranslationsToAdd: TranslationDictionary = {};
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

                existingTranslationsToAdd[id] = {
                    original: text,
                    translation: existingTranslation,
                };
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

    private getMissingTranslationIds(
        baseTranslations: Translations,
        distTranslations: Translations,
        locale: string,
        namespace: string
    ): string[] {
        const isDefaultNamespace = namespace === globals.DEFAULT_NAMESPACE;

        if (isDefaultNamespace) {
            // if already in default namespace
            return Object.entries(distTranslations)
                .filter(
                    (entry) =>
                        baseTranslations.hasOwnProperty(entry[0]) === false,
                )
                .map((entry) => entry[0]);
        }

        // if not in default namespace
        const defaultNamespaceTranslations = this.translationManager.readDist(
            locale,
            globals.DEFAULT_NAMESPACE,
        );

        return Object.entries(distTranslations)
            .filter((entry) => {
                const key = entry[0];
                if (baseTranslations.hasOwnProperty(key) === false) {
                    const defaultNamespaceTranslation =
                        defaultNamespaceTranslations[key];
                    const translation = entry[1];

                    // not missing if the translation is the same as the default namespace
                    return defaultNamespaceTranslation !== translation;
                }

                return false;
            })
            .map((entry) => entry[0]);
    }
}
