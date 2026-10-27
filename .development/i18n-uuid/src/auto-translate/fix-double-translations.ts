import chalk from 'chalk';
import { globals } from '../shared/globals.js';
import type { TranslationDictionary } from '../types/TranslationDictionary.js';
import { TranslationManager } from './TranslationManager.js';

// should not be necessary
export function fixDoubleTranslations() {
    console.log(chalk.blue('start fix double translations'));
    const manager = new TranslationManager();

    manager.iterateNonDefaultLocalesWithNamespace((locale, namespace) => {
        if (namespace !== globals.DEFAULT_NAMESPACE) {
            const defaultNamespaceDict = manager.readMachineTranslationDictionary(locale, globals.DEFAULT_NAMESPACE);
            const dict = manager.readMachineTranslationDictionary(locale, namespace);
            const filteredDictionary: TranslationDictionary = new Map();

            for (const [key, value] of dict) {
                const defaultValue = defaultNamespaceDict.get(key)?.translation;

                if (defaultValue !== value.translation) {
                    filteredDictionary.set(key, value);
                }
            }

            manager.setMachineTranslationDictionary(filteredDictionary, {
                locale,
                namespace,
            });
        }
    });

    console.log(chalk.blue('done fix double translations'));
}
