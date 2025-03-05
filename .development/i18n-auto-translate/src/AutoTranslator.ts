import { globals } from "./globals";
import {
    MissingTranslationFinder,
    TextToTranslateRef,
} from "./MissingTranslationFinder";
import { promptLogger } from "./PromptLogger";
import { TranslationManager } from "./TranslationManager";
import { ITranslator } from "./translators/ITranslator";

export class AutoTranslator {
    private readonly finder: MissingTranslationFinder;

    constructor(
        private readonly translator: ITranslator,
        private readonly manager: TranslationManager,
    ) {
        this.finder = new MissingTranslationFinder({
            translationManager: manager,
        });
    }

    async start() {
        const missingTranslationsOutput = await this.finder.findAll();

        // translate all translation refs
        await this.translate({
            translator: this.translator,
            allTranslationRefs: Array.from(
                missingTranslationsOutput.allTranslationRefs,
            ),
            originalLocal: globals.DEFAULT_LOCALE,
        });

        // add the existing and new translations to the source of the locale/namespace combination
        for (const searchResult of missingTranslationsOutput.searchResults) {
            const translationsToAdd = searchResult.existingTranslationsToAdd;

            for (const translationRef of searchResult.translationRefs) {
                if (translationRef.isTranslated) {
                    translationsToAdd[translationRef.id] =
                        translationRef.translation;
                }
            }

            this.manager.addMachineTranslations(translationsToAdd, {
                locale: searchResult.locale,
                namespace: searchResult.namespace,
            });
        }

        // log failed translations
        Array.from(missingTranslationsOutput.allTranslationRefs)
            .filter((x) => x.didTry && !x.isTranslated)
            .forEach((translationRef) => {
                const errorMessage = `Failed to translate ${translationRef.id} in ${translationRef.locale}: ${translationRef.text}`;
                promptLogger.error(errorMessage);
            });
    }

    private async translate({
        translator,
        allTranslationRefs,
        originalLocal,
    }: {
        translator: ITranslator;
        allTranslationRefs: TextToTranslateRef[];
        originalLocal: string;
    }) {
        const map = this.groupTranslationRefs(allTranslationRefs);

        const promises: Promise<void>[] = [];

        for (const [language, languageMap] of map.entries()) {
            for (const [namespace, group] of languageMap.entries()) {
                const promise = this.translateGroup({
                    translator,
                    allTranslationRefs: group,
                    originalLocal,
                    targetLocal: language,
                    namespace,
                });
                promises.push(promise);
            }
        }

        await Promise.all(promises);
    }

    /**
     * Groups translation refs by language and namespace
     */
    private groupTranslationRefs(
        allTranslationRefs: TextToTranslateRef[],
    ): Map<string, Map<string, TextToTranslateRef[]>> {
        const map = new Map<string, Map<string, TextToTranslateRef[]>>();

        for (const translationRef of allTranslationRefs) {
            const locale = translationRef.locale;
            const namespace = translationRef.namespace;

            let localeMap = map.get(locale);
            if (!localeMap) {
                localeMap = new Map();
                map.set(locale, localeMap);
            }

            let array = localeMap.get(namespace);
            if (!array) {
                array = [];
                localeMap.set(namespace, array);
            }

            array.push(translationRef);
        }

        return map;
    }

    private async translateGroup({
        translator,
        allTranslationRefs,
        originalLocal,
        targetLocal,
        namespace,
    }: {
        translator: ITranslator;
        allTranslationRefs: TextToTranslateRef[];
        originalLocal: string;
        targetLocal: string;
        namespace: string;
    }) {
        const tempTranslationObject = {};

        for (const translationRef of allTranslationRefs) {
            const text = translationRef.text;
            const id = translationRef.id;
            tempTranslationObject[id] = text;
        }

        const translations = await translator.translateAll(
            tempTranslationObject,
            {
                originalLocal,
                targetLocal,
                namespace,
            },
        );

        for (const translationRef of allTranslationRefs) {
            const id = translationRef.id;
            const translation = translations[id];
            if (translation) {
                translationRef.setTranslation(translation);
            }
            translationRef.markDidTry();
        }
    }
}
