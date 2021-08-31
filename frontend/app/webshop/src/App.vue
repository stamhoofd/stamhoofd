<template>
    <div id="app">
        <!--<ComponentWithPropertiesInstance :component="root" />-->
        <ModalStackComponent ref="modalStack" :root="root" />
        <ToastBox />
    </div>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, HistoryManager,ModalStackComponent, NavigationController } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, CenteredMessageView, ColorHelper, PromiseView, ToastBox } from '@stamhoofd/components';
import { NetworkManager, UrlHelper } from '@stamhoofd/networking';
import { OrganizationWithWebshop } from '@stamhoofd/structures';
import { Component, Vue } from "vue-property-decorator";

import { WebshopManager } from './classes/WebshopManager';
import InvalidWebshopView from './views/errors/InvalidWebshopView.vue';
import WebshopView from './views/WebshopView.vue';

@Component({
    components: {
        ModalStackComponent,
        ToastBox
    },
})
export default class App extends Vue {
    root = new ComponentWithProperties(PromiseView, {
        promise: async () => {
            // get organization
            try {
                const ignorePath = ["checkout", "order", "cart", "payment", "tickets"];
                const path = UrlHelper.shared.getParts()
                const response = await NetworkManager.server.request({
                    method: "GET",
                    path: "/webshop-from-domain",
                    query: {
                        domain: window.location.hostname,
                        uri: path[0] && !ignorePath.includes(path[0]) ? path[0] : ''
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

                return new ComponentWithProperties(NavigationController, { 
                    root: new ComponentWithProperties(WebshopView, {}) 
                })

            } catch (e) {
                return new ComponentWithProperties(InvalidWebshopView, {})
            }
        }
    })

    created() {
        if (process.env.NODE_ENV == "development") {
            ComponentWithProperties.debug = true
        }
        HistoryManager.activate();
    }

    mounted() {
        CenteredMessage.addListener(this, async (centeredMessage) => {
            if (this.$refs.modalStack === undefined) {
                // Could be a webpack dev server error (HMR) (not fixable) or called too early
                await this.$nextTick()
            }
            (this.$refs.modalStack as any).present(new ComponentWithProperties(CenteredMessageView, { centeredMessage }).setDisplayStyle("overlay"))
        })
    }
		
}
</script>

<style lang="scss">
// We need to include the component styling of vue-app-navigation first
@use "~@stamhoofd/scss/main";
@import "~@simonbackx/vue-app-navigation/dist/main.css";
</style>
