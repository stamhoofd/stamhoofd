import { RuleTester } from 'eslint';
import path from 'node:path';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
import noPackageSelfImport from '../src/rules/no-package-self-import.js';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
    languageOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        parser: tseslint.parser,
    },
});

// A file inside this package (name: eslint-plugin-stamhoofd).
const ownFile = path.join(import.meta.dirname, 'file.ts');

// A file inside the @stamhoofd/structures package, to cover scoped package names.
const structuresFile = path.resolve(import.meta.dirname, '../../structures/src/AuditLogReplacement.test.ts');

ruleTester.run('no-package-self-import', noPackageSelfImport, {
    valid: [
        {
            filename: ownFile,
            code: `import { Foo } from './foo.js';`,
        },
        {
            filename: ownFile,
            code: `import { Foo } from '#rules/foo.js';`,
        },
        // Other packages are fine, including ones that share a name prefix.
        {
            filename: ownFile,
            code: `import { Foo } from 'eslint-plugin-stamhoofd-extra';`,
        },
        {
            filename: structuresFile,
            code: `import { Formatter } from '@stamhoofd/utility';`,
        },
        // A scoped package sharing the scope and a name prefix is a different package.
        {
            filename: structuresFile,
            code: `import { Foo } from '@stamhoofd/structures-extra/Foo';`,
        },
    ],
    invalid: [
        {
            filename: ownFile,
            code: `import plugin from 'eslint-plugin-stamhoofd';`,
            errors: [{ messageId: 'noPackageSelfImport' }],
        },
        {
            filename: ownFile,
            code: `import rule from 'eslint-plugin-stamhoofd/src/rules/prefer-define-route.js';`,
            errors: [{ messageId: 'noPackageSelfImport' }],
        },
        {
            filename: structuresFile,
            code: `import { AuditLogReplacement } from '@stamhoofd/structures';`,
            errors: [{ messageId: 'noPackageSelfImport' }],
        },
        {
            filename: structuresFile,
            code: `import type { AuditLogReplacement } from '@stamhoofd/structures';`,
            errors: [{ messageId: 'noPackageSelfImport' }],
        },
        {
            filename: structuresFile,
            code: `import { Group } from '@stamhoofd/structures/Group.js';`,
            errors: [{ messageId: 'noPackageSelfImport' }],
        },
        {
            filename: structuresFile,
            code: `export * from '@stamhoofd/structures';`,
            errors: [{ messageId: 'noPackageSelfImport' }],
        },
        {
            filename: structuresFile,
            code: `export { Group } from '@stamhoofd/structures/Group.js';`,
            errors: [{ messageId: 'noPackageSelfImport' }],
        },
        {
            filename: structuresFile,
            code: `const structures = await import('@stamhoofd/structures');`,
            errors: [{ messageId: 'noPackageSelfImport' }],
        },
    ],
});
