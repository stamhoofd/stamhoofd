import chalk from "chalk";
import { validateTranslations } from "../../helpers/validate-translations";
import { AutoTranslateOptions } from "../../types/AutoTranslateOptions";
import { Batch } from "../../types/Batch";
import { PromptBatch } from "../../types/PromptBatch";
import { Translations } from "../../types/Translations";
import { TranslationWithVariant } from "../../types/TranslationWithVariant";
import { PromiseQueue } from "../PromiseQueue";
import { promptLogger } from "../PromptLogger";
import { TranslationManager } from "../TranslationManager";
import { AfterBatchTranslatedCallback, ITranslator } from "./ITranslator";

export abstract class Translator implements ITranslator {
    // Max amount of characters in a batch
    protected abstract readonly maxBatchLength: number;

    // Do not send all prompts at once because api can block requests if too many in short period
    protected abstract readonly queue: PromiseQueue<Batch<any>>;

    constructor(
        protected readonly manager: TranslationManager,
        protected readonly options: AutoTranslateOptions,
    ) {}

    protected abstract generateResponse(prompt: string): Promise<string>;

    private fakeGenerateResponse<T>(
        batch: PromptBatch<T>,
        {
            originalLocal,
            targetLocal,
            namespace,
            getTranslation
        }: { originalLocal: string; targetLocal: string; namespace: string; getTranslation: (batchValue: T) => string },
    ): Promise<string> {
        // const randomNumber = Math.random() * 100;
        // if (randomNumber < 20) {
        //     throw new Error(
        //         `Random fail of fake tranlation (random number: ${randomNumber})`,
        //     );
        // }

        const infoText = `Fake translated from ${originalLocal} to ${targetLocal} for namespace ${namespace}: `;
        return Promise.resolve(
            JSON.stringify(
                batch.map(({ id, value }) => {
                    return {
                        id,
                        value: infoText + getTranslation(value),
                    };
                }),
            ),
        );
    }

    // override if necessary
    protected createPromptForSimpleTranslation(
        batch: PromptBatch<string>,
        {
            originalLocal,
            targetLocal,
            consistentWords,
            prompt
        }: {
            originalLocal: string;
            targetLocal: string;
            consistentWords: Record<string, string> | null;
            prompt: string;
        },
    ): string {
        const consistentWordsText =
            consistentWords && Object.keys(consistentWords).length > 0
                ? `\n- Make sure certain words are translated consistently, most often we use the following words, so try to keep the following translations in sentences if the context makes sense: \n` +
                  JSON.stringify(consistentWords, undefined, "  ") +
                  "\n"
                : "";

        const fullPrompt = `Translate the values of the JSON array from ${originalLocal} to ${targetLocal}.${consistentWordsText}
${prompt ? (prompt + "\n") : ""}
Translate this array: 
${JSON.stringify(batch, undefined, "  ")}

Translate the above values of the JSON array from ${originalLocal} to ${targetLocal}.${prompt ? ("\n" + prompt): ""}`;

        return fullPrompt;
    }

    // override if necessary
    protected createPromptForTranslationWithVariant(
        batch: PromptBatch<TranslationWithVariant>,
        {
            originalLocal,
            targetLocal,
            consistentWords,
            prompt
        }: {
            originalLocal: string;
            targetLocal: string;
            consistentWords: Record<string, string> | null;
            prompt: string;
        },
    ): string {
        const consistentWordsText =
            consistentWords && Object.keys(consistentWords).length > 0
                ? `\n- Make sure certain words are translated consistently, most often we use the following words, so try to keep the following translations in sentences if the context makes sense: \n` +
                  JSON.stringify(consistentWords, undefined, "  ") +
                  ".\n"
                : "";
            
        const fullPrompt = `Given is an array with an original text in ${originalLocal}, the translation of that text and a variant of the original translation. Translate the variants ("variant" property) of the original texts in a consistent way (in a new "value" property of each object), while trying to stay close to the example translation ("example" and "exampleTranslation"). ${consistentWordsText}
${prompt ? (prompt + "\n") : ""}
Translate the variants in this array to ${targetLocal}: 
    
${JSON.stringify(batch.map(b => {
    return {
        id: b.id,
        "example": b.value.original,
        "exampleTranslation": b.value.translation,
        "variant": b.value.variant,
    }
}), undefined, "  ")}

Above is an array with an original text in ${originalLocal}, the translation of that text and a variant of the original translation. Translate the variants of the original texts ("variant" property) in a consistent way (in a new "value" property of each object), while trying to stay close to the example translation ("example" and "exampleTranslation").${consistentWordsText}${prompt ? ("\n" + prompt): ""}`;

        return fullPrompt;
    }

