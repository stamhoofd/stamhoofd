<template>
    <div class="st-view invalid-page-view">
        <main>
            <h1>
                Doorverwijzen...
            </h1>

            <p>Bezig met doorverwijzen</p>
        </main>

        <div class="legal-footer">
            <hr class="style-hr">
            <div>
                <aside>
                    <a :href="'https://'+$domains.marketing" class="inline-link secundary" target="_blank">
                        {{ $t('9f1a0032-32dd-48fd-9d04-0b20bd86aefb') }}
                    </a>
                </aside>
                <div>
                    <a :href="'https://'+$domains.marketing+'/webshops'">Webshop via <Logo /></a>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";
import { Logo } from "@stamhoofd/components";

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
