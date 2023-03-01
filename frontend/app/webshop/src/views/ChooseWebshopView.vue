<template>
    <section class="st-view boxed choose-webshop-view">
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

        <div class="box">
            <div class="st-view">
                <main v-if="webshops.length > 0">
                    <h1>Onze webshops</h1>

                    <STList>
                        <STListItem v-for="webshop of webshops" :key="webshop.id" element-name="a" :selectable="true" :href="'https://'+webshop.getUrl(organization)">
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
                <main v-else>
                    <h1>Onze webshops</h1>
                    <p class="info-box">
                        We organiseren momenteel helaas geen verkopen. Kom later nog eens terug.
                    </p>
                </main>
            </div>
        </div>

        <div class="legal-footer">
            <hr class="style-hr">
            <div>
                <aside>
                    {{ organization.meta.companyName || organization.name }}{{ organization.meta.VATNumber || organization.meta.companyNumber ? (", "+(organization.meta.VATNumber || organization.meta.companyNumber)) : "" }}
                    <template v-if="organization.website">
                        -
                    </template>
                    <a v-if="organization.website" :href="organization.website" class="inline-link secundary" rel="nofollow noreferrer noopener" target="_blank">
                        Website
                    </a>

                    <br>
                    {{ organization.meta.companyAddress || organization.address }}
                </aside>
                <div>
                    <a :href="'https://'+$t('shared.domains.marketing')+'/webshops'">Webshops via <Logo /></a>
                </div>
            </div>
        </div>
    </section>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Logo,OrganizationLogo, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components";
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
        Logo
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