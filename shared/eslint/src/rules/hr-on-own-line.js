// Elements where whitespace is significant, so inserting a newline would change the output.
const whitespaceSensitiveElements = new Set(['pre', 'textarea']);

function isInsideWhitespaceSensitiveElement(element) {
    let parent = element.parent;
    while (parent && parent.type === 'VElement') {
        if (whitespaceSensitiveElements.has(parent.rawName.toLowerCase())) {
            return true;
        }
        parent = parent.parent;
    }
    return false;
}

export default {
    meta: {
        type: 'layout',
        docs: {
            description: 'Require <hr> elements in Vue templates to be on their own line.',
        },
        fixable: 'whitespace',
        schema: [],
        messages: {
            ownLine: '<hr> should be on its own line.',
        },
    },
    create(context) {
        const sourceCode = context.sourceCode;
        const parserServices = sourceCode.parserServices;

        if (!parserServices?.defineTemplateBodyVisitor) {
            return {};
        }

        const text = sourceCode.text;

        return parserServices.defineTemplateBodyVisitor({
            'VElement[name="hr"]'(element) {
                if (isInsideWhitespaceSensitiveElement(element)) {
                    return;
                }

                const [start, end] = element.range;
                const lineStart = text.lastIndexOf('\n', start - 1) + 1;
                const lineEndIndex = text.indexOf('\n', end);
                const lineEnd = lineEndIndex === -1 ? text.length : lineEndIndex;

                const before = text.slice(lineStart, start);
                const after = text.slice(end, lineEnd);
                const contentBefore = before.trim() !== '';
                const contentAfter = after.trim() !== '';

                if (!contentBefore && !contentAfter) {
                    return;
                }

                const indent = /^[ \t]*/.exec(before)[0];

                context.report({
                    node: element.startTag,
                    messageId: 'ownLine',
                    fix(fixer) {
                        const fixes = [];
                        if (contentBefore) {
                            const whitespaceBefore = /[ \t]*$/.exec(before)[0].length;
                            fixes.push(fixer.replaceTextRange([start - whitespaceBefore, start], '\n' + indent));
                        }
                        if (contentAfter) {
                            const whitespaceAfter = /^[ \t]*/.exec(after)[0].length;
                            fixes.push(fixer.replaceTextRange([end, end + whitespaceAfter], '\n' + indent));
                        }
                        return fixes;
                    },
                });
            },
        });
    },
};
