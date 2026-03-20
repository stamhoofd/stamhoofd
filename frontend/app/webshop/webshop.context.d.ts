
import type { CheckoutManager } from './src/classes/CheckoutManager';
import type { WebshopManager } from './src/classes/WebshopManager';

declare module 'vue/types/vue' {
    interface Vue {
        readonly $webshopManager: WebshopManager;
        readonly $checkoutManager: CheckoutManager
    }
}