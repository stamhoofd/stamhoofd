import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
import preferDefineRoute from '../src/rules/prefer-define-route.js';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
    languageOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        parser: tseslint.parser,
        parserOptions: {
            projectService: {
                allowDefaultProject: ['estree.ts', 'route.test.ts'],
            },
            tsconfigRootDir: import.meta.dirname,
        },
    },
});

ruleTester.run('prefer-define-route', preferDefineRoute, {
    valid: [
        `
            import { defineRoute } from '@simonbackx/vue-app-navigation';
            defineRoute({ component: 'self' });
        `,
        // defineRoutes imported from another package is not our concern.
        `
            import { defineRoutes } from 'another-package';
            defineRoutes([{ component: 'self' }]);
        `,
        // A local function that happens to share the name is not the navigation helper.
        `
            function defineRoutes() {}
            defineRoutes();
        `,
    ],
    invalid: [
        {
            code: `
                import { defineRoutes } from '@simonbackx/vue-app-navigation';
                defineRoutes([{ component: 'self' }]);
            `,
            errors: [{ messageId: 'preferDefineRoute' }],
        },
        {
            code: `
                import { defineRoutes as registerRoutes } from '@simonbackx/vue-app-navigation';
                registerRoutes([{ component: 'self' }]);
            `,
            errors: [{ messageId: 'preferDefineRoute' }],
        },
        {
            code: `
                import { defineRoute, defineRoutes } from '@simonbackx/vue-app-navigation';
                defineRoute({ component: 'self' });
                defineRoutes([{ component: 'self' }]);
            `,
            errors: [{ messageId: 'preferDefineRoute' }],
        },
    ],
});
