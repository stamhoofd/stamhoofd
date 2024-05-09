import { OrganizationManager, SessionContext } from "@stamhoofd/networking";
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

        readonly $context: SessionContext;
        readonly $organization: Organization;
        readonly $user: User|null;
        readonly $organizationManager: OrganizationManager;

        // Global components
        readonly STList: typeof import('@stamhoofd/components').STList,
        readonly STListItem: typeof import('@stamhoofd/components').STListItem,
        readonly STNavigationBar: typeof import('@stamhoofd/components').STNavigationBar,
        readonly STInputBox: typeof import('@stamhoofd/components').STInputBox,
        readonly STErrorsDefault: typeof import('@stamhoofd/components').STErrorsDefault,
        readonly SaveView: typeof import('@stamhoofd/components').SaveView,
        readonly Checkbox: typeof import('@stamhoofd/components').Checkbox,
        readonly Radio: typeof import('@stamhoofd/components').Radio,
        readonly LoadingView: typeof import('@stamhoofd/components').LoadingView,

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