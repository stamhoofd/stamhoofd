
import { CheckoutManager } from "./src/classes/CheckoutManager";
import { WebshopManager } from "./src/classes/WebshopManager";

declare module "vue/types/vue" {
    interface Vue {
        readonly $webshopManager: WebshopManager;
        readonly $checkoutManager: CheckoutManager
    }
}