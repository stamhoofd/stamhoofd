import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
import noTRouteUrl from '../src/rules/no-t-route-url.js';

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

ruleTester.run('no-t-route-url', noTRouteUrl, {
    valid: [
        // The recommended alternative.
        `
            import { defineRoute } from '@simonbackx/vue-app-navigation';
            defineRoute({ url: buildTranslatedUrl({ nl: 'activiteiten', fr: 'activites', en: 'activities' }), component: 'self' });
        `,
        // A plain string url is fine.
        `
            import { defineRoute } from '@simonbackx/vue-app-navigation';
            defineRoute({ url: 'reset-password', component: 'self' });
        `,
        // $t used for another property (name) is not our concern.
        `
            import { defineRoute } from '@simonbackx/vue-app-navigation';
            defineRoute({ url: 'events', name: $t('Activiteiten'), component: 'self' });
        `,
        // defineRoutes with translated urls is fine.
        `
            import { defineRoutes } from '@simonbackx/vue-app-navigation';
            defineRoutes([{ url: buildTranslatedUrl({ nl: 'activiteiten', fr: 'activites', en: 'activities' }), component: 'self' }]);
        `,
        // A defineRoute imported from another package is not our concern.
        `
            import { defineRoute } from 'another-package';
            defineRoute({ url: $t('activiteiten'), component: 'self' });
        `,
        // A local function that happens to share the name is not the navigation helper.
        `
            function defineRoute() {}
            defineRoute({ url: $t('activiteiten') });
        `,
    ],
    invalid: [
        {
            code: `
                import { defineRoute } from '@simonbackx/vue-app-navigation';
                defineRoute({ url: $t('activiteiten'), component: 'self' });
            `,
            errors: [{ messageId: 'noTranslateInUrl' }],
        },
        // Aliased import.
        {
            code: `
                import { defineRoute as registerRoute } from '@simonbackx/vue-app-navigation';
                registerRoute({ url: $t('%uB'), component: 'self' });
            `,
            errors: [{ messageId: 'noTranslateInUrl' }],
        },
        // defineRoutes: every offending route object is reported.
        {
            code: `
                import { defineRoutes } from '@simonbackx/vue-app-navigation';
                defineRoutes([
                    { url: $t('activiteiten'), component: 'self' },
                    { url: 'plain', component: 'self' },
                    { url: $t('berichten'), component: 'self' },
                ]);
            `,
            errors: [
                { messageId: 'noTranslateInUrl' },
                { messageId: 'noTranslateInUrl' },
            ],
        },
        // The url expression starts with a $t(...) call.
        {
            code: `
                import { defineRoute } from '@simonbackx/vue-app-navigation';
                defineRoute({ url: $t('activiteiten') + '/detail', component: 'self' });
            `,
            errors: [{ messageId: 'noTranslateInUrl' }],
        },
        // TS type assertions around the argument and the url value are unwrapped.
        {
            code: `
                import { defineRoute } from '@simonbackx/vue-app-navigation';
                defineRoute(({ url: $t('activiteiten') as string, component: 'self' }) as any);
            `,
            errors: [{ messageId: 'noTranslateInUrl' }],
        },
    ],
});
