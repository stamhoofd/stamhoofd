import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
import asyncRouteComponents from '../src/rules/async-route-components.js';

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

ruleTester.run('async-route-components', asyncRouteComponents, {
    valid: [
        {
            filename: 'route.test.ts',
            code: `
            import { defineRoute } from '@simonbackx/vue-app-navigation';
            defineRoute({
                component: async () => (await import('./MyView.vue')).default,
            });
        `,
        },
        {
            filename: 'route.test.ts',
            code: `
            import { defineRoutes } from '@simonbackx/vue-app-navigation';
            const loadView = async () => (await import('./MyView.vue')).default;
            defineRoutes([{ component: loadView }]);
        `,
        },
        {
            filename: 'route.test.ts',
            code: `
            class ComponentWithProperties {}
            declare function buildEditGroupsView(period: unknown): ComponentWithProperties;
            declare const period: { value: unknown };
            import { defineRoute } from '@simonbackx/vue-app-navigation';
            defineRoute({
                component: () => {
                    return buildEditGroupsView(period.value);
                },
            });
        `,
        },
        `
            import { defineRoute } from '@simonbackx/vue-app-navigation';
            defineRoute({
                url: 'wachtlijst',
                component: 'self',
            });
        `,
        `
            import { defineRoute } from 'another-package';
            import MyView from './MyView.vue';
            defineRoute({ component: MyView });
        `,
        `
            import { defineRoute } from '@simonbackx/vue-app-navigation';
            const unrelated = { component: MyView };
        `,
        `
            import { defineRoute } from '@simonbackx/vue-app-navigation';
            defineRoute({
                component: async () => (await import('./MyView.vue')).default,
                props: { component: MyNestedComponent },
            });
        `,
        `
            import MyView from './MyView.vue';
            import { defineRoute } from '@simonbackx/vue-app-navigation';
            defineRoute({ component: MyView });
            const doSomethingWith = new ComponentWithProperties(MyView, {});
        `,
        `
            import MyView from './MyView.vue';
            import { defineRoute } from '@simonbackx/vue-app-navigation';
            useView(MyView);
            defineRoute({ component: MyView });
        `,
    ],
    invalid: [
        {
            code: `
                import MyView from './MyView.vue';
                import { defineRoute } from '@simonbackx/vue-app-navigation';
                defineRoute({ component: MyView });
            `,
            output: `
                
                import { defineRoute } from '@simonbackx/vue-app-navigation';
                defineRoute({ component: async () => (await import('./MyView.vue')).default });
            `,
            errors: [{ messageId: 'asyncComponent' }],
        },
        {
            code: `
                import MyView, { helper } from './MyView.vue';
                import { defineRoutes as registerRoutes } from '@simonbackx/vue-app-navigation';
                registerRoutes([{ component: MyView }]);
            `,
            output: `
                import { helper } from './MyView.vue';
                import { defineRoutes as registerRoutes } from '@simonbackx/vue-app-navigation';
                registerRoutes([{ component: async () => (await import('./MyView.vue')).default }]);
            `,
            errors: [{ messageId: 'asyncComponent' }],
        },
        {
            code: `
                import MyView from './MyView.vue';
                import { defineRoute } from '@simonbackx/vue-app-navigation';
                defineRoute({ name: 'first', component: MyView });
                defineRoute({ name: 'second', component: MyView });
            `,
            output: `
                
                import { defineRoute } from '@simonbackx/vue-app-navigation';
                defineRoute({ name: 'first', component: async () => (await import('./MyView.vue')).default });
                defineRoute({ name: 'second', component: async () => (await import('./MyView.vue')).default });
            `,
            errors: [
                { messageId: 'asyncComponent' },
                { messageId: 'asyncComponent' },
            ],
        },
        {
            code: `
                import { defineRoutes } from '@simonbackx/vue-app-navigation';
                defineRoutes(items.map(() => ({ component: () => import('./MyView.vue') })));
            `,
            output: null,
            errors: [{ messageId: 'asyncComponent' }],
        },
        {
            code: `
                import { defineRoute } from '@simonbackx/vue-app-navigation';
                const loadView = () => import('./MyView.vue');
                defineRoute({ component: loadView });
            `,
            output: null,
            errors: [{ messageId: 'asyncComponent' }],
        },
        {
            code: `
                import { defineRoute } from '@simonbackx/vue-app-navigation';
                defineRoute({ component: 'other' });
            `,
            output: null,
            errors: [{ messageId: 'asyncComponent' }],
        },
    ],
});
