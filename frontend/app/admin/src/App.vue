<template>
    <div id="app">
        <!--<ComponentWithPropertiesInstance :component="root" />-->
        <ModalStackComponent ref="modalStack" :root="root" />
        <ToastBox />
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, HistoryManager,ModalStackComponent, PushOptions, SplitViewController } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, CenteredMessageView, ColorHelper, ModalStackEventBus, ToastBox } from '@stamhoofd/components';
import { Component, Vue } from "@simonbackx/vue-app-navigation/classes";

import { AdminSession } from "./classes/AdminSession";
import AuthenticatedView from './containers/AuthenticatedView.vue';
import AdminMenu from "./views/AdminMenu.vue";
import LoginView from './views/LoginView.vue';

@Component({
    components: {
        ModalStackComponent,
        ToastBox
    },
})
export default class App extends Vue {
    root = new ComponentWithProperties(AuthenticatedView, {
        root: new ComponentWithProperties(SplitViewController, {
            root: new ComponentWithProperties(AdminMenu)
        }),
        loginRoot: new ComponentWithProperties(LoginView)
    })

    mounted() {
        HistoryManager.activate();

        if (STAMHOOFD.environment == "development") {
            //ColorHelper.setColor("#BC0044");
        }

        if (AdminSession.shared.canGetCompleted()) {
            AdminSession.shared.updateData().catch(console.error)
        }

        ModalStackEventBus.addListener(this, "present", async (options: PushOptions | ComponentWithProperties) => {
            if (this.$refs.modalStack === undefined) {
                // Could be a webpack dev server error (HMR) (not fixable) or called too early
                await this.$nextTick()
            }
            if (!(options as any).components) {
                (this.$refs.modalStack as any).present({ components: [options] });
            } else {
                (this.$refs.modalStack as any).present(options)
            }
        })

        CenteredMessage.addListener(this, async (centeredMessage) => {
            if (this.$refs.modalStack === undefined) {
                // Could be a webpack dev server error (HMR) (not fixable) or called too early
                await this.$nextTick()
            }
            (this.$refs.modalStack as any).present({
                components: [
                    new ComponentWithProperties(CenteredMessageView, { centeredMessage }).setDisplayStyle("overlay")
                ]
            })
        })
    }
		
}
</script>

<style lang="scss">
// We need to include the component styling of vue-app-navigation first
@use "@stamhoofd/scss/main";
@import "@stamhoofd/scss/base/dark-modus";
@import "@simonbackx/vue-app-navigation/dist/main.css";
</style>
