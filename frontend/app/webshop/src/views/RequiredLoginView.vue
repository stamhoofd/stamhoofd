<template>
    <LoadingView v-if="loading" />
    <section v-else class="st-view box-shade">
        <STNavigationBar :large="true">
            <template #left>
                <OrganizationLogo :organization="organization" />
            </template>

            <template #right>
                <a v-if="organization.website" class="button text limit-space" :href="organization.website" target="_blank" rel="nofollow noreferrer noopener">
                    <span class="icon external" />
                    <span>Terug naar website</span>
                </a>
            </template>
        </STNavigationBar>

        <main>
            <div class="box">
                <main>
                    <h1>Inloggen</h1>
                    <p>
                        Om deze pagina te bekijken moet je eerst inloggen via onderstaande knop.
                    </p>

                    <p>
                        <button type="button" class="button primary" @click="login">
                            Inloggen
                        </button>
                    </p>
                </main>
            </div>
        </main>
    </section>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { LoadingView, Logo, OrganizationLogo, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { UrlHelper } from "@stamhoofd/networking";
import { LoginProviderType } from "@stamhoofd/structures";
import { Component, Mixins } from "vue-property-decorator";

import { WebshopManager } from "../classes/WebshopManager";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        OrganizationLogo,
        Logo,
        LoadingView
    },
    metaInfo() {
        return {
            title: this.organization.name + " - Inloggen",
            meta: [
                {
                    vmid: 'description',
                    name: 'description',
                    content: "Log in om door te gaan",
                },
                {
                    hid: 'og:site_name',
                    name: 'og:site_name',
                    content: this.organization.name
                }, 
                {
                    // Prevent indexing login page
                    name: 'robots',
                    content: 'noindex'
                }
            ]
        }
    }
})
export default class RequiredLoginView extends Mixins(NavigationMixin){
    WebshopManager = WebshopManager
    loading = false

    get organization() {
        return this.$webshopManager.organization
    }
    
    get webshop() {
        return this.$webshopManager.webshop
    }

    mounted() {
        // Try to log in on first load
        try {
            const search = UrlHelper.initial.getSearchParams();
            if (!sessionStorage.getItem('triedLogin') && !search.get('error') && !search.get('oid_rt')) {
                sessionStorage.setItem('triedLogin', "true")
                this.login().catch(console.error)
            }
        } catch (e) {
            console.error(e)
        }
    }

    async login() {
        if (this.loading) {
            return
        }

        await this.$context.startSSO({
            webshopId: this.webshop.id,
            providerType: LoginProviderType.SSO
        })
        this.loading = true
    }
}
</script>