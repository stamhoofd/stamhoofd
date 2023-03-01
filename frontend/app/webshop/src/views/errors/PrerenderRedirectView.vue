<template>
    <div class="st-view invalid-page-view">
        <main>
            <h1>
                Deze webshop bestaat niet
            </h1>

            <p>Kijk even na of de link klopt of probeer later opnieuw.</p>
        </main>

        <div class="legal-footer">
            <hr class="style-hr">
            <div>
                <aside>
                    <a :href="'https://'+$t('shared.domains.marketing')" class="inline-link secundary" target="_blank">
                        Terug naar Stamhoofd
                    </a>
                </aside>
                <div>
                    <a :href="'https://'+$t('shared.domains.marketing')+'/webshops'">Webshop via <Logo /></a>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Logo } from "@stamhoofd/components"
import { Component, Mixins, Prop } from "vue-property-decorator";

@Component({
    components: {
        Logo
    },
    metaInfo() {
        return {
            meta: [
                {
                    hid: `prerender-status-code`,
                    name: 'prerender-status-code',
                    content: "301"
                },
                {
                    hid: `prerender-header-location`,
                    name: 'prerender-header',
                    content: "Location: "+this.location
                },
                {
                    hid: `prerender-header-cache`,
                    name: 'prerender-header',
                    content: "Cache-Control: no-cache"
                }
            ]
        }
    }

})
export default class PrerenderRedirectView extends Mixins(NavigationMixin){
    @Prop({ required: true })
        location: string
}
</script>