<template>
    <div id="records-settings-view" class="st-view background">
        <STNavigationBar title="Eigen kenmerken en gegevens">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-else slot="right" class="button icon close gray" @click="pop" />
        </STNavigationBar>

        <main>
            <h1>
                Eigen kenmerken en gegevens
            </h1>
            <p>Je kan zelf kiezen welke extra informatie je van jouw leden wilt verzamelen. Stamhoofd heeft enkele ingebouwde zaken, maar je kan de informatie die je wilt verzamelen zo veel uitbreiden als je wilt.</p>

           
            
            <STErrorsDefault :error-box="errorBox" />

            <hr>
            <h2>Ingebouwde gegevens</h2>

            <p>Bepaalde gegevens van leden zijn ingebouwd in Stamhoofd zodat we die ook op een speciale manier kunnen verwerken. Gebruik deze en voeg deze zaken niet zelf toe als vragen!</p>

            <hr>
            <h2>Eigen kenmerken/gegevens</h2>

            <p>
                Voeg zelf kenmerken toe die ingevuld kunnen worden bij het inschrijven of enkel door beheerders (kan je zelf kiezen). Hieronder kan je de kenmerken toevoegen op bepaalde plaatsen, maar je kan ook een nieuwe categorie maken en die bijvoorbeeld koppelen aan specifieke inschrijvingsgroepen zodat ze enkel daar gevraagd worden.
            </p>
        </main>

        <STToolbar>
            <template slot="right">
                <LoadingButton :loading="saving">
                    <button class="button primary" @click="save">
                        Opslaan
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { HistoryManager, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, CenteredMessage, Checkbox, ErrorBox, LoadingButton, PriceInput,Radio, RadioGroup, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, Toast, Validator } from "@stamhoofd/components";
import { Organization, OrganizationPatch, Version } from "@stamhoofd/structures"
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from "../../../../../classes/OrganizationManager"

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        Checkbox,
        RadioGroup,
        Radio,
        BackButton,
        LoadingButton,
        PriceInput
    },
})
export default class RecordsSettingsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false

    // Make it reactive
    OrganizationManager = OrganizationManager

    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({ id: OrganizationManager.organization.id })

    get patchedOrganization() {
        return OrganizationManager.organization.patch(this.organizationPatch)
    }

    

    async save() {
        if (this.saving) {
            return;
        }

        const errors = new SimpleErrors()
      
        let valid = false

        if (errors.errors.length > 0) {
            this.errorBox = new ErrorBox(errors)
        } else {
            this.errorBox = null
            valid = true
        }
        valid = valid && await this.validator.validate()

        if (!valid) {
            return;
        }

        this.saving = true

        try {
            await OrganizationManager.patch(this.organizationPatch)
            this.organizationPatch = OrganizationPatch.create({ id: OrganizationManager.organization.id })
            new Toast('De wijzigingen zijn opgeslagen', "success green").show()
            this.dismiss({ force: true })
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }

        this.saving = false
    }

    async shouldNavigateAway() {
        if (!patchContainsChanges(this.organizationPatch, OrganizationManager.organization, { version: Version })) {
            return true;
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }
   
    mounted() {
        HistoryManager.setUrl("/settings/records");
    }
}
</script>
