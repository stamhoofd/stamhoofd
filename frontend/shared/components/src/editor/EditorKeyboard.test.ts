import StarterKit from '@tiptap/starter-kit';
import { Editor } from '@tiptap/vue-3';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

// Enter builds new nodes with code from several prosemirror packages. When the lockfile resolves more than one
// prosemirror-model version, this throws "Can not convert <> to a Fragment (looks like multiple versions of
// prosemirror-model were loaded)".
describe('Editor keyboard input', () => {
    let editor: Editor | null = null;
    let element: HTMLElement | null = null;

    afterEach(() => {
        editor?.destroy();
        element?.remove();
        editor = null;
        element = null;
    });

    async function createEditor(content: string, cursor: 'end' | number = 'end') {
        element = document.createElement('div');
        document.body.appendChild(element);
        const created = new Editor({ element, extensions: [StarterKit], content });
        editor = created;

        // The focus command only focuses the view in the next animation frame
        created.commands.focus(cursor);
        await vi.waitFor(() => expect(created.view.hasFocus()).toBe(true));
        return created;
    }

    test('Enter splits a paragraph', async () => {
        const editor = await createEditor('<p>Eerste regel</p>');

        await userEvent.keyboard('{Enter}Tweede regel');

        expect(editor.getHTML()).toBe('<p>Eerste regel</p><p>Tweede regel</p>');
    });

    test('Enter adds a list item', async () => {
        // Position 9 is the end of "Eerste": the trailing node extension adds an empty paragraph after the list
        const editor = await createEditor('<ul><li><p>Eerste</p></li></ul>', 9);

        await userEvent.keyboard('{Enter}Tweede');

        expect(editor.getHTML()).toBe('<ul><li><p>Eerste</p></li><li><p>Tweede</p></li></ul><p></p>');
    });
});
