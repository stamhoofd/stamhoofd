import { ComponentWithProperties, ReactiveUrl } from '@simonbackx/vue-app-navigation';
import { importWithRetry } from '@stamhoofd/components/containers/AsyncComponent.ts';

/**
 * Loaded before it is shown, like the checkout steps: a loading view in its place would not get the inset
 * of the checkout progress bar in the WebshopController, so the view would jump once the cart renders.
 */
export async function getCartComponent() {
    const { default: CartView } = await importWithRetry(() => import('./CartView.vue'), []);
    const component = new ComponentWithProperties(CartView, {});
    component.provide.reactive_navigation_url = new ReactiveUrl({ url: 'cart' });
    return component;
}
