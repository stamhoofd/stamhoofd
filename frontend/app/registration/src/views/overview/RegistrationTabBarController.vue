
<script lang="ts">
import { GlobalEventBus } from "@stamhoofd/components";
import { Component } from "vue-property-decorator";
import TabBarController from "./TabBarController.vue";

@Component({})
export default class RegistrationTabBarController extends TabBarController {
    mounted() {
        GlobalEventBus.addListener(this, "checkout-complete", this.onCheckoutComplete)
    }

    onCheckoutComplete() {
        this.selectItem(this.items[0])
        return Promise.resolve()
    }
}
</script>
