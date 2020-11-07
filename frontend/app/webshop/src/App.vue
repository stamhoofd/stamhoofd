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
import { PromiseView, ToastBox } from '@stamhoofd/components';
import { NetworkManager } from '@stamhoofd/networking';
import { OrganizationWithWebshop } from '@stamhoofd/structures';
import { Component, Vue } from "vue-property-decorator";

import { WebshopManager } from './classes/WebshopManager';
import CheckoutSteps from './views/CheckoutSteps.vue';
import InvalidWebshopView from './views/errors/InvalidWebshopView.vue';
import OrderView from './views/orders/OrderView.vue';
import WebshopView from './views/WebshopView.vue';

function hexToHSL(H) {
	// Convert hex to RGB first
	let r: any = 0, g: any = 0, b: any = 0;
	if (H.length == 4) {
		r = "0x" + H[1] + H[1];
		g = "0x" + H[2] + H[2];
		b = "0x" + H[3] + H[3];
	} else if (H.length == 7) {
		r = "0x" + H[1] + H[2];
		g = "0x" + H[3] + H[4];
		b = "0x" + H[5] + H[6];
	}
	// Then to HSL
	r /= 255;
	g /= 255;
	b /= 255;
	let cmin = Math.min(r,g,b),
        cmax = Math.max(r,g,b),
        delta = cmax - cmin,
        h = 0,
        s = 0,
        l = 0;

	if (delta == 0)
		h = 0;
	else if (cmax == r)
		h = ((g - b) / delta) % 6;
	else if (cmax == g)
		h = (b - r) / delta + 2;
	else
		h = (r - g) / delta + 4;

	h = Math.round(h * 60);

	if (h < 0)
		h += 360;

	l = (cmax + cmin) / 2;
	s = delta == 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
	s = +(s * 100).toFixed(1);
	l = +(l * 100).toFixed(1);

	return { h, s, l}
}

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
                const path = window.location.pathname.substring(1).split("/");
                const response = await NetworkManager.server.request({
                    method: "GET",
                    path: "/webshop-from-domain",
                    query: {
                        domain: window.location.hostname,
                        uri: path[0] ?? null
                    },
                    decoder: OrganizationWithWebshop as Decoder<OrganizationWithWebshop>
                })

                WebshopManager.organization = response.data.organization
                WebshopManager.webshop = response.data.webshop

                document.title = WebshopManager.webshop.meta.name +" - "+WebshopManager.organization.name

                // Set color
                if (WebshopManager.organization.meta.color) {
                    document.documentElement.style.setProperty("--color-primary", WebshopManager.organization.meta.color)

                    // Do color manipulation here
                    let { h, s, l } = hexToHSL(WebshopManager.organization.meta.color.substring(1));
                    // Modify s + l
                    l = 97
                    s = 100
                    
                    const primaryBackground = "hsl(" + h + "," + s + "%," + l + "%)";
                    document.documentElement.style.setProperty("--color-primary-background", primaryBackground)
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
