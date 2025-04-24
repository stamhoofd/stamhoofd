import chalk from "chalk";
import { globals } from "../shared/globals";
import { TranslationDictionary } from "../types/TranslationDictionary";
import { TranslationManager } from "./TranslationManager";

export interface AutoTranslatorPostValidatorOptions {
    dryRun?: boolean;
}

// validate translationns after they have been written
export class AutoTranslatorPostValidator {
    constructor(private readonly manager: TranslationManager
    ) {

    }

    filterInvalidTranslations({dryRun = false}: AutoTranslatorPostValidatorOptions = {}) {
        console.log(chalk.blue('Start filter invalid translations (dryRun: ' + !!dryRun + ')'));

        this.manager.iterateNonDefaultLocalesWithNamespace((locale, namespace) => {
            const dict = this.manager.readMachineTranslationDictionary(globals.TRANSLATOR, locale, namespace);
            const {filteredDictionary, errors} = this.filterDictionary(dict);
            if(errors > 0) {
                console.error(chalk.red(`Found ${errors} errors in auto translations (locale: ${locale}, namespace: ${namespace})`));

                if(!dryRun) {
                    this.manager.setMachineTranslationDictionary(filteredDictionary, {
                        translator: globals.TRANSLATOR,
                        locale,
                        namespace,
                    });
                }
            }
        })

        console.log(chalk.blue('Done filter invalid translations'));
    }

    private filterDictionary(dict: TranslationDictionary): {filteredDictionary: TranslationDictionary, errors: number} {
        const filteredDictionary = {};
        let errors = 0;

        for(const [key, value] of Object.entries(dict)) {
            const errorMessage = this.validateDictionaryValue(value);

            if(errorMessage === null) {
                filteredDictionary[key] = value;
            } else {
                errors = errors + 1;
            }
        }

        return {filteredDictionary, errors};
    }

    private validateDictionaryValue<K extends keyof TranslationDictionary>({original, translation}: TranslationDictionary[K]): string | null {
        if(original.length > 9) {
            if(original === translation) {
                return 'Not translated';
            }
        }

        return null;
    }
}

export function filterInvalidAutoTranslations(options?: AutoTranslatorPostValidatorOptions) {
    const manager = new TranslationManager();
    const postValidator = new AutoTranslatorPostValidator(manager);
    postValidator.filterInvalidTranslations(options);
}
