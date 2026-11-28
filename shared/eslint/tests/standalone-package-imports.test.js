import { RuleTester } from 'eslint';
import path from 'node:path';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
import { repositoryRoot } from '../src/ownership.js';
import standalonePackageImports from '../src/rules/standalone-package-imports.js';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
    languageOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        parser: tseslint.parser,
    },
});

const databaseFile = path.join(repositoryRoot, 'packages/node/database/src/classes/Database.ts');
const databaseTestFile = path.join(repositoryRoot, 'packages/node/database/tests/vitest.setup.ts');
const structuresFile = path.join(repositoryRoot, 'shared/structures/src/Group.ts');

ruleTester.run('standalone-package-imports', standalonePackageImports, {
    valid: [
        {
            filename: databaseFile,
            code: `import { Encoder } from '@stamhoofd/common-encoding';`,
        },
        {
            filename: databaseFile,
            code: `import { logger } from '@stamhoofd/node-logging';`,
        },
        {
            filename: databaseFile,
            code: `import { Router } from '@stamhoofd/browser-navigation';`,
        },
        {
            filename: databaseFile,
            code: `import mysql from 'mysql2';`,
        },
        {
            filename: databaseFile,
            code: `import { Migration } from '../Migration.js';`,
        },
        // Outside /packages, any @stamhoofd package can be imported.
        {
            filename: structuresFile,
            code: `import { Formatter } from '@stamhoofd/utility';`,
        },
    ],
    invalid: [
        {
            filename: databaseFile,
            code: `import { Formatter } from '@stamhoofd/utility';`,
            errors: [{ messageId: 'standalonePackageImport' }],
        },
        {
            filename: databaseTestFile,
            code: `import { TestUtils } from '@stamhoofd/test-utils';`,
            errors: [{ messageId: 'standalonePackageImport' }],
        },
        {
            filename: databaseFile,
            code: `import type { BackendEnvironment } from '@stamhoofd/types/Environment';`,
            errors: [{ messageId: 'standalonePackageImport' }],
        },
        // A prefix that is not followed by a dash is a different package.
        {
            filename: databaseFile,
            code: `import { Foo } from '@stamhoofd/common';`,
            errors: [{ messageId: 'standalonePackageImport' }],
        },
        {
            filename: databaseFile,
            code: `export * from '@stamhoofd/structures';`,
            errors: [{ messageId: 'standalonePackageImport' }],
        },
        {
            filename: databaseFile,
            code: `export { Group } from '@stamhoofd/structures/Group.js';`,
            errors: [{ messageId: 'standalonePackageImport' }],
        },
        {
            filename: databaseFile,
            code: `const structures = await import('@stamhoofd/structures');`,
            errors: [{ messageId: 'standalonePackageImport' }],
        },
        {
            filename: databaseFile,
            code: `type Group = import('@stamhoofd/structures').Group;`,
            errors: [{ messageId: 'standalonePackageImport' }],
        },
        {
            filename: databaseFile,
            code: `import utility = require('@stamhoofd/utility');`,
            errors: [{ messageId: 'standalonePackageImport' }],
        },
        {
            filename: databaseFile,
            code: `const utility = require('@stamhoofd/utility');`,
            errors: [{ messageId: 'standalonePackageImport' }],
        },
    ],
});
