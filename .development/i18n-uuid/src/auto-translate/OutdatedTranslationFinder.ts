import chalk from 'chalk';
import type { TranslatorType } from '../enums/TranslatorType.js';
import { globals } from '../shared/globals.js';
import type { TranslationManager } from './TranslationManager.js';

export class OutdatedTranslationFinder {
    private readonly translationManager: TranslationManager;

    constructor(options: { translationManager: TranslationManager }) {
        this.translationManager = options.translationManager;
    }

    removeOutdatedTranslations(translator: TranslatorType, locales?: string[]) {
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

        // compare dist build of default locale with dist build of other locales
        for (const namespace of namespaces) {
            const defaultTranslations = this.translationManager.readDist(
                globals.DEFAULT_LOCALE,
                namespace,
            );

            for (const locale of otherLocales) {
                if (
                    this.translationManager.getMappedLocale(locale)
                    === globals.DEFAULT_LOCALE
                ) {
                    continue;
                }

                const machineTranslationDictionary
                    = this.translationManager.readMachineTranslationDictionary(
                        locale,
                        namespace,
                    );

                // only keep translations that are not changed
                const filteredDictionary = Object.fromEntries(
                    Object.entries(machineTranslationDictionary).filter(
                        ([key, { original }]) => defaultTranslations[key] === original,
                    ),
                );

                const difference
                    = Object.keys(machineTranslationDictionary).length
                        - Object.keys(filteredDictionary).length;

                if (difference > 0) {
                    console.log(
                        chalk.yellow(
                            `Clear ${difference} changed translations (locale: ${locale}, namespace: ${namespace}, translator: ${translator}).`,
                        ),
                    );
                    this.translationManager.setMachineTranslationDictionary(
                        filteredDictionary,
                        {
                            locale,
                            namespace,
                        },
                    );
                }
            }
        }

    }
}
