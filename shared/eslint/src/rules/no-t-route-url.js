const navigationPackage = '@simonbackx/vue-app-navigation';
const routeDefiners = new Set(['defineRoute', 'defineRoutes']);

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

// Returns the name of the route definer (defineRoute/defineRoutes) that this
// callee resolves to, but only when it is imported from the navigation package.
function getRouteDefinerName(sourceCode, node) {
    if (node.type !== 'Identifier') {
        return null;
    }

    const imported = getImportedName(findVariable(sourceCode, node));
    return routeDefiners.has(imported) ? imported : null;
}

function isTranslateCall(node) {
    if (node.type !== 'CallExpression') {
        return false;
    }

    const callee = unwrapExpression(node.callee);
    return callee.type === 'Identifier' && callee.name === '$t';
}

// Detects a url value whose leading expression is a $t(...) call, i.e. the
// source text effectively starts with `$t(`. Descends into the left side of
// binary/logical expressions so `$t('a') + '/b'` is caught as well.
function startsWithTranslateCall(node) {
    node = unwrapExpression(node);

    if (isTranslateCall(node)) {
        return true;
    }

    if (node.type === 'BinaryExpression' || node.type === 'LogicalExpression') {
        return startsWithTranslateCall(node.left);
    }

    return false;
}

function getPropertyKeyName(property) {
    if (property.type !== 'Property' || property.computed) {
        return null;
    }

    const key = property.key;
    if (key.type === 'Identifier') {
        return key.name;
    }
    if (key.type === 'Literal') {
        return typeof key.value === 'string' ? key.value : null;
    }

    return null;
}

export default {
    meta: {
        type: 'problem',
        docs: {
            description: 'Disallow using the $t API for route urls; use buildTranslatedUrl instead.',
        },
        schema: [],
        messages: {
            noTranslateInUrl: 'Do not use the $t API for route urls: the resulting url is not reliable and depends on the active language. Use buildTranslatedUrl({ nl: \'...\', fr: \'...\', en: \'...\' }) instead, e.g. url: buildTranslatedUrl({ nl: \'activiteiten\', fr: \'activites\', en: \'activities\' }).',
        },
    },
    create(context) {
        const sourceCode = context.sourceCode;

        function checkRouteObject(node) {
            const object = unwrapExpression(node);
            if (object.type !== 'ObjectExpression') {
                return;
            }

            for (const property of object.properties) {
                if (getPropertyKeyName(property) !== 'url') {
                    continue;
                }

                if (startsWithTranslateCall(property.value)) {
                    context.report({
                        node: property.value,
                        messageId: 'noTranslateInUrl',
                    });
                }
            }
        }

        return {
            CallExpression(node) {
                const definerName = getRouteDefinerName(sourceCode, unwrapExpression(node.callee));
                if (!definerName) {
                    return;
                }

                const argument = node.arguments[0];
                if (!argument) {
                    return;
                }

                if (definerName === 'defineRoute') {
                    checkRouteObject(argument);
                    return;
                }

                // defineRoutes takes an array of route objects.
                const array = unwrapExpression(argument);
                if (array.type !== 'ArrayExpression') {
                    return;
                }

                for (const element of array.elements) {
                    if (element && element.type !== 'SpreadElement') {
                        checkRouteObject(element);
                    }
                }
            },
        };
    },
};
