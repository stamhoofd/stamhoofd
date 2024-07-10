import { EditorSmartVariable } from '@stamhoofd/structures'
import { mergeAttributes, Node, nodeInputRule } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'


export type SmartVariableNodeOptions = {
    HTMLAttributes: Record<string, any>,
    smartVariables: EditorSmartVariable[]
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        smartVariableNode: {
            insertSmartVariable: (smartVariable: EditorSmartVariable, options?: { updateSelection?: boolean }) => ReturnType,
        }
    }
}

export const SmartVariableNode = Node.create<SmartVariableNodeOptions>({
    name: 'smartVariable',

    addOptions() {
        return {
            HTMLAttributes: {},
            smartVariables: []
        }
    }, 

    group: 'inline',

    selectable: true,
    draggable: true,
    inline: true,
    atom: true,

    addCommands() {
        return {
            insertSmartVariable: (smartVariable: EditorSmartVariable, options?: { updateSelection?: boolean }) => ({ chain, commands }) => {
                if (smartVariable.html && (options?.updateSelection === undefined || options?.updateSelection)) {
                    return chain()
                        .insertContent(smartVariable.getJSONContent(), options)
                        // set cursor after horizontal rule
                        .command(({ tr, dispatch }) => {
                            if (dispatch) {
                                const { $to } = tr.selection
                                const posAfter = $to.end()

                                if ($to.nodeAfter) {
                                    tr.setSelection(TextSelection.create(tr.doc, $to.pos))
                                } else {
                                // add node after horizontal rule if it’s the end of the document
                                    const node = $to.parent.type.contentMatch.defaultType?.create()

                                    if (node) {
                                        tr.insert(posAfter, node)
                                        tr.setSelection(TextSelection.create(tr.doc, posAfter))
                                    }
                                }

                                tr.scrollIntoView()
                            }

                            return true
                        })
                        .run()
                }
                return commands.insertContent(smartVariable.getJSONContent(), options)
            },
        }
    },

    addInputRules() {
        return this.options.smartVariables.map(s => {
            return nodeInputRule({
                find: new RegExp(`\\{\\{${s.id}\\}\\}$`),
                type: this.type,
                getAttributes: () => { return { id: s.id } }
            })
        })
    },

    addAttributes() {
        return {
            id: {
                default: null,
                parseHTML: element => element.getAttribute('data-id'),
                renderHTML: attributes => {
                    if (!attributes.id) {
                        return {}
                    }

                    return {
                        'data-id': attributes.id,
                    }
                },
            },
        }
    },

    parseHTML() {
        return this.options.smartVariables.filter(v => v.html === undefined).map(variable => {
            return {
                tag: `span[data-type="${this.name}"][data-id="${variable.id}"]`,
            };
        })
    },

    renderHTML({ node, HTMLAttributes }) {
        const smartVariable = this.options.smartVariables.find(s => s.id === node.attrs.id)
        if (!smartVariable || !smartVariable.html) {
            return [
                'span',
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                mergeAttributes({ 'data-type': this.name }, this.options.HTMLAttributes, HTMLAttributes),
                smartVariable?.example ?? "", // Empty string won't get rendered but kept for reference in case the smart variable is found again later
            ]
        }
        const dom = document.createElement('div')
        dom.setAttribute('data-type', this.name)
        dom.innerHTML = smartVariable.html
        return { dom }
    },

    renderText({ node }) {
        return "{{"+node.attrs.id+"}}"
    },
})

export const SmartVariableNodeBlock = SmartVariableNode.extend({
    name: 'smartVariableBlock',
    inline: false,
    group: "block",

    parseHTML() {
        return this.options.smartVariables.filter(v => v.html !== undefined).map(variable => {
            return {
                tag: `div[data-type="${this.name}"][data-id="${variable.id}"]`,
            }
        })
    },

    renderHTML({ node }) {
        const smartVariable = this.options.smartVariables.find(s => s.id === node.attrs.id)
        const dom = document.createElement('div')
        dom.setAttribute('data-type', this.name)
        dom.setAttribute('data-id', (node.attrs.id ?? "") + "")
        dom.innerHTML = smartVariable?.html ?? ""
        return { dom }
    },
})
