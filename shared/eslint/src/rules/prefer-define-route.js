const navigationPackage = '@simonbackx/vue-app-navigation';

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

function findVariable(sourceCode, identifier) {
    let scope = sourceCode.getScope(identifier);

    while (scope) {
        const variable = scope.set.get(identifier.name);
        if (variable) {
            return variable;
        }
        scope = scope.upper;
    }

    return null;
}

function getImportedName(variable) {
    const definition = variable?.defs.find(def => def.type === 'ImportBinding');
    const importDeclaration = definition?.parent;

    if (importDeclaration?.type !== 'ImportDeclaration' || importDeclaration.source.value !== navigationPackage) {
        return null;
    }

    if (definition.node.type !== 'ImportSpecifier') {
        return null;
    }

    return definition.node.imported.name ?? definition.node.imported.value;
}

function isDefineRoutes(sourceCode, node) {
    if (node.type !== 'Identifier') {
        return false;
    }

    return getImportedName(findVariable(sourceCode, node)) === 'defineRoutes';
}

export default {
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Prefer defineRoute over defineRoutes for better type safety.',
        },
        schema: [],
        messages: {
            preferDefineRoute: 'Prefer defineRoute over defineRoutes: defineRoutes is typed as Route<any>[] and loses type safety. Call defineRoute for each route instead.',
        },
    },
    create(context) {
        const sourceCode = context.sourceCode;

        return {
            CallExpression(node) {
                if (isDefineRoutes(sourceCode, unwrapExpression(node.callee))) {
                    context.report({
                        node: node.callee,
                        messageId: 'preferDefineRoute',
                    });
                }
            },
        };
    },
};
