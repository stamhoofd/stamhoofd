import fs from 'node:fs';
import path from 'node:path';
import { getImportedPackageName } from './helpers/package-name.js';

// Directory → name of the nearest package.json with a "name" field (null if none).
const packageNameCache = new Map();

function findOwnPackageName(startDir) {
    const unresolvedDirs = [];
    let dir = startDir;
    let name = null;

    while (true) {
        if (packageNameCache.has(dir)) {
            name = packageNameCache.get(dir);
            break;
        }
        unresolvedDirs.push(dir);

        try {
            const parsed = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
            if (typeof parsed.name === 'string' && parsed.name !== '') {
                name = parsed.name;
                break;
            }
        } catch {
            // No (or invalid) package.json in this directory: keep walking up.
        }

        const parent = path.dirname(dir);
        if (parent === dir) {
            break;
        }
        dir = parent;
    }

    for (const visited of unresolvedDirs) {
        packageNameCache.set(visited, name);
    }

    return name;
}

export default {
    meta: {
        type: 'problem',
        docs: {
            description: 'Forbid a package from importing itself by its own package name.',
        },
        schema: [],
        messages: {
            noPackageSelfImport: 'Do not import \'{{specifier}}\' from inside {{packageName}} itself. Self-name imports resolve through the package "exports" (the built dist for some packages), which duplicates modules and breaks tsc project references. Use a relative or \'#\' subpath import instead.',
        },
    },
    create(context) {
        const filename = path.resolve(context.cwd, context.filename);
        const ownPackageName = findOwnPackageName(path.dirname(filename));

        if (ownPackageName === null) {
            return {};
        }

        function checkSource(source) {
            if (!source || source.type !== 'Literal' || typeof source.value !== 'string') {
                return;
            }

            if (getImportedPackageName(source.value) === ownPackageName) {
                context.report({
                    node: source,
                    messageId: 'noPackageSelfImport',
                    data: { specifier: source.value, packageName: ownPackageName },
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
