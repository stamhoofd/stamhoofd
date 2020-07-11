<template>
    <div id="app">
        <ModalStackComponent ref="modalStack" :root="root" />
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, HistoryManager,ModalStackComponent, SplitViewController } from "@simonbackx/vue-app-navigation";
import { AuthenticatedView } from '@stamhoofd/components';
import { Component, Vue } from "vue-property-decorator";

import DashboardMenu from './views/dashboard/DashboardMenu.vue';
import OrganizationSelectionSteps from './views/login/OrganizationSelectionSteps.vue';
import OrganizationSelectionView from './views/login/OrganizationSelectionView.vue';

// kick off the polyfill!
//smoothscroll.polyfill();
@Component({
    components: {
        ModalStackComponent
    },
})
export default class App extends Vue {
    root = new ComponentWithProperties(AuthenticatedView, {
        root: new ComponentWithProperties(SplitViewController, {root: new ComponentWithProperties(DashboardMenu, {})}),
        loginRoot: new ComponentWithProperties(OrganizationSelectionSteps, { 
            root: new ComponentWithProperties(OrganizationSelectionView, {}) 
        })
    })

    mounted() {
         HistoryManager.activate();

        const path = window.location.pathname;
        const parts = path.substring(1).split("/");

        if (parts.length == 1 && parts[0] == 'create-organization') {
            // todo: go to create organization page
            /*(this.$refs.modalStack as any).present(new ComponentWithProperties(NavigationController, { 
                root: new ComponentWithProperties(CreateShop, {})
            }));*/
        }

        if (parts.length == 1 && parts[0] == 'reset-password') {
            // tood: password reset view
            /*(this.$refs.modalStack as any).present(new ComponentWithProperties(NavigationController, { 
                root: new ComponentWithProperties(ForgotPasswordResetView, {})
            }));*/
        }
    }
}
</script>

<style lang="scss">
// We need to include the component styling of vue-app-navigation first
@use "~@stamhoofd/scss/main";
@import "~@simonbackx/vue-app-navigation/dist/main.css";
</style>
