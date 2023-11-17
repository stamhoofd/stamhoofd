<template>
    <SaveView :loading="saving" title="Experimenten" :disabled="!hasChanges" @save="save">
        <h1>
            Experimenten
        </h1>

        <p>Hier kan je functies aanzetten die we nog aan het uittesten zijn, of functies die enkel voor geavanceerdere gebruikers nodig zijn.</p>
        
        <STErrorsDefault :error-box="errorBox" />

        <hr>
        <h2>Extra betaalproviders</h2>

        <Checkbox v-if="!enableBuckaroo" key="mollie" v-model="forceMollie">
            Mollie
        </Checkbox>

        <div v-if="isStamhoofd" key="stamhoofd-settings" class="container">
            <hr>
            <h2>
                Instellingen beheerd door Stamhoofd
            </h2>

            <Checkbox v-model="useTestPayments">
                Activeer test-modus voor betalingen
            </Checkbox>

            <Checkbox :checked="getFeatureFlag('stamhoofd-pay-by-transfer')" @change="setFeatureFlag('stamhoofd-pay-by-transfer', !!$event)">
                Stamhoofd betalen via overschrijving
            </Checkbox>

            <Checkbox :checked="getFeatureFlag('stamhoofd-pay-by-saved')" @change="setFeatureFlag('stamhoofd-pay-by-saved', !!$event)">
                Stamhoofd betalen via opgeslagen betaalmethode
            </Checkbox>

            <Checkbox :checked="getFeatureFlag('sso')" @change="setFeatureFlag('sso', !!$event)">
                Single-Sign-On
            </Checkbox>

            <Checkbox :checked="getFeatureFlag('webshop-auth')" @change="setFeatureFlag('webshop-auth', !!$event)">
                Webshop auth
            </Checkbox>
        </div>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, PatchableArray, patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-networking';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, ErrorBox, SaveView, STErrorsDefault, STInputBox, STList, STListItem, Toast, Validator } from "@stamhoofd/components";
import { UrlHelper } from '@stamhoofd/networking';
import { BuckarooSettings, Country, Organization, OrganizationPatch, OrganizationPrivateMetaData, PaymentMethod, Version } from "@stamhoofd/structures";
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager";

@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        STList,
        STListItem,
        Checkbox
    },
})
export default class LabsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false
    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({ id: OrganizationManager.organization.id })

    get organization() {
        return OrganizationManager.organization.patch(this.organizationPatch)
    }

    get isBelgium() {
        return this.organization.address.country == Country.Belgium
    }

    get isStamhoofd() {
        return OrganizationManager.user.email.endsWith("@stamhoofd.be") || OrganizationManager.user.email.endsWith("@stamhoofd.nl")
    }

    get enableBuckaroo() {
        return (this.organization.privateMeta?.buckarooSettings ?? null) !== null
    }

    get forceMollie() {
        return this.organization.privateMeta?.featureFlags.includes('forceMollie') ?? false
    }

    set forceMollie(forceMollie: boolean) {
        const featureFlags = this.organization.privateMeta?.featureFlags.filter(f => f !== 'forceMollie') ?? []
        if (forceMollie) {
            featureFlags.push('forceMollie')
        }
        this.organizationPatch = this.organizationPatch.patch({
            privateMeta:  OrganizationPrivateMetaData.patch({
                featureFlags: featureFlags as any
            })
        })
    }

    get forcePayconiq() {
        return this.getFeatureFlag('forcePayconiq')
    }

    set forcePayconiq(forcePayconiq: boolean) {
        this.setFeatureFlag('forcePayconiq', forcePayconiq)
    }

    getFeatureFlag(flag: string) {
        return this.organization.privateMeta?.featureFlags.includes(flag) ?? false
    }

    setFeatureFlag(flag: string, value: boolean) {
        const featureFlags = this.organization.privateMeta?.featureFlags.filter(f => f !== flag) ?? []
        if (value) {
            featureFlags.push(flag)
        }
        this.organizationPatch = this.organizationPatch.patch({
            privateMeta:  OrganizationPrivateMetaData.patch({
                featureFlags: featureFlags as any
            })
        })
    }

    get useTestPayments() {
        return this.organization.privateMeta?.useTestPayments ?? STAMHOOFD.environment != 'production'
    }

    set useTestPayments(useTestPayments: boolean) {
        this.organizationPatch = this.organizationPatch.patch({
            privateMeta: OrganizationPrivateMetaData.patch({
                // Only save non default value
                useTestPayments: STAMHOOFD.environment != 'production' === useTestPayments ? null : useTestPayments
            })
        })
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

    get hasChanges() {
        return patchContainsChanges(this.organizationPatch, OrganizationManager.organization, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true;
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    mounted() {
        // We can clear now
        UrlHelper.shared.clear()
        UrlHelper.setUrl("/settings/labs")
    }

    beforeDestroy() {
        Request.cancelAll(this)
    }

}
</script>