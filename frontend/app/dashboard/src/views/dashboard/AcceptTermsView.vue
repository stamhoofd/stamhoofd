<template>
    <SaveView title="Aangepaste overeenkomsten" :loading="loading" @save="save">
        <h1>
            Bekijk de aangepaste overeenkomsten
        </h1>

        <p>
            We hebben een wijziging aangebracht in onze algemene voorwaarden, privacyvoorwaarden en verwerkingsovereenkomst. Bekijk deze eerst en accepteer de nieuwe overeenkomsten voor je verder gaat.
        </p>
        <STErrorsDefault :error-box="errorBox" />

        <Checkbox v-model="acceptPrivacy" class="long-text">
            Ik heb kennis genomen van <a class="inline-link" :href="'https://'+$t('shared.domains.marketing')+'/terms/privacy'" target="_blank">het privacybeleid</a>.
        </Checkbox>

        <Checkbox v-model="acceptTerms" class="long-text">
            Ik heb <a class="inline-link" :href="'https://'+$t('shared.domains.marketing')+'/terms/algemene-voorwaarden'" target="_blank">de algemene voorwaarden</a> gelezen en ga hiermee akkoord in naam van mijn vereniging.
        </Checkbox>

        <Checkbox v-model="acceptDataAgreement" class="long-text">
            Ik heb <a class="inline-link" :href="'https://'+$t('shared.domains.marketing')+'/terms/verwerkersovereenkomst'" target="_blank">de verwerkersovereenkomst</a> gelezen en ga hiermee akkoord in naam van mijn vereniging.
        </Checkbox>
    </SaveView>
</template>

<script lang="ts">
import { SimpleError } from "@simonbackx/simple-errors";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, ErrorBox, SaveView, STErrorsDefault } from "@stamhoofd/components";
import { Organization, OrganizationMetaData } from "@stamhoofd/structures";
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from "../../classes/OrganizationManager";


@Component({
    components: {
        SaveView,
        Checkbox,
        STErrorsDefault
    },
})
export default class AcceptTermsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null

    acceptPrivacy = false
    acceptTerms = false
    acceptDataAgreement = false
    loading = false

    async save() {
        if (this.loading) {
            return
        }

        try {
            this.loading = true
            this.errorBox = null


            if (!this.acceptPrivacy) {
                throw new SimpleError({
                    code: "read_privacy",
                    message: "Je moet kennis hebben genomen van het privacybeleid."
                })
            }

            if (!this.acceptTerms) {
                throw new SimpleError({
                    code: "read_privacy",
                    message: "Je moet akkoord gaan met de algemene voorwaarden."
                })
            }

            if (!this.acceptDataAgreement) {
                throw new SimpleError({
                    code: "read_privacy",
                    message: "Je moet akkoord gaan met de verwerkersovereenkomst."
                })
            }

            await OrganizationManager.patch(
                Organization.patch({
                    id: OrganizationManager.organization.id,
                    meta: OrganizationMetaData.patch({
                        lastSignedTerms: new Date()
                    })
                }), 
                false
            )
            this.pop({ force: true })
        } catch (e) {
            this.loading = false
            console.error(e)
            this.errorBox = new ErrorBox(e)
            return;
        }
    }

    shouldNavigateAway() {
        if (STAMHOOFD.environment === "development") {
            return true
        }
        new CenteredMessage("Je moet de nieuwe overeenkomsten eerst accepteren.").addCloseButton().show()
        return false
    }
}
</script>
