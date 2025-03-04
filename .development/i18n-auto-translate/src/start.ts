import { MissingTranslationFinder, TextToTranslateRef } from "./MissingTranslationFinder";
import { TranslationManager } from "./TranslationManager";
import { GoogleTranslator } from "./translators/GoogleTranslator";
import { ITranslator } from "./translators/ITranslator";

/**
 * TODO:
 * - fix uuid overwriting of consistent-words
 * - improve prompt
 * - provide context?
 * - context caching?
 * - add feedback while translating (if it takes a long time for example)
 * - keep log of prompts and results?
 */

export async function start() {
    const manager = new TranslationManager();
    await manager.buildTranslations();
    const finder = new MissingTranslationFinder({translationManager: manager});
    const translator = new GoogleTranslator(manager);

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

        manager.addMachineTranslations(allTranslationsToAdd, {locale: searchResult.locale, namespace: searchResult.namespace});
    }

    // log failed translations
    Array.from(output.allTranslationRefs)
    .filter(x => x.didTry && !x.isTranslated)
    .forEach(translationRef => {
        console.error(`Failed to translate ${translationRef.id} in ${translationRef.language}: ${translationRef.text}`);
    });
}

 function groupByLanguageAndNamespace(allTranslationRefs: TextToTranslateRef[]): Map<string, Map<string, TextToTranslateRef[]>> {
    const map = new Map<string, Map<string, TextToTranslateRef[]>>();

    for(const translationRef of allTranslationRefs) {
        const language = translationRef.language;
        const namespace = translationRef.namespace;

        let languageMap = map.get(language);
        if(!languageMap) {
            languageMap = new Map();
            map.set(language, languageMap);
        }

        let array = languageMap.get(namespace);
        if(!array) {
            array = [];
            languageMap.set(namespace, array);
        }

        array.push(translationRef);
    }

    return map;
}

async function translateBatch({translator, allTranslationRefs, originalLocal, targetLocal, namespace}: {translator: ITranslator, allTranslationRefs: TextToTranslateRef[], originalLocal: string, targetLocal: string, namespace: string}) {
    const tempTranslationObject = {};

    for(const translationRef of allTranslationRefs) {
        const text = translationRef.text;
        const id = translationRef.id;
        tempTranslationObject[id] = text;
    }

    const translations = await translator.translateAll(tempTranslationObject, {originalLocal, targetLocal, namespace});

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
    const map =  groupByLanguageAndNamespace(allTranslationRefs);

    const promises: Promise<void>[] = [];

    for(const [language, languageMap] of map.entries()) {
        for(const [namespace, group] of languageMap.entries()) {
            const promise = translateBatch({translator, allTranslationRefs: group, originalLocal, targetLocal: language, namespace});
            promises.push(promise)
        }
    }
    
    await Promise.all(promises);
}
