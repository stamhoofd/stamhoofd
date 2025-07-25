import chalk from "chalk";
import { TranslatorType } from "../enums/TranslatorType";
import {
    getCountry,
    getLanguage,
    isValidLocale,
} from "../helpers/i18n-helpers";
import { globals } from "../shared/globals";
import { AutoTranslateOptions } from "../types/AutoTranslateOptions";
import { Translations } from "../types/Translations";
import { TranslationWithVariant } from "../types/TranslationWithVariant";
import { OutdatedTranslationFinder } from "./OutdatedTranslationFinder";
import { promptLogger } from "./PromptLogger";
import { TranslationManager } from "./TranslationManager";
import { ClaudeTranslator } from "./translators/ClaudeTranslator";
import { GoogleGeminiTranslator } from "./translators/GoogleGeminiTranslator";
import { ITranslator } from "./translators/ITranslator";
import {
    MistralLargeTranslator,
    MistralSmallTranslator,
} from "./translators/MistralTranslator";
import { OpenAiTranslator } from "./translators/OpenAiTranslator";
import { Translator } from "./translators/Translator";

export class AutoTranslator {
    private readonly outdatedTranslationFinder: OutdatedTranslationFinder;
    private readonly translator: ITranslator;
    private originalTextsBeforeReplacements: Translations | null = null;
    private defaultTexts: Translations | null = null;
    private defaultReplacements: Record<string, string> | null = null;

    constructor(
        private readonly type: TranslatorType,
        private readonly manager: TranslationManager,
        private readonly options: AutoTranslateOptions,
    ) {
        this.outdatedTranslationFinder = new OutdatedTranslationFinder({
            translationManager: manager,
        });

        this.translator = this.createTranslator();
    }

    async start() {
        const locales = this.options.locales;
        if (locales) {
            locales.forEach((l) => {
                if (!isValidLocale(l)) {
                    throw new Error("Invalid locale: " + l);
                }
            });
        }

        const otherLocales = this.manager.locales.filter((locale) => {
            if (locale === globals.DEFAULT_LOCALE || this.manager.getMappedLocale(locale) === globals.DEFAULT_LOCALE) {
                return false;
            }

            if (locales) {
                return locales.includes(locale);
            }

            return true;
        });

        await this.manager.buildDist();
        this.outdatedTranslationFinder.removeOutdatedTranslations(
            this.type,
            locales,
        );
        await this.manager.buildDist();

        // first auto translate default namespace and locale
        await this.autoTranslateDefaultNamespace(otherLocales);

        if (!(await this.isDefaultNamespaceTranslationComplete(otherLocales))) {
            const message =
                "Translation of other namespaces is skipped because the default namespace is not translated completely yet.";
            console.log(chalk.red(message));
            promptLogger.error(message);
            console.log('Locales', otherLocales.join(', '));
            return;
        }

        // translate other namespaces
        for (const namespace of this.manager.namespaces) {
            if (namespace === globals.DEFAULT_NAMESPACE) {
                continue;
            }

            for (const locale of otherLocales) {
                await this.autoTranslateNamespace({ namespace, locale });
            }
        }
    }

    private async autoTranslateDefaultNamespace(otherLocales: string[]) {
        for (const locale of otherLocales) {
            await this.autoTranslateNamespace({
                namespace: globals.DEFAULT_NAMESPACE,
                locale,
            });
        }
    }

    private async isDefaultNamespaceTranslationComplete(
        otherLocales: string[],
    ): Promise<boolean> {
        for (const locale of otherLocales) {
            const missingTranslations = await this.findMissingTranslations({
                namespace: globals.DEFAULT_NAMESPACE,
                locale,
            });

            if (Object.keys(missingTranslations).length > 0) {
                console.log('missingTranslations', missingTranslations);
                return false;
            }
        }

        return true;
    }

    private getOriginalTextsBeforeReplacements(): Translations {
        if (this.originalTextsBeforeReplacements !== null) {
            return this.originalTextsBeforeReplacements;
        }

        const namespace = globals.DEFAULT_NAMESPACE;
        const language = getLanguage(globals.DEFAULT_LOCALE);
        const country =
            getCountry(globals.DEFAULT_LOCALE) ?? globals.DEFAULT_COUNTRY;
        const locale = `${language}-${country}`;

        this.originalTextsBeforeReplacements = {
            ...this.manager.readSource(language, namespace),
            ...this.manager.readSource(locale, namespace),
        };

        return this.originalTextsBeforeReplacements;
    }

