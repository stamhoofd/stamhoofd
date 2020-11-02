<template>
    <div id="app">
        <!--<ModalStackComponent id="app" ref="modalStack" :root="root" />-->
        <ComponentWithPropertiesInstance :component="root"/>
        <ToastBox />
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, HistoryManager,ModalStackComponent, SplitViewController, ComponentWithPropertiesInstance, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AuthenticatedView, CenteredMessage, CenteredMessageView, PromiseView, ToastBox } from '@stamhoofd/components';
import { Component, Vue } from "vue-property-decorator";
import { NetworkManager, SessionManager, Session } from '@stamhoofd/networking';
import { Organization } from '@stamhoofd/structures';
import { Decoder } from '@simonbackx/simple-encoding';
import CheckoutSteps from './views/CheckoutSteps.vue';
import WebshopView from '../../dashboard/src/views/dashboard/webshop/WebshopView.vue';
import InvalidWebshopView from './views/errors/InvalidWebshopView.vue';

@Component({
    components: {
        ComponentWithPropertiesInstance,
        ToastBox
    },
})
export default class App extends Vue {
    root = new ComponentWithProperties(PromiseView, {
        promise: async () => {
            // get organization
            try {
                const response = await NetworkManager.server.request({
                    method: "GET",
                    path: "/organization-from-domain",
                    query: {
                        domain: window.location.hostname
                    },
                    decoder: Organization as Decoder<Organization>
                })

                // Set organization and session
                const session = new Session(response.data.id)
                session.setOrganization(response.data)

                document.title = response.data.name+" - Webshop"

                // Set color
                if (response.data.meta.color) {
                    console.log("Set color "+response.data.meta.color)
                    document.documentElement.style.setProperty("--color-primary", response.data.meta.color)
                }

                await SessionManager.setCurrentSession(session)

                return new ComponentWithProperties(ModalStackComponent, {
                    root: new ComponentWithProperties(CheckoutSteps, { 
                        root: new ComponentWithProperties(WebshopView, {}) 
                    })
                })

            } catch (e) {
                return new ComponentWithProperties(InvalidWebshopView, {})
            }
        }
    })

    mounted() {
        HistoryManager.activate();
    }
    
}
</script>

<style lang="scss">
// We need to include the component styling of vue-app-navigation first
@use "~@stamhoofd/scss/main";
@import "~@simonbackx/vue-app-navigation/dist/main.css";
</style>
