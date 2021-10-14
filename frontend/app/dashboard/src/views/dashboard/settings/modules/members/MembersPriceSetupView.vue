<template>
    <div id="personalize-settings-view" class="st-view background">
        <STNavigationBar title="Lidgeld">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-else slot="right" class="button icon close gray" @click="pop" />
        </STNavigationBar>

        <main>
            <h1>Standaard inschrijvingsgeld</h1>
            <p>Je kan later nog de prijs per inschrijvingsgroep wijzigen, maar deze prijs zal automatisch ingesteld worden als je nieuwe inschrijvingsgroepen maakt.</p>

            <STErrorsDefault :error-box="errorBox" />

            <EditGroupPriceBox :validator="validator" :prices="getPrices()" @patch="addPricesPatch" />
        </main>

        <STToolbar>
            <template slot="right">
                <LoadingButton :loading="saving">
                    <button class="button primary" @click="save">
                        Volgende
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, PartialWithoutMethods, PatchableArrayAutoEncoder,patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, CenteredMessage, ErrorBox, LoadingButton, STErrorsDefault, STNavigationBar, STToolbar, Toast, Validator} from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { GroupPrices, Organization, OrganizationMetaData, OrganizationPatch, PaymentMethod, STPackageBundle, Version } from "@stamhoofd/structures"
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from "../../../../../classes/OrganizationManager"
import EditGroupPriceBox from '../../../groups/EditGroupPriceBox.vue';
import ActivatedView from './ActivatedView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STErrorsDefault,
        BackButton,
        LoadingButton,
        EditGroupPriceBox
    },
})
export default class MembersPriceSetupView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false
    temp_organization = OrganizationManager.organization

    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({ id: OrganizationManager.organization.id })

    get organization() {
        return OrganizationManager.organization.patch(this.organizationPatch)
    }

    addMetaPatch(patch: PartialWithoutMethods<AutoEncoderPatchType<OrganizationMetaData>> ) {
        this.organizationPatch = this.organizationPatch.patch(OrganizationPatch.create({ 
            meta: OrganizationMetaData.patch(patch)
        }))
    }

    getPrices() {
        return this.organization.meta.defaultPrices
    }

    addPricesPatch(patch: PatchableArrayAutoEncoder<GroupPrices>) {
        this.addMetaPatch({ defaultPrices: patch })
    }

    async checkout(bundle: STPackageBundle) {
        await SessionManager.currentSession!.authenticatedServer.request({
            method: "POST",
            path: "/billing/activate-packages",
            body: {
                bundles: [bundle],
                paymentMethod: PaymentMethod.Unknown
            }
        })
        await SessionManager.currentSession!.fetchOrganization()
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
            await this.checkout(STPackageBundle.TrialMembers)
            this.organizationPatch = OrganizationPatch.create({ id: OrganizationManager.organization.id })
            new Toast('Je kan nu de ledenadministratie uittesten', "success green").show()

            this.show({
                components: [new ComponentWithProperties(ActivatedView)],
                replace: this.navigationController?.components.length,
                force: true
            })
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
}
</script>