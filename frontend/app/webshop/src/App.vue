<template>
    <div id="app">
        <!--<ModalStackComponent id="app" ref="modalStack" :root="root" />-->
        <ComponentWithPropertiesInstance :component="root" />
        <ToastBox />
    </div>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, ComponentWithPropertiesInstance, HistoryManager,ModalStackComponent } from "@simonbackx/vue-app-navigation";
import { ColorHelper, PromiseView, ToastBox } from '@stamhoofd/components';
import { NetworkManager } from '@stamhoofd/networking';
import { OrganizationWithWebshop } from '@stamhoofd/structures';
import { Component, Vue } from "vue-property-decorator";

import { WebshopManager } from './classes/WebshopManager';
import CheckoutSteps from './views/CheckoutSteps.vue';
import InvalidWebshopView from './views/errors/InvalidWebshopView.vue';
import OrderView from './views/orders/OrderView.vue';
import WebshopView from './views/WebshopView.vue';

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
                const ignorePath = ["checkout", "order", "cart"];
                const path = window.location.pathname.substring(1).split("/");
                const response = await NetworkManager.server.request({
                    method: "GET",
                    path: "/webshop-from-domain",
                    query: {
                        domain: window.location.hostname,
                        uri: path[0] && !ignorePath.includes(path[0]) ? path[0] : null
                    },
                    decoder: OrganizationWithWebshop as Decoder<OrganizationWithWebshop>
                })

                WebshopManager.organization = response.data.organization
                WebshopManager.webshop = response.data.webshop

                document.title = WebshopManager.webshop.meta.name +" - "+WebshopManager.organization.name

                // Set color
                if (WebshopManager.organization.meta.color) {
                    ColorHelper.setColor(WebshopManager.organization.meta.color)
                }

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
