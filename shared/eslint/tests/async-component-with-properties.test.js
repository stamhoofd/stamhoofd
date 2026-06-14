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
            import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
            new ComponentWithProperties(Self, {});
        `,
        `
            import MyView from './MyView.vue';
            import { ComponentWithProperties } from 'another-package';
            new ComponentWithProperties(MyView, {});
        `,
        {
            options: [{
                allow: [
                    'App',
                    'AuthenticatedView',
                    'CenteredMessageView',
                    'NavigationController',
                    'SplitViewController',
                    'TabBarController',
                    'ToastView',
                    'Tooltip',
                ],
            }],
            code: `
                import { ComponentWithProperties, NavigationController } from '@simonbackx/vue-app-navigation';
                import App from './App.vue';
                import AuthenticatedView from './AuthenticatedView.vue';
                import CenteredMessageView from './CenteredMessageView.vue';
                import ToastView from './ToastView.vue';
                import Tooltip from './Tooltip.vue';
                new ComponentWithProperties(NavigationController, { root });
                new ComponentWithProperties(App, {});
                new ComponentWithProperties(AuthenticatedView, {});
                new ComponentWithProperties(CenteredMessageView, {});
                new ComponentWithProperties(ToastView, {});
                new ComponentWithProperties(Tooltip, {});
            `,
        },
    ],
    invalid: [
        {
            code: `
                import MyView from './MyView.vue';
                import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
                new ComponentWithProperties(MyView, {});
            `,
            output: `
${'                '}
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
${'                '}
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
${'                '}
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
${'                '}
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
            output: `
${'                '}
                import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
                import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
                AsyncComponent(() => import('./MyView.vue'), {}, { forceCanHaveFocus: true });
            `,
            errors: [{ messageId: 'asyncComponent' }],
        },
    ],
});