    private getDefaultTexts(): Translations {
        if (this.defaultTexts !== null) {
            return this.defaultTexts;
        }

        this.defaultTexts = this.manager.readDist(
            globals.DEFAULT_LOCALE,
            globals.DEFAULT_NAMESPACE,
        );

        return this.defaultTexts;
    }

    private getDefaultReplacements(): Record<string, string> {
        if (this.defaultReplacements !== null) {
            return this.defaultReplacements;
        }

        this.defaultReplacements = {
            ...this.manager.readSourceBaseReplacements(
                globals.DEFAULT_NAMESPACE,
            ),
            ...this.manager.readSourceReplacements(
                getLanguage(globals.DEFAULT_LOCALE),
                globals.DEFAULT_NAMESPACE,
            ),
            ...this.manager.readSourceReplacements(
                globals.DEFAULT_LOCALE,
                globals.DEFAULT_NAMESPACE,
            ),
        };

        return this.defaultReplacements;
    }

    private async autoTranslateNamespace(args: {
        namespace: string;
        locale: string;
    }) {
        if (args.locale === globals.DEFAULT_LOCALE) {
            throw new Error(
                `Should not translate default locale: ${args.locale}`,
            );
        }

        console.log(
            `Start auto translate (namespace: ${args.namespace}, locale: ${args.locale})`,
        );

        // build dist
        await this.manager.buildDist();

        // get missing translations
        const missingTranslations = await this.findMissingTranslations(args);
        let simpleTranslations: Translations = {};
        const translationsWithVariants: Record<string, TranslationWithVariant> =
            {};

        if (args.namespace !== globals.DEFAULT_NAMESPACE) {
            const originalTextsBeforeReplacements =
                this.getOriginalTextsBeforeReplacements();

            const defaultTexts = this.getDefaultTexts();

            const translationsOfOriginalTexts = this.manager.readDist(
                args.locale,
                globals.DEFAULT_NAMESPACE,
            );

            const replacements = {
                ...this.getDefaultReplacements(),
                ...this.manager.readSourceBaseReplacements(args.namespace),
                ...this.manager.readSourceReplacements(
                    globals.DEFAULT_LOCALE,
                    args.namespace,
                ),
            };

            for (const [uuid, missingTranslation] of Object.entries(
                missingTranslations,
            )) {
                const originalTextBeforeReplacements =
                    originalTextsBeforeReplacements[uuid];

                if (originalTextBeforeReplacements === undefined) {
                    throw new Error(
                        `No original text before replacements found for key ${uuid} (${JSON.stringify(originalTextsBeforeReplacements)})`,
                    );
                }

                let originalAfterReplacements = originalTextBeforeReplacements;

                for (const [key, value] of Object.entries(replacements)) {
                    originalAfterReplacements =
                        originalAfterReplacements.replaceAll(
                            new RegExp(`${key}+(?![^{]*})`, "g"),
                            value,
                        );
                }

                if (
                    originalAfterReplacements !== originalTextBeforeReplacements
                ) {
                    const translationOfOriginal =
                        translationsOfOriginalTexts[uuid];

                    if (translationOfOriginal === undefined) {
                        throw new Error(
                            `No translation of original text found for key ${uuid}`,
                        );
                    }

                    const original = defaultTexts[uuid];

                    if (original === undefined) {
                        throw new Error(
                            `No original text found for key ${uuid}`,
                        );
                    }

                    translationsWithVariants[uuid] = {
                        original,
                        translation: translationOfOriginal,
                        variant: missingTranslation,
                    };
                } else {
                    simpleTranslations[uuid] = missingTranslation;
                }
            }
        } else {
            simpleTranslations = missingTranslations;
        }

        if (Object.keys(simpleTranslations).length !== 0) {
            // translate simple translations
            await this.translator.translateAll(simpleTranslations, {
                originalLocal: globals.DEFAULT_LOCALE,
                targetLocal: args.locale,
                namespace: args.namespace,
                afterBatchTranslated: (batch) => {
                    const dict = Object.fromEntries(
                        batch.map(({ uuid, value }) => {
                            return [
                                uuid,
                                {
                                    original: simpleTranslations[uuid],
                                    translation: value,
                                },
                            ];
                        }),
                    );

                    this.manager.addMachineTranslationDictionary(dict, {
                        translator: this.type,
                        locale: args.locale,
                        namespace: args.namespace,
                    });
                },
            });
        }

        // translate translations with variant
        if (Object.keys(translationsWithVariants).length !== 0) {
            await this.translator.translateAllVariants(
                translationsWithVariants,
                {
                    originalLocal: globals.DEFAULT_LOCALE,
                    targetLocal: args.locale,
                    namespace: args.namespace,
                    afterBatchTranslated: (batch) => {
                        const dict = Object.fromEntries(
                            batch.map(({ uuid, value }) => {
                                return [
                                    uuid,
                                    {
                                        original:
                                            translationsWithVariants[uuid]
                                                .variant,
                                        translation: value,
                                    },
                                ];
                            }),
                        );

                        this.manager.addMachineTranslationDictionary(dict, {
                            translator: this.type,
                            locale: args.locale,
                            namespace: args.namespace,
                        });
                    },
                },
            );
        }
    }

