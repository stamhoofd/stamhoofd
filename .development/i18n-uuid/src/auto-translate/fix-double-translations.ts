import chalk from "chalk";
import { globals } from "../shared/globals";
import { TranslationManager } from "./TranslationManager";

// should not be necessary
export function fixDoubleTranslations() {
    console.log(chalk.blue('start fix double translations'));
    const manager = new TranslationManager();
    
    manager.iterateNonDefaultLocalesWithNamespace((locale, namespace) => {
        if(namespace !== globals.DEFAULT_NAMESPACE) {
            const defaultNamespaceDict = manager.readMachineTranslationDictionary(globals.TRANSLATOR, locale, globals.DEFAULT_NAMESPACE);
            const dict = manager.readMachineTranslationDictionary(globals.TRANSLATOR, locale, namespace);
            const filteredDictionary = {};
    
            for(const [key, value] of Object.entries(dict)) {
                const defaultValue = defaultNamespaceDict[key]?.translation;
    
                if(defaultValue !==  value.translation) {
                    filteredDictionary[key] = value;
                }
            }
    
            manager.setMachineTranslationDictionary(filteredDictionary, {
                translator: globals.TRANSLATOR,
                locale,
                namespace,
            })  
        }
    });

    console.log(chalk.blue('done fix double translations'));
}
