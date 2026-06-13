import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import asyncComponentWithProperties from '../src/rules/async-component-with-properties.js';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
    languageOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
    },
});

ruleTester.run('async-component-with-properties', asyncComponentWithProperties, {
    valid: [
        `
            import { ComponentWithProperties, NavigationController } from '@simonbackx/vue-app-navigation';
            new ComponentWithProperties(NavigationController, { root });
        `,
        `
            import { ComponentWithProperties as CWP, SplitViewController as Split } from '@simonbackx/vue-app-navigation';
            new CWP(Split, { root });
        `,
        `
            import { ComponentWithProperties, TabBarController } from '@simonbackx/vue-app-navigation';
            new ComponentWithProperties(TabBarController, { tabs });
        `,
        `
            import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
            import TabBarController from './TabBarController.vue';
            import AuthenticatedView from './AuthenticatedView.vue';
            new ComponentWithProperties(TabBarController, { tabs });
            new ComponentWithProperties(AuthenticatedView, { root });
        `,
        `
            import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
            new ComponentWithProperties(Self, {});
        `,
        `
            import MyView from './MyView.vue';
            import { ComponentWithProperties } from 'another-package';
            new ComponentWithProperties(MyView, {});
        `,
    ],
    invalid: [
        {
            code: `
                import MyView from './MyView.vue';
                import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
                new ComponentWithProperties(MyView, {});
            `,
            output: `
                
                import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
                import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
                AsyncComponent(() => import('./MyView.vue'), {});
            `,
            errors: [{ messageId: 'asyncComponent' }],
        },
        {
            filename: '/repo/frontend/shared/components/src/MyFile.ts',
            code: `
                import MyView from './MyView.vue';
                import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
                new ComponentWithProperties(MyView, {});
            `,
            output: `
                
                import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
                import { AsyncComponent } from '#containers/AsyncComponent.ts';
                AsyncComponent(() => import('./MyView.vue'), {});
            `,
            errors: [{ messageId: 'asyncComponent' }],
        },
        {
            code: `
                import MyView from './MyView.vue';
                import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
                import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
                AsyncComponent(() => import('./AlreadyAsync.vue'), {});
                new ComponentWithProperties(MyView, { id: 1 });
            `,
            output: `
                
                import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
                import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
                AsyncComponent(() => import('./AlreadyAsync.vue'), {});
                AsyncComponent(() => import('./MyView.vue'), { id: 1 });
            `,
            errors: [{ messageId: 'asyncComponent' }],
        },
        {
            code: `
                import MyView from './MyView.vue';
                import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
                import { AsyncComponent as LazyComponent } from '#containers/AsyncComponent.ts';
                new ComponentWithProperties(MyView);
                new ComponentWithProperties(MyView, { id: 1 });
            `,
            output: `
                
                import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
                import { AsyncComponent as LazyComponent } from '#containers/AsyncComponent.ts';
                LazyComponent(() => import('./MyView.vue'), {});
                LazyComponent(() => import('./MyView.vue'), { id: 1 });
            `,
            errors: [
                { messageId: 'asyncComponent' },
                { messageId: 'asyncComponent' },
            ],
        },
        {
            code: `
                import MyView from './MyView.vue';
                import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
                import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
                useView(MyView);
                new ComponentWithProperties(MyView, {});
            `,
            output: `
                import MyView from './MyView.vue';
                import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
                import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
                useView(MyView);
                AsyncComponent(() => import('./MyView.vue'), {});
            `,
            errors: [{ messageId: 'asyncComponent' }],
        },
        {
            code: `
                import MyView from './MyView.vue';
                import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
                import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
                new ComponentWithProperties(MyView, {}, { forceCanHaveFocus: true });
            `,
            output: null,
            errors: [{ messageId: 'asyncComponent' }],
        },
    ],
});
