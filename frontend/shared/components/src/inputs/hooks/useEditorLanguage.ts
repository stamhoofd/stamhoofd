import { useEditorContext } from './useEditorContext';

export function useEditorLanguage() {
    const editorContext = useEditorContext();

    return editorContext._editorLanguageRef.ref;
}
