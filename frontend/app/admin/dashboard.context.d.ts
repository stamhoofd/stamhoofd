
import { MemberManager } from "./src/classes/MemberManager";

declare module "vue/types/vue" {
    interface Vue {
        readonly $memberManager: MemberManager;
    }
}