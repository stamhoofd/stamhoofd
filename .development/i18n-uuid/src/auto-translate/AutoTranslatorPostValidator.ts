import chalk from "chalk";
import { globals } from "../shared/globals";
import { promptYesNoOrDoubt, YesNoOrDoubt } from "../shared/prompt-helper";
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

    async loopAndPromptValidateInvalidTranslations({dryRun = false}: AutoTranslatorPostValidatorOptions = {}) {
        console.log(chalk.blue('Start loop invalid translations (dryRun: ' + !!dryRun + ')'));

        await this.manager.iterateNonDefaultLocalesWithNamespaceAsync(async (locale, namespace) => {
            const dict = this.manager.readMachineTranslationDictionary(globals.TRANSLATOR, locale, namespace);

            const total = Object.entries(dict).filter(([, value]) => {
                const errorMessage = this.validateDictionaryValue(value);
                return errorMessage !== null;
            }).length + 1;

            if(total > 0) {
                console.log(chalk.blue('Found ' + total + ' errors in auto translations (locale: ' + locale + ', namespace: ' + namespace + ')'));

                console.log(chalk.blue(`
Found ${total} errors in auto translations (locale: ${locale}, namespace: ${namespace})`));

                let current = 0;
                for(const [key, value] of Object.entries(dict)) {
                    const errorMessage = this.validateDictionaryValue(value);
        
                    if(errorMessage !== null) {
                        current = current + 1;
                        console.log(chalk.underline.white(`
ORIGINAL:`));
                        console.log(chalk.red(value.original));

                        console.log(chalk.underline.white(`
TRANSLATION:`));
                        console.log(chalk.green(value.translation));

                        console.log(chalk.gray(`

${current}/${total}`));

                        // prompt
                        const promptResult = await promptYesNoOrDoubt(chalk.yellow(`> Accept (press [y] or [enter])?`));

                        switch(promptResult) {
                            case YesNoOrDoubt.Yes:
                                this.manager.setSourceTranslation({key, value: value.translation, locale, namespace});
                                this.manager.removeFromMachineTranslationDictionary({translator: globals.TRANSLATOR, locale, namespace, key});
                                break;
                            case YesNoOrDoubt.No:
                                this.manager.removeFromMachineTranslationDictionary({translator: globals.TRANSLATOR, locale, namespace, key});
                                break;
                            case YesNoOrDoubt.Doubt:
                                // do nothing
                                break;
                        }
                    }
                }
            }
        })

        console.log(chalk.blue('Done loop invalid translations'));
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
        if(original.length > 0) {
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

export async function loopAndPromptValidateInvalidTranslations(options?: AutoTranslatorPostValidatorOptions) {
    const manager = new TranslationManager();
    const postValidator = new AutoTranslatorPostValidator(manager);
    await postValidator.loopAndPromptValidateInvalidTranslations(options);
}
