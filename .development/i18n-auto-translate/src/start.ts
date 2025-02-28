import { MissingTranslationFinder } from "./MissingTranslationFinder";
import { TranslationManager } from "./TranslationManager";
import { Translator } from "./Translator";

export async function start() {
    const manager = new TranslationManager();
    const finder = new MissingTranslationFinder({translationManager: manager});
    const translator = new Translator();

    const output = await finder.findAll();

    for(const translationRef of output.allTranslationRefs) {
        const translation = await translator.translate(translationRef.text);
        translationRef.setTranslation(translation);
    }

    for(const searchResult of output.searchResults) {
        const allTranslationsToAdd = searchResult.existingTranslationsToAdd;

        for(const translationRef of searchResult.translationRefs) {
            if(translationRef.isTranslated) {
                allTranslationsToAdd[translationRef.id] = translationRef.translation;
            }
        }

        manager.addTranslations(allTranslationsToAdd, {locale: searchResult.locale, namespace: searchResult.namespace});
    }
}
