import chalk from "chalk";
import { cliArguments, CliArguments } from "../CliArguments";
import { validateTranslations } from "../helpers/validate-translations";
import { promptLogger } from "../PromptLogger";
import { TranslationManager } from "../TranslationManager";
import { Translations } from "../types/Translations";
import { ITranslator } from "./ITranslator";

export abstract class Translator implements ITranslator {
    // Max amount of characters in a batch
    protected abstract readonly maxBatchLength: number;

    constructor(
        protected readonly manager: TranslationManager,
        protected readonly cliArgs: CliArguments = cliArguments,
    ) {}

    protected abstract generateResponse(prompt: string): Promise<string>;

    private fakeGenerateResponse(
        textArray: string[],
        {
            originalLocal,
            targetLocal,
            namespace,
        }: { originalLocal: string; targetLocal: string; namespace: string },
    ): Promise<string> {
        const infoText = `Fake translated from ${originalLocal} to ${targetLocal} for namespace ${namespace}: `;
        return Promise.resolve(
            JSON.stringify(textArray.map((text) => infoText + text)),
        );
    }

    protected abstract createPrompt(
        textArray: string[],
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
    ): string;

    protected async getTextFromApi(
        textArray: string[],
        args: {
            originalLocal: string;
            targetLocal: string;
            consistentWords: Record<string, string> | null;
            namespace: string;
            batchNumber: number;
            totalBatches: number;
        },
    ): Promise<string> {
        const prompt = this.createPrompt(textArray, args);

        const logResult = promptLogger.prompt(prompt, args);

        const text = this.cliArgs.fake
            ? await this.fakeGenerateResponse(textArray, args)
            : await this.generateResponse(prompt);

        logResult(text);

        return text;
    }

    private splitTranslationInBatches(translations: Translations): string[][] {
        const batches: string[][] = [];

        let currentLength = 0;
        let currentIndex = 0;

        for (const [id, text] of Object.entries(translations)) {
            if (currentLength > this.maxBatchLength) {
                currentIndex = currentIndex + 1;
                currentLength = 0;
            }

            let array = batches[currentIndex];
            if (!array) {
                array = [];
                batches[currentIndex] = array;
            }

            array.push(text);
            currentLength += text.length;
        }

        return batches;
    }

    protected async translateBatch(
        batch: string[],
        args: {
            originalLocal: string;
            targetLocal: string;
            consistentWords: Record<string, string> | null;
            namespace: string;
            batchNumber: number;
            totalBatches: number;
        },
    ): Promise<string[]> {
        const text = await this.getTextFromApi(batch, args);
        const json = this.textToJson(text);

        if (json.length !== batch.length) {
            throw new Error("Json length does not match batch length.");
        }

        return json;
    }

    private async translateBatches(
        batches: string[][],
        {
            originalLocal,
            targetLocal,
            translations,
            consistentWords,
            namespace,
        }: {
            originalLocal: string;
            targetLocal: string;
            translations: Translations;
            consistentWords: Record<string, string> | null;
            namespace: string;
        },
    ): Promise<Translations> {
        const result: Translations = {};
        const translationEntries = Object.entries(translations);

        const promises: Promise<(string | null)[]>[] = batches.map(
            async (batch, i) => {
                const batchNumber = i + 1;
                const totalBatches = batches.length;

                try {
                    console.log(
                        chalk.gray(
                            `Start translating batch ${batchNumber} of ${totalBatches}`,
                        ),
                    );
                    const result = await this.translateBatch(batch, {
                        originalLocal,
                        targetLocal,
                        consistentWords,
                        namespace,
                        batchNumber,
                        totalBatches,
                    });
                    console.log(
                        chalk.gray(
                            `Finished translating batch ${batchNumber} of ${totalBatches}`,
                        ),
                    );
                    return result;
                } catch (error) {
                    const errorMessage = `Failed translating batch ${batchNumber} of ${totalBatches} (from ${originalLocal} to ${targetLocal}, namespace: ${namespace}): ${error.message}`;
                    console.error(errorMessage);
                    promptLogger.error(errorMessage);
                    return batch.map(() => null);
                }
            },
        );

        const translatedText = await Promise.all(promises);

        translatedText
            .flatMap((x) => x)
            .forEach((translation, i) => {
                if (translation === null) {
                    return;
                }

                const [id, text] = translationEntries[i];
                const isTranslationValid = this.validateTranslation(
                    text,
                    translation,
                );

                if (isTranslationValid) {
                    result[id] = translation;
                }
            });

        return result;
    }

    async translateAll(
        translations: Translations,
        args: { originalLocal: string; targetLocal: string; namespace: string },
    ): Promise<Translations> {
        const targetLocal =
            args.targetLocal === "es" ? "es-CO" : args.targetLocal;
        console.log(
            chalk.white(
                `Start translate ${Object.keys(translations).length} items from ${args.originalLocal} to ${targetLocal} for namespace ${args.namespace}`,
            ),
        );
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

        const orginalMap = this.createArgumentOccurrencMap(originalArguments);
        const translationMap =
            this.createArgumentOccurrencMap(translationArguments);

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

    private createArgumentOccurrencMap(array: string[]): Map<string, number> {
        const map = new Map<string, number>();

        array.forEach((item) => {
            const count = map.get(item) ?? 0;
            map.set(item, count + 1);
        });

        return map;
    }

    private textToJson(result: string): string[] {
        const json = JSON.parse(result);
        const { isValid, message } = this.validateJson(json);

        if (!isValid) {
            throw new Error(message);
        }

        return json;
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

        if (json.some((item) => typeof item !== "string")) {
            return {
                isValid: false,
                message: "Json is not an array of strings.",
            };
        }

        return {
            isValid: true,
        };
    }
}
