import { Language } from '@stamhoofd/structures';
import { ref, Ref } from 'vue';

let editorLanguageRef: Ref<Language> | null = null;

export function useEditorLanguage() {
    if (!editorLanguageRef) {
        editorLanguageRef = ref<Language>($getLanguage());
    }

    return editorLanguageRef;
}
