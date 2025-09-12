import { mergeAttributes, Node } from '@tiptap/core';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        emailBlock: {
            toggleEmailBlock: () => ReturnType;
        };
    }
}

export const EmailBlock = Node.create({
    name: 'emailBlock',

    content: 'block+',

    group: 'block',

    defining: true,
    selectable: true,
    draggable: true,
    isolating: false,

    addCommands() {
        return {
            toggleEmailBlock: () => ({ commands }) => {
                return commands.toggleWrap(this.name, {});
            },
        };
    },

    /* parseHTML() {
        return [{
            tag: `div`,
            priority: 51, // 50 is default, so check before the normal paragraphs
            getAttrs: (node) => {
                return (node as any)?.getAttribute('class') === 'description' && null;
            },
        }];
    }, */

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { class: 'email-only' }), 0];
    },

    addNodeView() {
        return () => {
        // Markup
        /*
            <div class="node-view">
            <span class="label">Node view</span>

            <div class="content"></div>
            </div>
        */

            const dom = document.createElement('div');
            dom.classList.add('email-only');

            const label = document.createElement('span');
            label.classList.add('label');

            const labelChild1 = document.createElement('span');
            labelChild1.classList.add('icon');
            labelChild1.classList.add('email');
            labelChild1.classList.add('small');
            label.appendChild(labelChild1);

            const labelChild2 = document.createElement('span');
            labelChild2.innerText = $t('Enkel zichtbaar in e-mails');
            label.appendChild(labelChild2);

            label.contentEditable = 'false';

            const content = document.createElement('div');

            content.classList.add('content');
            content.classList.add('is-editable');

            dom.append(label, content);

            return {
                dom,
                contentDOM: content,
            };
        };
    },
});
