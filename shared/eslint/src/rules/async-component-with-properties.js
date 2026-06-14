const navigationPackage = '@simonbackx/vue-app-navigation';
const asyncComponentImportNames = new Set([
    '#containers/AsyncComponent.ts',
    '@stamhoofd/components/containers/AsyncComponent.ts',
]);

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

function getImportDefinition(variable) {
    return variable?.defs.find(definition => definition.type === 'ImportBinding') ?? null;
}

function getImportedName(definition) {
    if (definition?.node.type !== 'ImportSpecifier') {
        return null;
    }

    return definition.node.imported.name ?? definition.node.imported.value;
}

function isImportedFrom(definition, packageName) {
    return definition?.parent.type === 'ImportDeclaration'
        && definition.parent.source.value === packageName;
}

function isComponentWithPropertiesConstructor(sourceCode, node) {
    const callee = unwrapExpression(node.callee);
    if (callee.type !== 'Identifier') {
        return false;
    }

    const definition = getImportDefinition(findVariable(sourceCode, callee));
    return isImportedFrom(definition, navigationPackage)
        && getImportedName(definition) === 'ComponentWithProperties';
}

function getDefaultImport(sourceCode, node) {
    node = unwrapExpression(node);
    if (node.type !== 'Identifier') {
        return null;
    }

    const variable = findVariable(sourceCode, node);
    const definition = getImportDefinition(variable);
    if (definition?.node.type !== 'ImportDefaultSpecifier') {
        return null;
    }

    return { variable, definition };
}

function getNavigationImportName(sourceCode, node) {
    node = unwrapExpression(node);
    if (node.type !== 'Identifier') {
        return null;
    }

    const definition = getImportDefinition(findVariable(sourceCode, node));
    return isImportedFrom(definition, navigationPackage)
        ? getImportedName(definition)
        : null;
}

function getComponentConstruction(sourceCode, identifier) {
    let argument = identifier;

    while (argument.parent?.expression === argument) {
        const parent = unwrapExpression(argument.parent);
        if (parent === argument.parent) {
            break;
        }
        argument = argument.parent;
    }

    const construction = argument.parent;
    return construction?.type === 'NewExpression'
        && construction.arguments[0] === argument
        && isComponentWithPropertiesConstructor(sourceCode, construction)
        ? construction
        : null;
}

function findVariableByName(sourceCode, node, name) {
    let scope = sourceCode.getScope(node);

    while (scope) {
        const variable = scope.set.get(name);
        if (variable) {
            return variable;
        }
        scope = scope.upper;
    }

    return null;
}

function getAsyncComponent(sourceCode, node, filename) {
    const existingVariable = findVariableByName(sourceCode, node, 'AsyncComponent');
    const existingDefinition = getImportDefinition(existingVariable);
    if (
        existingDefinition?.node.type === 'ImportSpecifier'
        && getImportedName(existingDefinition) === 'AsyncComponent'
        && asyncComponentImportNames.has(existingDefinition.parent.source.value)
    ) {
        return {
            name: existingVariable.name,
            importDeclaration: null,
            importSource: null,
        };
    }

    for (const scope of [sourceCode.getScope(node), sourceCode.getScope(node).upper]) {
        for (const variable of scope?.variables ?? []) {
            const definition = getImportDefinition(variable);
            if (
                definition?.node.type === 'ImportSpecifier'
                && getImportedName(definition) === 'AsyncComponent'
                && asyncComponentImportNames.has(definition.parent.source.value)
            ) {
                return {
                    name: variable.name,
                    importDeclaration: null,
                    importSource: null,
                };
            }
        }
    }

    if (existingVariable) {
        return null;
    }

    const navigationImport = sourceCode.ast.body.find(statement =>
        statement.type === 'ImportDeclaration'
        && statement.source.value === navigationPackage,
    );
    if (!navigationImport) {
        return null;
    }

    return {
        name: 'AsyncComponent',
        importDeclaration: navigationImport,
        importSource: filename.includes('/frontend/shared/components/')
            ? '#containers/AsyncComponent.ts'
            : '@stamhoofd/components/containers/AsyncComponent.ts',
    };
}

function getFix(sourceCode, node, importedComponent, filename) {
    const asyncComponent = getAsyncComponent(sourceCode, node, filename);
    if (!asyncComponent || node.arguments.length > 3) {
        return null;
    }

    const importDeclaration = importedComponent.definition.parent;
    const importSource = sourceCode.getText(importDeclaration.source);
    const constructions = importedComponent.variable.references.map(
        reference => getComponentConstruction(sourceCode, reference.identifier),
    );
    const canRemoveImport = constructions.every(Boolean);
    const nodesToReplace = canRemoveImport ? constructions : [node];

    return function fix(fixer) {
        const fixes = nodesToReplace.map((construction) => {
            const properties = construction.arguments[1]
                ? sourceCode.getText(construction.arguments[1])
                : '{}';
            const options = construction.arguments[2]
                ? `, ${sourceCode.getText(construction.arguments[2])}`
                : '';
            return fixer.replaceText(
                construction,
                `${asyncComponent.name}(() => import(${importSource}), ${properties}${options})`,
            );
        });

        if (asyncComponent.importDeclaration && asyncComponent.importSource) {
            const indent = ' '.repeat(asyncComponent.importDeclaration.loc.start.column);
            fixes.push(fixer.insertTextAfter(
                asyncComponent.importDeclaration,
                `\n${indent}import { AsyncComponent } from '${asyncComponent.importSource}';`,
            ));
        }

        if (canRemoveImport) {
            if (importDeclaration.specifiers.length === 1) {
                fixes.push(fixer.remove(importDeclaration));
            } else {
                const nextSpecifier = importDeclaration.specifiers[1];
                const tokenBeforeNextSpecifier = sourceCode.getTokenBefore(nextSpecifier);
                fixes.push(fixer.removeRange([
                    importedComponent.definition.node.range[0],
                    tokenBeforeNextSpecifier.range[0],
                ]));
            }
        }

        return fixes;
    };
}

export default {
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Require imported Vue components to be loaded through AsyncComponent.',
        },
        fixable: 'code',
        schema: [{
            type: 'object',
            additionalProperties: false,
            properties: {
                allow: {
                    type: 'array',
                    items: { type: 'string' },
                    uniqueItems: true,
                },
            },
        }],
        messages: {
            asyncComponent: 'Use AsyncComponent(() => import(...), properties) instead of eagerly constructing an imported component.',
        },
    },
    create(context) {
        const sourceCode = context.sourceCode;
        const allowedComponentNames = new Set(context.options[0]?.allow ?? []);

        return {
            NewExpression(node) {
                if (!isComponentWithPropertiesConstructor(sourceCode, node) || !node.arguments[0]) {
                    return;
                }

                const component = unwrapExpression(node.arguments[0]);
                if (component.type === 'Identifier' && allowedComponentNames.has(component.name)) {
                    return;
                }

                const navigationImportName = getNavigationImportName(sourceCode, node.arguments[0]);
                if (navigationImportName && allowedComponentNames.has(navigationImportName)) {
                    return;
                }

                const importedComponent = getDefaultImport(sourceCode, node.arguments[0]);
                if (!importedComponent) {
                    return;
                }

                context.report({
                    node: node.arguments[0],
                    messageId: 'asyncComponent',
                    fix: getFix(sourceCode, node, importedComponent, context.filename),
                });
            },
        };
    },
};
