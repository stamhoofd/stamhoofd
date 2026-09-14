import { ReactiveUrl } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';

export function getCartComponent() {
    const component = AsyncComponent(() => import('./CartView.vue'), {});
    component.provide.reactive_navigation_url = new ReactiveUrl({ url: 'cart' });
    return component;
}
