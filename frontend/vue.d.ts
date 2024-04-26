import { OrganizationManager, Session } from "@stamhoofd/networking";
import { Organization, User } from "@stamhoofd/structures";
import Vue from "vue";

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