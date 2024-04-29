import { OrganizationManager, Session } from "@stamhoofd/networking";
import { Organization, User } from "@stamhoofd/structures";
import Vue from "vue";

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

declare module "vue/types/vue" {
    interface Vue {
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
    }
}