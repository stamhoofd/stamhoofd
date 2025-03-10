import { globals } from "../shared/globals";
import { Translations } from "../types/Translations";
import { TranslationManager } from "./TranslationManager";

export class TranslationScanner {
    private readonly cache: Map<string, Translations> = new Map();

    constructor(private readonly translationManager: TranslationManager) {}

    private loadTranslations(
        locale: string,
        namespace: string = globals.DEFAULT_NAMESPACE,
    ): Translations {
        const key = `${locale}-${namespace}`;
        if (this.cache.has(key)) {
            return this.cache.get(key)!;
        }
        const translations = this.translationManager.readDist(
            locale,
            namespace,
        );
        this.cache.set(key, translations);
        return translations;
    }

    scanFrequentlyUsedWords(
        locale: string,
        namespace: string = globals.DEFAULT_NAMESPACE,
    ) {
        const translations = this.loadTranslations(locale, namespace);

        const minLength = 5;
        const words: Map<string, number> = new Map();

        for (const [id, text] of Object.entries(translations)) {
            text.split(" ")
                .map((word) =>
                    word
                        .toLowerCase()
                        .replace(
                            /[\!\@\#\$\%\^\&\*\)\(\+\=\.\<\>\{\}\[\]\:\;\'\"\|\~\`\_\-]/g,
                            "",
                        ),
                )
                .filter((word) => word.length > minLength)
                .forEach((word) => {
                    words.set(word, (words.get(word) ?? 0) + 1);
                });
        }

        return Array.from(words.entries())
            .sort((a, b) => b[1] - a[1])
            .filter((a) => a[1] > 4);
    }

    scanConsistentWords(): string {
        return JSON.stringify(
            Object.fromEntries(
                this.scanFrequentlyUsedWords(globals.DEFAULT_LOCALE).map(
                    (word) => [word[0], ""],
                ),
            ),
        );
    }
}