    protected async getTextFromApiForSimpleTranslation(
        batch: PromptBatch<string>,
        args: {
            originalLocal: string;
            targetLocal: string;
            consistentWords: Record<string, string> | null;
            namespace: string;
            batchNumber: number;
            totalBatches: number;
            prompt: string;
        },
    ): Promise<string> {
        const prompt = this.createPromptForSimpleTranslation(batch, args);

        const logResult = promptLogger.prompt(prompt, args);

        const text = this.options.fake
            ? await this.fakeGenerateResponse(batch, {...args, getTranslation: (x) => x})
            : await this.generateResponse(prompt);

        logResult(text);

        return text;
    }

    protected async getTextFromApiForTranslationWithVariant(
        batch: PromptBatch<TranslationWithVariant>,
        args: {
            originalLocal: string;
            targetLocal: string;
            consistentWords: Record<string, string> | null;
            namespace: string;
            batchNumber: number;
            totalBatches: number;
            prompt: string;
        },
    ): Promise<string> {
        const prompt = this.createPromptForTranslationWithVariant(batch, args);

        const logResult = promptLogger.prompt(prompt, args);

        const text = this.options.fake
            ? await this.fakeGenerateResponse(batch, {...args, getTranslation: (x) => x.variant})
            : await this.generateResponse(prompt);

        logResult(text);

        return text;
    }

    private splitInBatches<T>(items: Record<string, T>): Batch<T>[] {
        const batches: Batch<T>[] = [];

        let currentIndex = 0;

        for (const [uuid, value] of Object.entries(items)) {
            const item = { value, uuid };
            const batchIfNewItem = (batches[currentIndex] ?? []).concat([item]);

            if (JSON.stringify(batchIfNewItem).length > this.maxBatchLength) {
                currentIndex = currentIndex + 1;
            }

            let batch = batches[currentIndex];
            if (!batch) {
                batch = [];
                batches[currentIndex] = batch;
            }

            batch.push(item);
        }

        return batches;
    }

    protected async translateSimpleBatch(
        batch: Batch<string>,
        args: {
            originalLocal: string;
            targetLocal: string;
            consistentWords: Record<string, string> | null;
            namespace: string;
            batchNumber: number;
            totalBatches: number;
            prompt: string;
        },
    ): Promise<Batch<string>> {
        const promptBatch: PromptBatch<string> = batch.map(({ value }, id) => {
            return {
                id,
                value,
            };
        });

        const text = await this.getTextFromApiForSimpleTranslation(
            promptBatch,
            args,
        );
        const json = this.textToJson(text);

        return json.map(({ id, value }) => {
            // the id is the index of the translation in the batch
            const uuid = batch[id].uuid;
            return { uuid, value };
        });
    }

    protected async translateBatchWithVariant(
        batch: Batch<TranslationWithVariant>,
        args: {
            originalLocal: string;
            targetLocal: string;
            consistentWords: Record<string, string> | null;
            namespace: string;
            batchNumber: number;
            totalBatches: number;
            prompt: string;
        },
    ): Promise<Batch<string>> {
        const promptBatch: PromptBatch<TranslationWithVariant> = batch.map(
            ({ value }, id) => {
                return {
                    id,
                    value,
                };
            },
        );

        const text = await this.getTextFromApiForTranslationWithVariant(
            promptBatch,
            args,
        );
        const json = this.textToJson(text);

        return json.map(({ id, value }) => {
            // the id is the index of the translation in the batch
            const uuid = batch[id].uuid;
            return { uuid, value };
        });
    }

    // override if necessary
    protected canRetryBatch(_error: any): boolean {
        return false;
    }

