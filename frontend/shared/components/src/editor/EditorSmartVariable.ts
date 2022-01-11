import { mergeAttributes, Node, nodeInputRule } from '@tiptap/core'

export class EditorSmartVariable {
    id: string;
    name: string;
    example: string;
    html?: string;
    deleteMessage?: string


    constructor(options: { id: string, name: string, example?: string, deleteMessage?: string, html?: string }) {
        this.id = options.id;
        this.name = options.name;
        this.example = options.example ?? options.name;
        this.html = options.html;
        this.deleteMessage = options.deleteMessage;
    }
}


export type SmartVariableNodeOptions = {
    HTMLAttributes: Record<string, any>,
    smartVariables: EditorSmartVariable[]
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        smartVariableNode: {
            insertSmartVariable: (smartVariable: EditorSmartVariable) => ReturnType,
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
            insertSmartVariable: (smartVariable: EditorSmartVariable) => ({ commands }) => {
                return commands.insertContent({ type: smartVariable.html ? "smartVariableBlock" : "smartVariable", attrs: { id: smartVariable.id } })
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