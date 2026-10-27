import type { ComponentWithProperties } from '@browser/navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';

/**
 * The order view on the navigation controller of the WebshopController. The controller keeps its bar visible
 * on top of it (users land here from links in their emails), so the view hides its own navigation bar.
 */
export function getOrderComponent(properties: { orderId: string; success?: boolean } | { paymentId: string; success?: boolean }) {
    const component = AsyncComponent(() => import('./OrderView.vue'), { ...properties, showNavigationBar: false });
    component.provide.webshop_order_view = true;
    return component;
}

export function isOrderComponent(component: ComponentWithProperties) {
    return component.provide.webshop_order_view === true;
}