    private async translateBatches<T>(
        batches: Batch<T>[],
        {
            originalLocal,
            targetLocal,
            translations,
            consistentWords,
            namespace,
            translateBatch,
            getUntranslatedValue,
            afterBatchTranslated,
            prompt
        }: {
            originalLocal: string;
            targetLocal: string;
            translations: Record<string, T>;
            consistentWords: Record<string, string> | null;
            namespace: string;
            translateBatch: (
                batch: Batch<T>,
                args: {
                    originalLocal: string;
                    targetLocal: string;
                    consistentWords: Record<string, string> | null;
                    namespace: string;
                    batchNumber: number;
                    totalBatches: number;
                    prompt: string;
                },
            ) => Promise<Batch<string>>;
            getUntranslatedValue: (item: T) => string;
            afterBatchTranslated?: AfterBatchTranslatedCallback;
            prompt: string;
        },
    ): Promise<Translations> {
        const promises: Promise<Batch<string>>[] = batches.map(
            async (batch, i) => {
                const batchNumber = i + 1;
                const totalBatches = batches.length;

                const tryTranslateBatchInQueue = async () => {
                    try {
                        const result = await this.queue.add(async () => {
                            console.log(
                                chalk.gray(
                                    `Start translating batch ${batchNumber} of ${totalBatches}`,
                                ),
                            );

                            const translatedBatch = await translateBatch(
                                batch,
                                {
                                    originalLocal,
                                    targetLocal,
                                    consistentWords,
                                    namespace,
                                    batchNumber,
                                    totalBatches,
                                    prompt
                                },
                            );

                            console.log(
                                chalk.gray(
                                    `Finished translating batch ${batchNumber} of ${totalBatches}`,
                                ),
                            );

                            const validatedBatch: Batch<string> =
                                translatedBatch.filter(({ uuid, value }) => {
                                    const original = getUntranslatedValue(
                                        translations[uuid],
                                    );
                                    return this.validateTranslation(
                                        original,
                                        value,
                                    );
                                });

                            if (validatedBatch.length > 10) {
                                // throw error if all translations in batch are equal to original
                                if (
                                    validatedBatch.every(
                                        ({ uuid, value }) =>
                                            value ===
                                            getUntranslatedValue(
                                                translations[uuid],
                                            ),
                                    )
                                ) {
                                    throw new Error(
                                        "All translations in batch are equal to original",
                                    );
                                }
                            }

                            if (afterBatchTranslated) {
                                afterBatchTranslated(validatedBatch);
                            }

                            return validatedBatch;
                        });

                        return result;
                    } catch (error) {
                        const errorMessage = `Failed translating batch ${batchNumber} of ${totalBatches} (from ${originalLocal} to ${targetLocal}, namespace: ${namespace}):
${error}`;
                        console.error(chalk.red(errorMessage));
                        promptLogger.error(errorMessage);

                        if (this.canRetryBatch(error)) {
                            console.log(
                                chalk.yellow(
                                    `Retry translating batch ${batchNumber} of ${totalBatches} from ${originalLocal} to ${targetLocal} for namespace: ${namespace}.`,
                                ),
                            );
                            return await tryTranslateBatchInQueue();
                        }

                        return [];
                    }
                };

                return await tryTranslateBatchInQueue();
            },
        );

        const translatedBatches = await Promise.all(promises);

        return Object.fromEntries(
            translatedBatches
                .flatMap((x) => x)
                .map(({ uuid, value }) => {
                    return [uuid, value];
                }),
        );
    }

    async translateAll(
        translations: Translations,
        args: {
            originalLocal: string;
            targetLocal: string;
            namespace: string;
            afterBatchTranslated?: AfterBatchTranslatedCallback;
        },
    ): Promise<Translations> {
        const targetLocal = args.targetLocal;

        console.log(
            chalk.white(
                `Start translate ${Object.keys(translations).length} items from ${args.originalLocal} to ${targetLocal} for namespace ${args.namespace}`,
            ),
        );

        // console.log(chalk.cyan(JSON.stringify(translations)))

        const { valid, message } = validateTranslations(translations);
        if (!valid) {
            throw new Error(message);
        }

        const batches = this.splitInBatches(translations);

        const consistentWords = this.manager.getConsistentWords(
            targetLocal,
            args.namespace,
        );

        const prompt = this.manager.getPrompt(
            args.namespace,
        );

        const result = await this.translateBatches(batches, {
            originalLocal: args.originalLocal,
            targetLocal,
            translations,
            consistentWords,
            namespace: args.namespace,
            translateBatch: (batch, args) => this.translateSimpleBatch(batch, args),
            getUntranslatedValue: (item: string) => item,
            afterBatchTranslated: args.afterBatchTranslated,
            prompt
        });

        console.log(
            chalk.green(
                `Finished translate ${Object.keys(translations).length} items from ${args.originalLocal} to ${targetLocal} for namespace ${args.namespace}`,
            ),
        );

        return result;
    }

