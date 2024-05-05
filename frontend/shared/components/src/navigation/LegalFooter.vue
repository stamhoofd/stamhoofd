<template>
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
                
                <template v-for="policy in policies" :key="policy.id">
                    -
                    <a :href="policy.calculatedUrl" class="inline-link secundary" rel="nofollow noreferrer noopener" target="_blank">
                        {{ policy.name }}
                    </a>
                </template>

                <template v-if="privacyUrl">
                    -
                </template>

                <a v-if="privacyUrl" :href="privacyUrl" class="inline-link secundary" rel="nofollow noreferrer noopener" target="_blank">
                    Privacyvoorwaarden
                </a>

                <template v-if="isLoggedIn">
                    -
                </template>

                <button v-if="isLoggedIn" class="inline-link secundary" type="button" @click="logout">
                    Uitloggen
                </button>

                <br>
                {{ organization.meta.companyAddress || organization.address }}
            </aside>
            <div>
                <a v-if="hasTickets" :href="'https://'+$t('shared.domains.marketing')+'?utm_medium=webshop'">Verkoop ook tickets via <Logo /></a>
                <a v-else-if="isWebshop" :href="'https://'+$t('shared.domains.marketing')+'?utm_medium=webshop'">Bouw je betaalbare webshop via <Logo /></a>
                <a v-else :href="'https://'+$t('shared.domains.marketing')+'/ledenadministratie?utm_medium=ledenportaal'">Ledenadministratie via <Logo /></a>
            </div>
        </div>
    </div>
</template>


<script lang="ts">
import { SessionManager } from "@stamhoofd/networking";
import { Organization, Webshop, WebshopTicketType } from "@stamhoofd/structures";
import { Component, Prop, Vue } from "@simonbackx/vue-app-navigation/classes";

import Logo from "../icons/Logo.vue";
import { CenteredMessage } from "../overlays/CenteredMessage";

@Component({
    components: {
        Logo
    }
})
export default class LegalFooter extends Vue {
    @Prop({ required: true })
        organization!: Organization;

    @Prop({ required: false, default: null })
        webshop!: Webshop | null;

    get isLoggedIn() {
        return this.$context.isComplete() ?? false
    }

    async logout() {
        if (!(await CenteredMessage.confirm('Wil je uitloggen?', 'Ja, uitloggen', 'Hiermee zal je worden afgemeld.'))) {
            return
        }
        await this.$context.logout()
    }

    get privacyUrl() {
        if (this.webshop && this.webshop.meta.policies.length > 0) {
            return null
        }
        if (this.organization.meta.privacyPolicyUrl) {
            return this.organization.meta.privacyPolicyUrl
        }
        if (this.organization.meta.privacyPolicyFile) {
            return this.organization.meta.privacyPolicyFile.getPublicPath()
        }
        return null
    }

    get policies() {
        return this.webshop?.meta.policies ?? []
    }

    get hasTickets() {
        return this.webshop?.meta.ticketType === WebshopTicketType.Tickets
    }

    get isWebshop() {
        return !!this.webshop
    }
}
</script>
