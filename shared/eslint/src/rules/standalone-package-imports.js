import path from 'node:path';
import { repositoryRoot } from '../ownership.js';
import { getImportedPackageName, isAllowedStandaloneDependency } from './helpers/package-name.js';

function isInStandalonePackage(filename) {
    const relative = path.relative(repositoryRoot, filename);
    return relative.startsWith(`packages${path.sep}`);
}

export default {
    meta: {
        type: 'problem',
        docs: {
            description: 'Forbid libraries in /packages from importing @stamhoofd packages outside /packages.',
        },
        schema: [],
        messages: {
            standalonePackageImport: 'Do not import \'{{specifier}}\' here. Libraries in /packages are standalone and published for external use, so they can only depend on other libraries in /packages (@stamhoofd/common-*, @stamhoofd/node-* or @stamhoofd/browser-*).',
        },
    },
    create(context) {
        const filename = path.resolve(context.cwd, context.filename);
        if (!isInStandalonePackage(filename)) {
            return {};
        }

        function checkSource(source) {
            if (!source || source.type !== 'Literal' || typeof source.value !== 'string') {
                return;
            }

            const packageName = getImportedPackageName(source.value);
            if (packageName && !isAllowedStandaloneDependency(packageName)) {
                context.report({
                    node: source,
                    messageId: 'standalonePackageImport',
                    data: { specifier: source.value },
                });
            }
        }

        return {
            ImportDeclaration(node) {
                checkSource(node.source);
            },
            ExportNamedDeclaration(node) {
                checkSource(node.source);
            },
            ExportAllDeclaration(node) {
                checkSource(node.source);
            },
            ImportExpression(node) {
                checkSource(node.source);
            },
            // type Foo = import('@stamhoofd/x').Foo
            TSImportType(node) {
                checkSource(node.source ?? node.argument?.literal);
            },
            // import x = require('@stamhoofd/x')
            TSExternalModuleReference(node) {
                checkSource(node.expression);
            },
            CallExpression(node) {
                if (node.callee.type === 'Identifier' && node.callee.name === 'require') {
                    checkSource(node.arguments[0]);
                }
            },
        };
    },
};
