import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { repositoryRoot } from '../src/ownership.js';
import { isAllowedStandaloneDependency } from '../src/rules/helpers/package-name.js';

const dependencyFields = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

const packagesRoot = path.join(repositoryRoot, 'packages');
const packageFiles = fs.readdirSync(packagesRoot, { withFileTypes: true })
    .filter(group => group.isDirectory())
    .flatMap(group => fs.readdirSync(path.join(packagesRoot, group.name)).map(name => path.join(packagesRoot, group.name, name, 'package.json')))
    .filter(file => fs.existsSync(file));

// The lint rule only sees imports; this also catches declared dependencies that are never imported.
describe('standalone package dependencies', () => {
    it('finds the libraries in /packages', () => {
        expect(packageFiles.length).toBeGreaterThan(0);
    });

    it.each(packageFiles.map(file => [path.relative(repositoryRoot, file), file]))('%s only depends on other libraries in /packages', (_name, file) => {
        const packageJson = JSON.parse(fs.readFileSync(file, 'utf8'));
        const disallowed = dependencyFields.flatMap(field => Object.keys(packageJson[field] ?? {}))
            .filter(name => !isAllowedStandaloneDependency(name));
        expect(disallowed).toEqual([]);
    });
});
