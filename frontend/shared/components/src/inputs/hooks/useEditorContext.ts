import { languages } from '@stamhoofd/locales';
import { Language, TranslatedString } from '@stamhoofd/structures';
import { inject, onBeforeUnmount, provide, reactive, Ref, watch } from 'vue';

export class TranslateableComponent {
    latestValue: TranslatedString | null = null;
}

export class EditorContext {
    translateableComponents: Set<TranslateableComponent> = new Set();

    get enabled() {
        return this.translateableComponents.size > 0;
    }

    hasLanguage(language: Language) {
        for (const component of this.translateableComponents) {
            if (component.latestValue && component.latestValue.getIfExists(language)) {
                return true;
            }
        }
        return false;
    }

    isComplete(language: Language) {
        const count = this.getLanguageCount(language);
        const max = this.getMaximumLanguageCount();

        return count === max;
    }

    getLanguageCount(language: Language) {
        let c = 0;
        for (const component of this.translateableComponents) {
            if (component.latestValue && component.latestValue.getIfExists(language)) {
                c += 1;
            }
        }
        return c;
    }

    getMaximumLanguageCount() {
        let max = 0;
        for (const language of languages) {
            const count = this.getLanguageCount(language);
            if (count > max) {
                max = count;
            }
        }
        return max;
    }
}

export function useEditorContext() {
    const editorContext = inject('editor-context') as EditorContext;

    if (!editorContext) {
        throw new Error('Editor context not provided');
    }

    return editorContext;
}

export function registerTranslateableComponent(ref: Readonly<Ref<TranslatedString>>) {
    const editorContext = useEditorContext();
    const instance = reactive(new TranslateableComponent());

    if (!editorContext) {
        throw new Error('Editor context not provided');
    }
    editorContext.translateableComponents.add(instance);

    const cleanup = watch(ref, (newValue) => {
        instance.latestValue = newValue;
    }, {
        immediate: true,
    });

    onBeforeUnmount(() => {
        editorContext.translateableComponents.delete(instance);
        cleanup();
    });

    return instance;
}

export function defineEditorContext() {
    provide('editor-context', reactive(new EditorContext()));
}
