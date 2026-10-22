// Whitespace is significant inside <pre>, so inserting a newline would change the output.
function isInsidePre(element) {
    let parent = element.parent;
    while (parent && parent.type === 'VElement') {
        if (parent.name === 'pre') {
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
        const newline = text.includes('\r\n') ? '\r\n' : '\n';

        return parserServices.defineTemplateBodyVisitor({
            'VElement[name="hr"]'(element) {
                // The parser lowercases name, so also check rawName to skip components such as <Hr />.
                if (element.rawName !== 'hr' || isInsidePre(element)) {
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
                            fixes.push(fixer.replaceTextRange([start - whitespaceBefore, start], newline + indent));
                        }
                        if (contentAfter) {
                            const whitespaceAfter = /^[ \t]*/.exec(after)[0].length;
                            fixes.push(fixer.replaceTextRange([end, end + whitespaceAfter], newline + indent));
                        }
                        return fixes;
                    },
                });
            },
        });
    },
};
