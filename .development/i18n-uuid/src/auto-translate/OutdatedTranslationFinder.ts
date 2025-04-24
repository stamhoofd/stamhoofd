import chalk from "chalk";
import { TranslatorType } from "../enums/TranslatorType";
import { globals } from "../shared/globals";
import { TranslationManager } from "./TranslationManager";

export class OutdatedTranslationFinder {
    private readonly translationManager: TranslationManager;

    constructor(options: { translationManager: TranslationManager }) {
        this.translationManager = options.translationManager;
    }

    removeOutdatedTranslations(translator: TranslatorType, locales?: string[]) {
        console.log(
            chalk.blue(
                `Start clear changed translations (locales: ${locales ? locales?.join(" ") : "all locales"}, translator: ${translator}).`,
            ),
        );

        // todo: maybe use iterateNonDefaultLocalesWithNamespace

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

        const namespaces = this.translationManager.namespaces;

        let foundChanges = false;

        // compare dist build of default locale with dist build of other locales
        for (const namespace of namespaces) {
            const defaultTranslations = this.translationManager.readDist(
                globals.DEFAULT_LOCALE,
                namespace,
            );

            for (const locale of otherLocales) {
                if (
                    this.translationManager.getMappedLocale(locale) ===
                    globals.DEFAULT_LOCALE
                ) {
                    continue;
                }

                const machineTranslationDictionary =
                    this.translationManager.readMachineTranslationDictionary(
                        translator,
                        locale,
                        namespace,
                    );

                // only keep translations that are not changed
                const filteredDictionary = Object.fromEntries(
                    Object.entries(machineTranslationDictionary).filter(
                        ([key, { original }]) => defaultTranslations[key] === original,
                    ),
                );

                const difference =
                    Object.keys(machineTranslationDictionary).length -
                    Object.keys(filteredDictionary).length;

                if (difference > 0) {
                    foundChanges = true;
                    console.log(
                        chalk.yellow(
                            `Clear ${difference} changed translations (locale: ${locale}, namespace: ${namespace}, translator: ${translator}).`,
                        ),
                    );
                    this.translationManager.setMachineTranslationDictionary(
                        filteredDictionary,
                        {
                            translator,
                            locale,
                            namespace,
                        },
                    );
                }
            }
        }

        if (!foundChanges) {
            console.log(chalk.green("No changed translations found."));
        }
    }
}
