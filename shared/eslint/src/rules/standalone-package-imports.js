import path from 'node:path';
import { repositoryRoot } from '../ownership.js';
import { getImportedPackageName } from './no-package-self-import.js';

// Libraries in /packages are published under these name prefixes.
const standalonePackageName = /^@stamhoofd\/(common|node|browser)-/;

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
            if (packageName?.startsWith('@stamhoofd/') && !standalonePackageName.test(packageName)) {
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
        };
    },
};
