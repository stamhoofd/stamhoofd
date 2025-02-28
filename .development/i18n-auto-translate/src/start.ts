import { MissingTranslationFinder, TextToTranslateRef } from "./MissingTranslationFinder";
import { TranslationManager } from "./TranslationManager";
import { GoogleTranslator } from "./translators/GoogleTranslator";
import { ITranslator } from "./translators/ITranslator";

/**
 * TODO:
 * - check changes (use cache files?)
 * - improve prompt
 * - ask to use consistent wording, provide context?
 * - context caching?
 * - add feedback while translating (if it takes a long time for example)
 */

export async function start() {
    const manager = new TranslationManager();
    const finder = new MissingTranslationFinder({translationManager: manager});
    const translator = new GoogleTranslator();

    const output = await finder.findAll();

    await translateAll({
        translator,
        allTranslationRefs: Array.from(output.allTranslationRefs),
        originalLocal: manager.defaultLocale
    });

    for(const searchResult of output.searchResults) {
        const allTranslationsToAdd = searchResult.existingTranslationsToAdd;

        for(const translationRef of searchResult.translationRefs) {
            if(translationRef.isTranslated) {
                allTranslationsToAdd[translationRef.id] = translationRef.translation;
            }
        }

        manager.addTranslations(allTranslationsToAdd, {locale: searchResult.locale, namespace: searchResult.namespace});
    }

    // log failed translations
    Array.from(output.allTranslationRefs)
    .filter(x => x.didTry && !x.isTranslated)
    .forEach(translationRef => {
        console.error(`Failed to translate ${translationRef.id} in ${translationRef.language}: ${translationRef.text}`);
    });
}

 function groupByLanguage(allTranslationRefs: TextToTranslateRef[]): Map<string, TextToTranslateRef[]> {
    const map = new Map<string, TextToTranslateRef[]>();

    for(const translationRef of allTranslationRefs) {
        const language = translationRef.language;

        let array = map.get(language);
        if(!array) {
            array = [];
            map.set(language, array);
        }

        array.push(translationRef);
    }

    return map;
}

async function translateBatch({translator, allTranslationRefs, originalLocal, targetLocal}: {translator: ITranslator, allTranslationRefs: TextToTranslateRef[], originalLocal: string, targetLocal: string}) {
    const tempTranslationObject = {};

    for(const translationRef of allTranslationRefs) {
        const text = translationRef.text;
        const id = translationRef.id;
        tempTranslationObject[id] = text;
    }

    const translations = await translator.translateAll(tempTranslationObject, {originalLocal, targetLocal});

    for(const translationRef of allTranslationRefs) {
        const id = translationRef.id;
        const translation = translations[id];
        if(translation) {
            translationRef.setTranslation(translation);
        }
        translationRef.markDidTry();
    }
}

async function translateAll({translator, allTranslationRefs, originalLocal}: {translator: ITranslator, allTranslationRefs: TextToTranslateRef[], originalLocal: string}) {
    const map =  groupByLanguage(allTranslationRefs);

    for(const [language, group] of map.entries()) {
        await translateBatch({translator, allTranslationRefs: group, originalLocal, targetLocal: language});
    }   
}
