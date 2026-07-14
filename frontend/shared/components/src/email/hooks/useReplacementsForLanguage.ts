import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import type { Replacement } from '@stamhoofd/structures';
import type { Language } from '@stamhoofd/types/Language';
import type { Ref } from 'vue';
import { ref, watch } from 'vue';

/**
 * The visible example values of replacements are generated with $t, so by default they appear
 * in the interface language. This hook rebuilds them in the language that is being edited
 * (loading those messages when needed), so the editor shows the example values in the language
 * of the content instead of the language of the interface.
 */
export function useReplacementsForLanguage(options: {
    /**
     * The language the replacements should be generated in. null uses the interface language.
     */
    language: () => Language | null;
    build: () => Replacement[];
}): Ref<Replacement[]> {
    // The initial value is built in the interface language: the watcher below immediately
    // corrects it when another language is being edited (once its messages are loaded)
    const replacements = ref(options.build()) as Ref<Replacement[]>;
    let buildCount = 0;

    watch(() => ({ language: options.language(), base: options.build() }), async ({ language, base }) => {
        buildCount += 1;
        const currentBuild = buildCount;
        const localized = await buildForLanguage(language, options.build, base);
        if (currentBuild === buildCount) {
            // Not replaced by a newer build in the meantime
            replacements.value = localized;
        }
    }, { immediate: true });

    return replacements;
}

async function buildForLanguage(language: Language | null, build: () => Replacement[], base: Replacement[]): Promise<Replacement[]> {
    const controller = I18nController.shared;
    if (language === null || !controller || language === controller.language) {
        return base;
    }

    try {
        const locale = await controller.loadLocaleForLanguage(language);
        return I18nController.getI18n().runWithLocale(locale, build);
    }
    catch (e) {
        // A language without messages: keep the values in the interface language
        console.error('Failed to load locale for language', language, e);
        return base;
    }
}
