const richTextTypes = new Set(['RichText', 'TranslatedRichText']);

function unwrapExpression(node) {
    while (
        node?.type === 'TSAsExpression'
        || node?.type === 'TSNonNullExpression'
        || node?.type === 'TSSatisfiesExpression'
        || node?.type === 'TSTypeAssertion'
        || node?.type === 'ChainExpression'
    ) {
        node = node.expression;
    }

    return node;
}

function hasRichTextType(type, seen = new Set()) {
    if (!type || seen.has(type)) {
        return false;
    }
    seen.add(type);

    if (richTextTypes.has(type.symbol?.getName()) || richTextTypes.has(type.aliasSymbol?.getName())) {
        return true;
    }

    if (type.types?.some(childType => hasRichTextType(childType, seen))) {
        return true;
    }

    return type.getBaseTypes?.()?.some(baseType => hasRichTextType(baseType, seen)) ?? false;
}

export default {
    meta: {
        type: 'problem',
        docs: {
            description: 'Disallow interpolating a rich text into a string; render its html instead.',
        },
        schema: [],
        messages: {
            noRichTextInterpolation: 'Do not interpolate a rich text into a string: toString() returns the plain text, so every paragraph, line and mark is silently dropped. Render {{ name }}.html with v-html (inside an element with the style-wysiwyg class), or read {{ name }}.text when the plain text is what you want.',
        },
    },
    create(context) {
        const parserServices = context.sourceCode.parserServices;

        if (!parserServices?.program || !parserServices.esTreeNodeToTSNodeMap) {
            return {};
        }

        const checker = parserServices.program.getTypeChecker();

        function report(node) {
            const expression = unwrapExpression(node);
            const tsNode = parserServices.esTreeNodeToTSNodeMap.get(expression);
            if (!tsNode) {
                return;
            }

            if (!hasRichTextType(checker.getTypeAtLocation(tsNode))) {
                return;
            }

            context.report({
                node: expression,
                messageId: 'noRichTextInterpolation',
                data: { name: context.sourceCode.getText(expression) },
            });
        }

        return {
            TemplateLiteral(node) {
                for (const expression of node.expressions) {
                    report(expression);
                }
            },
            // Concatenation coerces the same way an interpolation does
            'BinaryExpression[operator="+"]'(node) {
                report(node.left);
                report(node.right);
            },
        };
    },
};
