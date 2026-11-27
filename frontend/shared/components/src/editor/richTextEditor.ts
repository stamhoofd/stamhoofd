import { RichText } from '@stamhoofd/structures';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import StarterKit from '@tiptap/starter-kit';
import type { JSONContent } from '@tiptap/vue-3';
import { Editor } from '@tiptap/vue-3';

import { WarningBox } from './EditorWarningBox';

export interface RichTextEditorOptions {
    headingStartLevel?: number;
    placeholder?: string;
}

export function buildRichTextExtensions({ headingStartLevel = 2, placeholder = '' }: RichTextEditorOptions = {}) {
    return [
        StarterKit.configure({
            heading: {
                levels: [headingStartLevel as any, headingStartLevel + 1 as any],
            },
            link: {
                openOnClick: false,
                protocols: ['mailto'],
            },
        }),
        Placeholder.configure({
            placeholder,
        }),
        WarningBox.configure({}),
        Typography.configure({}),
    ];
}

/**
 * Derives the html and text of a TipTap document, so a document that was not typed in an editor
 * (e.g. an automatic translation) becomes a complete RichText.
 */
export function richTextFromJSON(json: JSONContent, options: RichTextEditorOptions = {}): RichText {
    const editor = new Editor({
        content: json,
        extensions: buildRichTextExtensions(options),
    });

    try {
        return RichText.create({ html: editor.getHTML(), text: editor.getText(), json: editor.getJSON() });
    } finally {
        editor.destroy();
    }
}
