import { Node } from '@tiptap/core'

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        descriptiveText: {
            /**
       * Set a heading node
       */
            setDescriptiveText: () => ReturnType,
            /**
       * Toggle a heading node
       */
            toggleDescriptiveText: () => ReturnType,
        }
    }
}

export const DescriptiveText = Node.create({
    name: 'descriptiveText',

    content: 'inline*',

    group: 'block',

    defining: true,

    addCommands() {
        return {
            setDescriptiveText: () => ({ commands }) => {
                return commands.setNode(this.name, {})
            },
            toggleDescriptiveText: () => ({ commands }) => {
                return commands.toggleNode(this.name, 'paragraph', {})
            },
        }
    },

    parseHTML() {
        return [{
            tag: `p`,
            priority: 51, // 50 is default, so check before the normal paragraphs
            getAttrs: node => {
                return (node as any)?.getAttribute('class') === 'description' && null
            },
        }]
    },

    renderHTML() {
        return ['p', { class: "description" }, 0]
    },
})