<template>
    <section class="st-view box-shade choose-webshop-view">
        <STNavigationBar :large="true">
            <template slot="left">
                <OrganizationLogo :organization="organization" />
            </template>

            <template slot="right">
                <a v-if="organization.website" class="button text limit-space" :href="organization.website" target="_blank" rel="nofollow noreferrer noopener">
                    <span class="icon external" />
                    <span>Terug naar website</span>
                </a>
            </template>
        </STNavigationBar>

        <main class="with-legal">
            <div v-if="webshops.length > 0" class="box">
                <main>
                    <h1>Onze webshops</h1>

                    <STList>
                        <STListItem v-for="webshop of webshops" :key="webshop.id" element-name="a" :selectable="true" :href="'https://'+webshop.getUrl(organization)" class="left-center">
                            <img v-if="webshop.meta.hasTickets" slot="left" src="~@stamhoofd/assets/images/illustrations/tickets.svg" class="style-illustration-img">
                            <img v-else slot="left" src="~@stamhoofd/assets/images/illustrations/cart.svg" class="style-illustration-img">
                            <h3 class="style-title-list">
                                {{ webshop.meta.name }}
                            </h3>
                            <p class="style-description-small style-limit-lines">
                                {{ webshop.meta.description }}
                            </p>

                            <span slot="right" class="icon arrow-right-small gray" />
                        </STListItem>
                    </STList>
                </main>
            </div>
            <div v-else class="box">
                <main>
                    <h1>Onze webshops</h1>
                    <p class="info-box">
                        We organiseren momenteel helaas geen verkopen. Kom later nog eens terug.
                    </p>
                </main>
            </div>

            <LegalFooter :organization="organization" :webshop="webshops[0]" />
        </main>
    </section>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { LegalFooter,OrganizationLogo, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { Organization, WebshopPreview } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        OrganizationLogo,
        LegalFooter
    },
    filters: {
        price: Formatter.price.bind(Formatter),
        time: Formatter.time.bind(Formatter)
    },
    metaInfo() {
        return {
            title: this.organization.name + " - Webshops",
            meta: [
                {
                    vmid: 'description',
                    name: 'description',
                    content: "Kies een webshop om door te gaan",
                },
                {
                    hid: 'og:site_name',
                    name: 'og:site_name',
                    content: this.organization.name
                }
            ]
        }
    }
})
export default class ChooseWebshopView extends Mixins(NavigationMixin){
    @Prop({ required: true })
        organization!: Organization;

    @Prop({ required: true })
        webshops!: WebshopPreview[];
      

}
</script>