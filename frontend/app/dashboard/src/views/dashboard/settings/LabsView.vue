<template>
    <SaveView :loading="saving" title="Experimenten" :disabled="!hasChanges" @save="save">
        <h1>
            Experimenten
        </h1>

        <p>Hier kan je functies aanzetten die we nog aan het uittesten zijn, of functies die enkel voor geavanceerdere gebruikers nodig zijn.</p>
        
        <STErrorsDefault :error-box="errorBox" />

        <hr>
        <h2>Extra betaalproviders</h2>

        <Checkbox v-model="forcePayconiq">
            Payconiq (via API-key)
        </Checkbox>

        <Checkbox v-if="!enableBuckaroo" key="mollie" v-model="forceMollie">
            Mollie
        </Checkbox>

        <!--<hr>
        <h2>Nieuwe functies</h2>

        <STList>
            <STListItem element-name="label" :selectable="true">
                <Checkbox slot="left" :checked="getFeatureFlag('documents')" @change="setFeatureFlag('documents', !!$event)" />
                <h3 class="style-title-list">
                    Documenten
                </h3>
                <p class="style-description-small">
                    Maak het fiscaal attest voor kinderopvang aan (publiceren voorlopig uitgeschakeld).
                </p>
            </STListItem>
        </STList>
        -->

        <div v-if="isStamhoofd" key="stamhoofd-settings" class="container">
            <hr>
            <h2>
                Instellingen beheerd door Stamhoofd
            </h2>

            <Checkbox v-model="useTestPayments">
                Activeer test-modus voor betalingen
            </Checkbox>

            <Checkbox :checked="getFeatureFlag('stripe-multiple')" @change="setFeatureFlag('stripe-multiple', !!$event)">
                Meerdere Stripe accounts toestaan
            </Checkbox>

            <Checkbox v-model="enableBuckaroo">
                Gebruik Buckaroo voor online betalingen
            </Checkbox>
            <div v-if="enableBuckaroo" class="split-inputs">
                <div>
                    <STInputBox title="Key" error-fields="buckarooSettings.key" :error-box="errorBox" class="max">
                        <input
                            v-model="buckarooKey"
                            class="input"
                            type="text"
                            placeholder="Key"
                        >
                    </STInputBox>
                    <p class="style-description-small">
                        Buckaroo Plaza > Mijn Buckaroo > Websites > Algemeen > Key
                    </p>
                </div>
                <div>
                    <STInputBox title="Secret" error-fields="buckarooSettings.secret" :error-box="errorBox" class="max">
                        <input
                            v-model="buckarooSecret"
                            class="input"
                            type="text"
                            placeholder="Secret"
                        >
                    </STInputBox>
                    <p class="style-description-small">
                        Buckaroo Plaza > Configuratie > Beveiliging > Secret Key
                    </p>
                </div>
            </div>

            <EditPaymentMethodsBox v-if="enableBuckaroo" :methods="buckarooPaymentMethods" :organization="organization" :show-prices="false" :choices="buckarooAvailableMethods" @patch="patchBuckarooPaymentMethods" />
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
import EditPaymentMethodsBox from '../../../components/EditPaymentMethodsBox.vue';

@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        STList,
        STListItem,
        Checkbox,
        EditPaymentMethodsBox,
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

    patchBuckarooPaymentMethods(patch: PatchableArray<PaymentMethod, PaymentMethod, PaymentMethod>) {
        this.organizationPatch = this.organizationPatch.patch({
            privateMeta: OrganizationPrivateMetaData.patch({
                buckarooSettings: BuckarooSettings.patch({
                    paymentMethods: patch
                })
            })
        })
    }

    get enableBuckaroo() {
        return (this.organization.privateMeta?.buckarooSettings ?? null) !== null
    }

    set enableBuckaroo(enable: boolean) {
        this.organizationPatch = this.organizationPatch.patch({
            privateMeta: OrganizationPrivateMetaData.patch({
                buckarooSettings: enable ? BuckarooSettings.create({}) : null
            })
        })
    }

    get buckarooKey() {
        return this.organization.privateMeta?.buckarooSettings?.key ?? ""
    }

    set buckarooKey(key: string) {
        this.organizationPatch = this.organizationPatch.patch({
            privateMeta: OrganizationPrivateMetaData.patch({
                buckarooSettings: BuckarooSettings.patch({
                    key
                })
            })
        })
    }

    get buckarooSecret() {
        return this.organization.privateMeta?.buckarooSettings?.secret ?? ""
    }

    set buckarooSecret(secret: string) {
        this.organizationPatch = this.organizationPatch.patch({
            privateMeta: OrganizationPrivateMetaData.patch({
                buckarooSettings: BuckarooSettings.patch({
                    secret
                })
            })
        })
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

    get buckarooPaymentMethods() {
        return this.organization.privateMeta?.buckarooSettings?.paymentMethods ?? []
    }

    get buckarooAvailableMethods() {
        return [PaymentMethod.Bancontact, PaymentMethod.CreditCard, PaymentMethod.iDEAL, PaymentMethod.Payconiq]
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