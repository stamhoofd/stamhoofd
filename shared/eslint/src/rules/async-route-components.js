const navigationPackage = '@simonbackx/vue-app-navigation';
const routeFunctionNames = new Set(['defineRoute', 'defineRoutes']);

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

function isRouteFunction(sourceCode, node) {
    if (node.type !== 'Identifier') {
        return false;
    }

    return routeFunctionNames.has(getImportedName(findVariable(sourceCode, node)));
}

function isComponentProperty(node) {
    return node.type === 'Property'
        && !node.computed
        && (
            (node.key.type === 'Identifier' && node.key.name === 'component')
            || (node.key.type === 'Literal' && node.key.value === 'component')
        );
}

function isInsideRouteDefinition(sourceCode, node) {
    let current = node.parent;
    let containingObject = null;

    while (current) {
        if (current.type === 'ObjectExpression') {
            if (containingObject) {
                return false;
            }
            containingObject = current;
        }

        if (
            current.type === 'CallExpression'
            && isRouteFunction(sourceCode, current.callee)
            && current.arguments[0]
            && current.arguments[0].range[0] <= node.range[0]
            && current.arguments[0].range[1] >= node.range[1]
        ) {
            return true;
        }
        current = current.parent;
    }

    return false;
}

function getFunctionNode(sourceCode, node) {
    node = unwrapExpression(node);

    if (
        node.type === 'ArrowFunctionExpression'
        || node.type === 'FunctionExpression'
    ) {
        return node;
    }

    if (node.type !== 'Identifier') {
        return null;
    }

    const variable = findVariable(sourceCode, node);
    for (const definition of variable?.defs ?? []) {
        if (definition.type === 'FunctionName') {
            return definition.node;
        }

        if (definition.type === 'Variable') {
            const init = unwrapExpression(definition.node.init);
            if (init?.type === 'ArrowFunctionExpression' || init?.type === 'FunctionExpression') {
                return init;
            }
        }
    }

    return null;
}

function hasTypeNamed(type, name, seen = new Set()) {
    if (!type || seen.has(type)) {
        return false;
    }
    seen.add(type);

    if (type.symbol?.getName() === name || type.aliasSymbol?.getName() === name) {
        return true;
    }

    return type.types?.some(childType => hasTypeNamed(childType, name, seen)) ?? false;
}

function isAllowedComponentFunction(sourceCode, parserServices, node) {
    const functionNode = getFunctionNode(sourceCode, node);
    if (!functionNode) {
        return false;
    }

    if (functionNode.async) {
        return true;
    }

    if (!parserServices?.program || !parserServices.esTreeNodeToTSNodeMap) {
        return false;
    }

    const checker = parserServices.program.getTypeChecker();
    const tsNode = parserServices.esTreeNodeToTSNodeMap.get(functionNode);
    const signature = checker.getTypeAtLocation(tsNode).getCallSignatures()[0];

    return signature
        ? hasTypeNamed(checker.getReturnTypeOfSignature(signature), 'ComponentWithProperties')
        : false;
}

function isSelfComponent(node) {
    node = unwrapExpression(node);
    return node.type === 'Literal' && node.value === 'self';
}

function getRouteComponentProperty(sourceCode, identifier) {
    let value = identifier;

    while (
        value.parent?.expression === value
        && (
            value.parent.type === 'TSAsExpression'
            || value.parent.type === 'TSNonNullExpression'
            || value.parent.type === 'TSSatisfiesExpression'
            || value.parent.type === 'TSTypeAssertion'
            || value.parent.type === 'ChainExpression'
        )
    ) {
        value = value.parent;
    }

    const property = value.parent;
    if (
        !isComponentProperty(property)
        || property.value !== value
        || property.shorthand
        || !isInsideRouteDefinition(sourceCode, property)
    ) {
        return null;
    }

    return property;
}

function getImportedVariable(sourceCode, node) {
    const value = unwrapExpression(node.value);
    if (value.type !== 'Identifier') {
        return null;
    }

    const variable = findVariable(sourceCode, value);
    return variable?.defs.some(def => def.type === 'ImportBinding')
        ? variable
        : null;
}

function isImportedComponentUsedOutsideRoutes(sourceCode, node) {
    const variable = getImportedVariable(sourceCode, node);
    return variable?.references.some(
        reference => !getRouteComponentProperty(sourceCode, reference.identifier),
    ) ?? false;
}

function getDefaultImportFix(sourceCode, node) {
    const variable = getImportedVariable(sourceCode, node);
    const definition = variable?.defs.find(def => def.type === 'ImportBinding');
    if (
        !definition
        || definition.node.type !== 'ImportDefaultSpecifier'
    ) {
        return null;
    }

    const componentProperties = variable.references.map(
        reference => getRouteComponentProperty(sourceCode, reference.identifier),
    );
    if (componentProperties.some(property => property === null)) {
        return null;
    }

    const importDeclaration = definition.parent;
    const importSource = sourceCode.getText(importDeclaration.source);

    return function fix(fixer) {
        const fixes = componentProperties.map(property =>
            fixer.replaceText(property.value, `async () => (await import(${importSource})).default`),
        );

        if (importDeclaration.specifiers.length === 1) {
            fixes.push(fixer.remove(importDeclaration));
        } else {
            const nextSpecifier = importDeclaration.specifiers[1];
            const tokenBeforeNextSpecifier = sourceCode.getTokenBefore(nextSpecifier);
            fixes.push(fixer.removeRange([definition.node.range[0], tokenBeforeNextSpecifier.range[0]]));
        }

        return fixes;
    };
}

export default {
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Require route components to be loaded by async functions.',
        },
        fixable: 'code',
        schema: [],
        messages: {
            asyncComponent: 'Route components must be async functions or synchronous functions returning ComponentWithProperties.',
        },
    },
    create(context) {
        const sourceCode = context.sourceCode;
        const parserServices = sourceCode.parserServices;

        return {
            Property(node) {
                if (
                    !isComponentProperty(node)
                    || !isInsideRouteDefinition(sourceCode, node)
                    || isSelfComponent(node.value)
                    || isAllowedComponentFunction(sourceCode, parserServices, node.value)
                    || isImportedComponentUsedOutsideRoutes(sourceCode, node)
                ) {
                    return;
                }

                context.report({
                    node: node.value,
                    messageId: 'asyncComponent',
                    fix: getDefaultImportFix(sourceCode, node),
                });
            },
        };
    },
};
