import { inject } from 'vue';
import { CheckoutManager } from '../classes/CheckoutManager';

export function useCheckoutManager(): CheckoutManager {
    const checkoutManager = inject<CheckoutManager>('$checkoutManager');
    if (!checkoutManager) {
        console.error('No checkout manager provided.');
    }
    return checkoutManager!;
}
