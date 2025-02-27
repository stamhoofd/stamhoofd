import chalk from "chalk";
import { MissingTranslationFinder } from "./src/MissingTranslationFinder";

const finder = new MissingTranslationFinder(async (text) => `translated: ${text}`);

finder.findAll().then(searchResults => {
    searchResults.forEach(searchResult => {
        console.log(chalk.blue(searchResult.locale));
        console.log(chalk.blue(searchResult.namespace));
        console.log('----')

        if(searchResult.locale === 'en') {
            console.log(chalk.red(searchResult.translationRefs.length));
            console.log(chalk.green(Object.keys(searchResult.existingTranslationsToAdd).length));

            if(searchResult.namespace === 'keeo') {
                console.log(searchResult.translationRefs.map(x => x.text));
            }
        }
        // console.log(searchResult.existingTranslationsToAdd);
        // console.log(searchResult.toTranslate);
    })
})
