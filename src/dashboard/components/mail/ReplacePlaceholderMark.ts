import { Node } from "tiptap";
import { replaceText } from "tiptap-commands";

export default class ReplacePlaceholderMark extends Node {
    get name() {
        return "replace-placeholder";
    }

    get defaultOptions() {
        return {
            matcher: {
                char: "@",
                allowSpaces: false,
                startOfLine: false,
            },
            mentionClass: "mention",
            suggestionClass: "mention-suggestion",
        };
    }

    labelNameForNode(node) {
        if (node.attrs.type == "firstName") {
            return "Voornaam";
        }
        return "Onbekend";
    }

    get schema() {
        return {
            attrs: {
                type: { default: "firstName" },
            },
            group: "inline",
            inline: true,
            selectable: false,
            draggable: true,
            atom: true,
            toDOM: (node) => [
                "span",
                {
                    class: "replace-placeholder",
                    "data-replace-type": node.attrs.type,
                },
                this.labelNameForNode(node),
            ],
            parseDOM: [
                {
                    tag: "span[data-replace-type]",
                    getAttrs: (dom) => {
                        const type = dom.getAttribute("data-replace-type");
                        return { type };
                    },
                },
            ],
        };
    }

    commands({ schema }) {
        return (attrs) => replaceText(null, schema.nodes[this.name], attrs);
    }
}
