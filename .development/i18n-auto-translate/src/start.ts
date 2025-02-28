import { MissingTranslationFinder } from "./MissingTranslationFinder";
import { TranslationManager } from "./TranslationManager";
import { Translator } from "./translators/Translator";

/**
 * TODO:
 * - check changes (use cache files?)
 * - improve prompt (send array?)
 * - check if arguments in text are preserved in output, add to prompt also
 * - ask to use consistent wording, provide context?
 * - context caching?
 */

export async function start() {
    const manager = new TranslationManager();
    const finder = new MissingTranslationFinder({translationManager: manager});
    const translator = new Translator();

    const output = await finder.findAll();

    for(const translationRef of output.allTranslationRefs) {
        const text = translationRef.text;
        const originalLocal = manager.defaultLocale;
        const targetLocal = translationRef.language;
        const translation = await translator.translate({text, originalLocal, targetLocal});
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