    private getBaseTranslations(namespace: string, locale: string) {
        const sourceTranslations = this.manager.readSource(locale, namespace);

        const machineTranslations = this.manager.readMachineTranslations(
            this.type,
            locale,
            namespace,
        );

        const baseTranslations: Translations = Object.fromEntries(
            Object.entries(machineTranslations).concat(
                Object.entries(sourceTranslations),
            ),
        );

        return baseTranslations;
    }

    private async findMissingTranslations({
        namespace,
        locale,
    }: {
        namespace: string;
        locale: string;
    }): Promise<Translations> {
        const baseTranslations: Translations = this.getBaseTranslations(
            namespace,
            locale,
        );

        const distTranslations = this.manager.readDist(locale, namespace);

        const defaultDistTranslations = this.manager.readDist(
            globals.DEFAULT_LOCALE,
            namespace,
        );

        const missingTranslationIds = this.getMissingTranslationIds(
            baseTranslations,
            distTranslations,
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

        return missingTranslations;
    }

    /**
     * 
     * @param baseTranslations 
     * @param distTranslations 
     * @param locale 
     * @param namespace 
     * @returns 
     */
    private getMissingTranslationIds(
        baseTranslations: Translations,
        distTranslations: Translations,
        namespace: string,
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
        const defaultTexts = this.manager.readDist(
            'nl-BE',
            globals.DEFAULT_NAMESPACE,
        );

        const defaultNamespaceTexts = this.manager.readDist(
            'nl-BE',
            namespace,
        );

        return Object.entries(distTranslations)
            .filter((entry) => {
                const key = entry[0];
                if (baseTranslations.hasOwnProperty(key) === false) {
                    // Only translate this key for this namespace if the
                    // value in dutch for the default namespace is not the same for the value in dutch for this namespace
                    const defaultText = defaultTexts[key];
                    const defaultNamespaceText = defaultNamespaceTexts[key];

                    if (defaultText === undefined) {
                        throw new Error(
                            `Missing default translation for ${key} in default namespace`,
                        );
                    }

                    if (defaultNamespaceText === undefined) {
                        throw new Error(
                            `Missing default translation for ${key} in namespace ${namespace}`,
                        );
                    }

                    return defaultNamespaceText !== defaultText;
                }

                // This translation is already present in the base translations (machine translations + custom)
                return false;
            })
            .map((entry) => entry[0]);
    }

    private createTranslator(): ITranslator {
        const dict: [TranslatorType, typeof Translator][] = [
            [TranslatorType.MistralLarge, MistralLargeTranslator],
            [TranslatorType.MistralSmall, MistralSmallTranslator],
            [TranslatorType.GoogleGemini, GoogleGeminiTranslator],
            [TranslatorType.OpenAi, OpenAiTranslator],
            [TranslatorType.Claude, ClaudeTranslator],
        ];

        const type = this.type.toLowerCase();

        for (const [translatorType, translator] of dict) {
            if (translatorType.toLowerCase() === type) {
                return new (translator as any)(this.manager, this.options);
            }
        }

        throw Error(`Unknown translator type: ${type}`);
    }
}