    async translateAllVariants(
        translationsWithVariant: Record<string, TranslationWithVariant>,
        args: {
            originalLocal: string;
            targetLocal: string;
            namespace: string;
            afterBatchTranslated?: AfterBatchTranslatedCallback;
        },
    ) {
        const targetLocal = args.targetLocal;

        console.log(
            chalk.white(
                `Start translate ${Object.keys(translationsWithVariant).length} items with variants from ${args.originalLocal} to ${targetLocal} for namespace ${args.namespace}`,
            ),
        );

        console.log(chalk.cyan(JSON.stringify(translationsWithVariant)));

        const batches = this.splitInBatches(translationsWithVariant);

        const consistentWords = this.manager.getConsistentWords(
            targetLocal,
            args.namespace,
        );

        const prompt = this.manager.getPrompt(
            args.namespace,
        );

        const result = await this.translateBatches(batches, {
            originalLocal: args.originalLocal,
            targetLocal,
            translations: translationsWithVariant,
            consistentWords,
            namespace: args.namespace,
            translateBatch: (batch, args) => this.translateBatchWithVariant(batch, args),
            getUntranslatedValue: (item: TranslationWithVariant) =>
                item.variant,
            afterBatchTranslated: args.afterBatchTranslated,
            prompt
        });

        console.log(
            chalk.green(
                `Finished translate ${Object.keys(translationsWithVariant).length} items from ${args.originalLocal} to ${targetLocal} for namespace ${args.namespace}`,
            ),
        );

        return result;
    }

    private validateTranslation(
        original: string,
        translation: string,
    ): boolean {
        if (original.length > 0 && translation.length === 0) {
            const errorMessage = `The AI returned an empty string for a non-empty original string. Original: ${original}, translation: ${translation} - it is likely that the AI does not have enough context to provide a correct translation. Please check the translation or tranlate it manually.`;
            console.error(errorMessage);
            promptLogger.error(errorMessage);
            return false;
        }

        if (original.length > 20 && translation === original) {
            const errorMessage = `Translation and original are equal: ${original}`;
            console.error(errorMessage);
            promptLogger.error(errorMessage);
            return false;
        }

        const regex = /{((?:.|\r|\n)*?)}/g;
        const originalMatches = original.matchAll(regex);
        const translationMatches = translation.matchAll(regex);
        const originalArguments = [...originalMatches].map((match) => match[1]);
        const translationArguments = [...translationMatches].map(
            (match) => match[1],
        );

        if (originalArguments.length !== translationArguments.length) {
            const errorMessage = `Original arguments length (${originalArguments.length}) does not match translation arguments length (${translationArguments.length}). Original: ${original}, translation: ${translation}`;
            console.error(errorMessage);
            promptLogger.error(errorMessage);
            return false;
        }

        const orginalMap = this.createArgumentOccurrenceMap(originalArguments);
        const translationMap =
            this.createArgumentOccurrenceMap(translationArguments);

        for (const [argument, count] of orginalMap.entries()) {
            const translationCount = translationMap.get(argument);
            if (translationCount !== count) {
                const errorMessage = `Original arguments count does not match translation arguments count. Argument: ${argument}, Original count: ${count}, Translation count: ${translationCount}, original: ${original}, translation: ${translation}`;
                console.error(chalk.red(errorMessage));
                promptLogger.error(errorMessage);
                return false;
            }
        }

        return true;
    }

    private createArgumentOccurrenceMap(array: string[]): Map<string, number> {
        const map = new Map<string, number>();

        array.forEach((item) => {
            const count = map.get(item) ?? 0;
            map.set(item, count + 1);
        });

        return map;
    }

    // to override if necessary
    protected transformParsedJson<T>(parsedJson: T): T {
        return parsedJson;
    }

    private textToJson(result: string): PromptBatch<string> {
        const json = JSON.parse(result);
        const { isValid, message } = this.validateJson(json);

        if (!isValid) {
            throw new Error(message);
        }

        return this.transformParsedJson(json);
    }

    protected validateJson(json: any): { isValid: boolean; message?: string } {
        if (typeof json !== "object") {
            return {
                isValid: false,
                message: "Json is not an object.",
            };
        }

        if (!Array.isArray(json)) {
            return {
                isValid: false,
                message: "Json is not an array.",
            };
        }

        if (
            json.some((item) => {
                if (typeof item !== "object") {
                    return true;
                }
                if (typeof item["id"] !== "number") {
                    return true;
                }
                if (typeof item["value"] !== "string") {
                    return true;
                }
                return false;
            })
        ) {
            return {
                isValid: false,
                message:
                    "Json is not an array of objects with a number id and a string value.",
            };
        }

        return {
            isValid: true,
        };
    }
}
