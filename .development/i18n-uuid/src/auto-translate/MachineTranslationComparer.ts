import { TranslatorType } from "../enums/TranslatorType";
import { globals } from "../shared/globals";
import { Translations } from "../types/Translations";
import { TranslationManager } from "./TranslationManager";

type MachineTranslationComparisonItem = {
    original: string;
    translations: Record<TranslatorType, string>
};

export type MachineTranslationComparison = Record<
    string,
    MachineTranslationComparisonItem
>;

export class MachineTranslationComparer {
    constructor(private readonly translationManager: TranslationManager) {}

    createComparisons() {
        const defaultLocale = globals.DEFAULT_LOCALE;
        const otherLocales = this.translationManager.locales.filter(
            (locale) => {
                if (this.translationManager.getMappedLocale(locale) === defaultLocale) {
                    return false;
                }

                return true;
            },
        );

        for (const otherLocale of otherLocales) {
            for (const namespace of this.translationManager.namespaces) {
                const comparison: MachineTranslationComparison =
                    Object.fromEntries(
                        Object.entries(
                            this.translationManager.readDist(
                                defaultLocale,
                                namespace,
                            ) as Translations,
                        ).map(([uuid, translation]) => {
                            return [
                                uuid,
                                {
                                    original: translation,
                                    translations: {} as Record<TranslatorType, string>,
                                },
                            ];
                        }),
                    );

                for (const translatorType of Object.values(TranslatorType)) {
                    const translations = this.translationManager.readMachineTranslations(
                        translatorType,
                        otherLocale,
                        namespace,
                    )

                    for (const [uuid, translation] of Object.entries(
                        translations,
                    )) {
                        const item = comparison[uuid];
                        if (item) {
                            item.translations[translatorType] = translation;
                        }
                    }
                }

                this.translationManager.setComparison(comparison, {
                    locale: otherLocale,
                    namespace,
                });
            }
        }
    }
}
