import chalk from "chalk";
import { validateTranslations } from "../../helpers/validate-translations";
import { AutoTranslateOptions } from "../../types/AutoTranslateOptions";
import { Batch } from "../../types/Batch";
import { PromptBatch } from "../../types/PromptBatch";
import { Translations } from "../../types/Translations";
import { PromiseQueue } from "../PromiseQueue";
import { promptLogger } from "../PromptLogger";
import { TranslationManager } from "../TranslationManager";
import { AfterBatchTranslatedCallback, ITranslator } from "./ITranslator";

export abstract class Translator implements ITranslator {
    // Max amount of characters in a batch
    protected abstract readonly maxBatchLength: number;

    // Do not send all prompts at once because api can block requests if too many in short period
    protected abstract readonly queue: PromiseQueue<Batch>;

    constructor(
        protected readonly manager: TranslationManager,
        protected readonly options: AutoTranslateOptions,
    ) {}

    protected abstract generateResponse(prompt: string): Promise<string>;

    private fakeGenerateResponse(
        batch: PromptBatch,
        {
            originalLocal,
            targetLocal,
            namespace,
        }: { originalLocal: string; targetLocal: string; namespace: string },
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
                        value: infoText + value,
                    };
                }),
            ),
        );
    }

    // override if necessary
    protected createPrompt(
        batch: PromptBatch,
        {
            originalLocal,
            targetLocal,
            consistentWords,
            namespace,
        }: {
            originalLocal: string;
            targetLocal: string;
            consistentWords: Record<string, string> | null;
            namespace: string;
        },
    ): string {
        const consistentWordsText = consistentWords
            ? ` Use this dictionary of translations for consistency: ` +
              JSON.stringify(consistentWords) +
              "."
            : "";

        const prompt = `Translate the values of the json array from ${originalLocal} to ${targetLocal}.${consistentWordsText}

Important: do not translate words between curly brackets (even if it is a consistent word). For example {een-voorbeeld} must remain {een-voorbeeld}.

Translate this array: ${JSON.stringify(batch)}`;

        return prompt;
    }

    protected async getTextFromApi(
        batch: PromptBatch,
        args: {
            originalLocal: string;
            targetLocal: string;
            consistentWords: Record<string, string> | null;
            namespace: string;
            batchNumber: number;
            totalBatches: number;
        },
    ): Promise<string> {
        const prompt = this.createPrompt(batch, args);

        const logResult = promptLogger.prompt(prompt, args);

        const text = this.options.fake
            ? await this.fakeGenerateResponse(batch, args)
            : await this.generateResponse(prompt);

        logResult(text);

        return text;
    }

    private splitTranslationInBatches(translations: Translations): Batch[] {
        const batches: Batch[] = [];

        let currentIndex = 0;

        for (const [uuid, value] of Object.entries(translations)) {
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

    protected async translateBatch(
        batch: Batch,
        args: {
            originalLocal: string;
            targetLocal: string;
            consistentWords: Record<string, string> | null;
            namespace: string;
            batchNumber: number;
            totalBatches: number;
        },
    ): Promise<Batch> {
        const promptBatch: PromptBatch = batch.map(({ value }, id) => {
            return {
                id,
                value,
            };
        });

        const text = await this.getTextFromApi(promptBatch, args);
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

    private async translateBatches(
        batches: Batch[],
        {
            originalLocal,
            targetLocal,
            translations,
            consistentWords,
            namespace,
            afterBatchTranslated,
        }: {
            originalLocal: string;
            targetLocal: string;
            translations: Translations;
            consistentWords: Record<string, string> | null;
            namespace: string;
            afterBatchTranslated?: AfterBatchTranslatedCallback;
        },
    ): Promise<Translations> {
        const promises: Promise<Batch>[] = batches.map(async (batch, i) => {
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
                        const translatedBatch = await this.translateBatch(
                            batch,
                            {
                                originalLocal,
                                targetLocal,
                                consistentWords,
                                namespace,
                                batchNumber,
                                totalBatches,
                            },
                        );

                        console.log(
                            chalk.gray(
                                `Finished translating batch ${batchNumber} of ${totalBatches}`,
                            ),
                        );

                        const validatedBatch = translatedBatch.filter(
                            ({ uuid, value }) => {
                                const original = translations[uuid];
                                return this.validateTranslation(
                                    original,
                                    value,
                                );
                            },
                        );

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
        });

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

        const batches = this.splitTranslationInBatches(translations);

        const consistentWords = this.manager.getConsistentWords(
            targetLocal,
            args.namespace,
        );

        const result = await this.translateBatches(batches, {
            originalLocal: args.originalLocal,
            targetLocal,
            translations,
            consistentWords,
            namespace: args.namespace,
            afterBatchTranslated: args.afterBatchTranslated,
        });

        console.log(
            chalk.green(
                `Finished translate ${Object.keys(translations).length} items from ${args.originalLocal} to ${targetLocal} for namespace ${args.namespace}`,
            ),
        );

        return result;
    }

    private validateTranslation(
        original: string,
        translation: string,
    ): boolean {
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

    private textToJson(result: string): PromptBatch {
        const json = JSON.parse(result);
        const { isValid, message } = this.validateJson(json);

        if (!isValid) {
            throw new Error(message);
        }

        return this.transformParsedJson(json);
    }

    private validateJson(json: any): { isValid: boolean; message?: string } {
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
