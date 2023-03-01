import { Node } from '@tiptap/core'

type BoxType = 'info' | 'warning'
declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        warningBox: {
            /**
       * Set a heading node
       */
            setBox: (BoxType) => ReturnType,
            /**
       * Toggle a heading node
       */
            toggleBox: (BoxType) => ReturnType,
        }
    }
}

export const WarningBox = Node.create({
    name: 'warningBox',

    content: 'inline*',

    group: 'block',

    defining: true,

    addAttributes() {
        return {
            type: {
                default: 'warning',
                rendered: false,
            },
        }
    },

    addCommands() {
        return {
            setBox: (type: BoxType) => ({ commands }) => {
                return commands.setNode(this.name, {type})
            },
            toggleBox: (type: BoxType) => ({ commands }) => {
                return commands.toggleNode(this.name, 'paragraph', {type})
            },
        }
    },

    parseHTML() {
        return [
            {
                tag: `p`,
                getAttrs: node => {
                    if ((node as any)?.getAttribute('class') === 'warning-box') {
                        return {type: 'warning'}
                    }
                    return false;
                },
                priority: 51, // 50 is default, so check before the normal paragraphs
            },
            {
                tag: `p`,
                getAttrs: node => {
                    if ((node as any)?.getAttribute('class') === 'info-box') {
                        return {type: 'info'}
                    }
                    return false;
                },
                priority: 51, // 50 is default, so check before the normal paragraphs
            }
        ]
    },

    renderHTML({ node }) {
        return ['p', { class: node.attrs.type + '-box' }, 0]
    },
})