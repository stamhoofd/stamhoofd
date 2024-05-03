import { OrganizationManager, Session } from "@stamhoofd/networking";
import { Organization, User } from "@stamhoofd/structures";
import Vue from "vue";
import { Formatter } from "@stamhoofd/utility";

export {}

declare module 'vue' {
    import { CompatVue } from '@vue/runtime-dom'
    const Vue: CompatVue
    export default Vue
    export * from '@vue/runtime-dom'
    const { configureCompat } = Vue
    export { configureCompat }
}
  
declare module "*.vue" {
    export default Vue;
}

declare module 'vue' {
    interface ComponentCustomProperties {
        readonly $OS: "android" | "iOS" | "web" | "macOS" | "windows" | "unknown";
        readonly $isNative: boolean;
        readonly $isTouch: boolean;
        readonly $isAndroid: boolean;
        readonly $isIOS: boolean;
        readonly $isMac: boolean;

        readonly $context: Session;
        readonly $organization: Organization;
        readonly $user: User|null;
        readonly $organizationManager: OrganizationManager;

        // Global components
        readonly STList: typeof import('@stamhoofd/components').STList,
        readonly STListItem: typeof import('@stamhoofd/components').STListItem,

        // Formatters
        formatPrice: typeof Formatter.price,
        formatDate: typeof Formatter.date,
        formatDateTime: typeof Formatter.dateTime,
        formatPriceChange: typeof Formatter.priceChange,
        formatMinutes: typeof Formatter.minutes,
        capitalizeFirstLetter: typeof Formatter.capitalizeFirstLetter,
        formatDateWithDay: typeof Formatter.dateWithDay,
        formatTime: typeof Formatter.time,
    }
}