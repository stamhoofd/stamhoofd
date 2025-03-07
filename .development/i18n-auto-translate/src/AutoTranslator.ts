import chalk from "chalk";
import { cliArguments } from "./CliArguments";
import { TranslatorType } from "./enums/TranslatorType";
import { globals } from "./globals";
import {
    MissingTranslationFinder,
    TextToTranslateRef,
} from "./MissingTranslationFinder";
import { TranslationManager } from "./TranslationManager";
import { ClaudeTranslator } from "./translators/ClaudeTranslator";
import { GoogleGeminiTranslator } from "./translators/GoogleGeminiTranslator";
import {
    AfterBatchTranslatedCallback,
    ITranslator,
} from "./translators/ITranslator";
import { MistralTranslator } from "./translators/MistralTranslator";
import { OpenAiTranslator } from "./translators/OpenAiTranslator";
import { Translations } from "./types/Translations";

export class AutoTranslator {
    private readonly finder: MissingTranslationFinder;
    private readonly translator: ITranslator;

    constructor(
        private readonly type: TranslatorType,
        private readonly manager: TranslationManager,
    ) {
        this.finder = new MissingTranslationFinder({
            translationManager: manager,
        });

        this.translator = this.createTranslator();
    }

    async start() {
        console.log(chalk.blue(`Start auto translate (translator: ${this.type})`));

        const missingTranslationsOutput = await this.finder.findAll(this.type, cliArguments.locales);

        // add the existing to the source of the locale/namespace combination
        for (const searchResult of missingTranslationsOutput.searchResults) {
            const translationsToAdd = searchResult.existingTranslationsToAdd;

            this.manager.addMachineTranslations(translationsToAdd, {
                translator: this.type,
                locale: searchResult.locale,
                namespace: searchResult.namespace,
            });
        }

        // after each batch -> check new translations
        const writeIntermediateResult = () => {
            for (const searchResult of missingTranslationsOutput.searchResults) {
                const translationsToAdd: Translations = {};

                for (const translationRef of searchResult.translationRefs) {
                    if (translationRef.isTranslated) {
                        translationsToAdd[translationRef.id] =
                            translationRef.translation;
                    }
                }

                this.manager.addMachineTranslations(translationsToAdd, {
                    translator: this.type,
                    locale: searchResult.locale,
                    namespace: searchResult.namespace,
                });
            }
        };

        // translate all translation refs
        await this.translate({
            translator: this.translator,
            allTranslationRefs: Array.from(
                missingTranslationsOutput.allTranslationRefs,
            ),
            originalLocal: globals.DEFAULT_LOCALE,
            afterBatchTranslated: () => writeIntermediateResult(),
        });

        writeIntermediateResult();
    }

    private async translate({
        translator,
        allTranslationRefs,
        originalLocal,
        afterBatchTranslated,
    }: {
        translator: ITranslator;
        allTranslationRefs: TextToTranslateRef[];
        originalLocal: string;
        afterBatchTranslated?: AfterBatchTranslatedCallback;
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
                    afterBatchTranslated,
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
        afterBatchTranslated,
    }: {
        translator: ITranslator;
        allTranslationRefs: TextToTranslateRef[];
        originalLocal: string;
        targetLocal: string;
        namespace: string;
        afterBatchTranslated?: AfterBatchTranslatedCallback;
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
                afterBatchTranslated: (batch) => {
                    const dict = Object.fromEntries(
                        batch.map(({ uuid, value }) => {
                            return [uuid, value];
                        }),
                    );

                    for (const translationRef of allTranslationRefs) {
                        const id = translationRef.id;
                        const translation = dict[id];
                        if (translation && !translationRef.isTranslated) {
                            translationRef.setTranslation(translation);
                        }
                    }

                    if (afterBatchTranslated) {
                        afterBatchTranslated(batch);
                    }
                },
            },
        );

        for (const translationRef of allTranslationRefs) {
            const id = translationRef.id;
            const translation = translations[id];
            if (translation && !translationRef.isTranslated) {
                translationRef.setTranslation(translation);
            }
            translationRef.markDidTry();
        }
    }

    private createTranslator(): ITranslator {
        switch (this.type.toLowerCase()) {
            case TranslatorType.Mistral.toLowerCase():
                return new MistralTranslator(this.manager);
            case TranslatorType.GoogleGemini.toLowerCase():
                return new GoogleGeminiTranslator(this.manager);
            case TranslatorType.OpenAi.toLowerCase():
                return new OpenAiTranslator(this.manager);
            case TranslatorType.Claude.toLowerCase():
                return new ClaudeTranslator(this.manager);
            default: {
                throw Error(`Unknown translator type: ${this.type}`);
            }
        }
    }
}
