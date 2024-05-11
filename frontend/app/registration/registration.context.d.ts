
import { CheckoutManager } from "./src/classes/CheckoutManager";
import { MemberManager } from "./src/classes/MemberManager";

declare module 'vue' {
    interface ComponentCustomProperties {
        readonly $memberManager: MemberManager;
        readonly $checkoutManager: CheckoutManager
    }
}
