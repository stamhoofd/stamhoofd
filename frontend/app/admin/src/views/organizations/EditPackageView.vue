<template>
    <div class="st-view pack-edit-view">
        <STNavigationBar :title="isNew ? 'Nieuw pakket toevoegen' : 'Pakket bewerken'" :disableDismiss="canPop">
            <template #right>
                <button v-if="!isNew" class="button text" @click="deleteMe">
                    <span class="icon trash" />
                    <span>Verwijderen</span>
                </button>
            </template>
        </STNavigationBar>

        <main>
            <h1 v-if="isNew">
                Nieuw pakket toevoegen
            </h1>
            <h1 v-else>
                Pakket bewerken
            </h1>

            <STErrorsDefault :error-box="errorBox" />

            <STInputBox title="Type" error-fields="type" :error-box="errorBox">
                <Dropdown v-model="type">
                    <option v-for="type in types" :key="type" :value="type">
                        {{ getTypeName(type) }}
                    </option>
                </Dropdown>
            </STInputBox>

            <div class="split-inputs">
                <STInputBox title="Startdatum" error-fields="settings.startDate" :error-box="errorBox">
                    <DateSelection v-model="startDate" />
                </STInputBox>
                <TimeInput v-model="startDate" title="Vanaf welk tijdstip" :validator="validator" /> 
            </div>

            <Checkbox v-model="enableEndDate">
                Einddatum toevoegen
            </Checkbox>

            <div v-if="endDate !== null" class="split-inputs">
                <STInputBox title="Einddatum" error-fields="settings.endDate" :error-box="errorBox">
                    <DateSelection v-model="endDate" />
                </STInputBox>
                <TimeInput v-model="endDate" title="Tot welk tijdstip" :validator="validator" />
            </div>

            <Checkbox v-model="enableRemoveAt">
                Vervaldatum toevoegen
            </Checkbox>

            <div v-if="removeAt !== null" class="split-inputs">
                <STInputBox title="Vervaldatum" error-fields="settings.removeAt" :error-box="errorBox">
                    <DateSelection v-model="removeAt" />
                </STInputBox>
                <TimeInput v-model="removeAt" title="Tot welk tijdstip" :validator="validator" />
            </div>
            <p v-if="removeAt !== null" class="style-description-small">
                Verlengen is nog mogelijk tot aan de vervaldatum. Het pakket blijft ook zichtbaar tot aan de vervaldatum
            </p>

            <div class="split-inputs">
                <STInputBox title="Prijs" error-fields="unitPrice" :error-box="errorBox">
                    <PriceInput v-model="unitPrice" />
                </STInputBox>
                <STInputBox title="Prijs type" error-fields="pricingType" :error-box="errorBox">
                    <Dropdown v-model="pricingType">
                        <option v-for="type in pricingTypes" :key="type" :value="type">
                            {{ getPricingTypeName(type) }}
                        </option>
                    </Dropdown>
                </STInputBox>
            </div>

            <Checkbox v-model="allowRenew">
                Verlengbaar
            </Checkbox>
            <Checkbox v-model="canDeactivate">
                Opzegbaar
            </Checkbox>

            <STInputBox title="Minimum aantal stuks" error-fields="minimumAmount" :error-box="errorBox">
                <NumberInput v-model="minimumAmount" />
            </STInputBox>

            <STInputBox title="Betaald aantal stuks" error-fields="paidAmount" :error-box="errorBox">
                <NumberInput v-model="paidAmount" />
            </STInputBox>

            <STInputBox title="Betaalde prijs" error-fields="paidPrice" :error-box="errorBox">
                <PriceInput v-model="paidPrice" />
            </STInputBox>

            <Checkbox v-model="enableFailedPayment">
                Mislukte betaling toevoegen
            </Checkbox>

            <div v-if="firstFailedPayment !== null" class="split-inputs">
                <STInputBox title="Eerste mislukte betaling" error-fields="settings.endDate" :error-box="errorBox">
                    <DateSelection v-model="firstFailedPayment" />
                </STInputBox>
                <TimeInput v-model="firstFailedPayment" title="Tot welk tijdstip" :validator="validator" />
            </div>
        </main>

        <STToolbar>
            <template #right>
                <button class="button secundary" type="button" @click="cancel">
                    Annuleren
                </button>
                <LoadingButton :loading="saving">
                    <button class="button primary" type="button" @click="save">
                        Opslaan
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoderPatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton,CenteredMessage, Checkbox, DateSelection, Dropdown,ErrorBox, LoadingButton, NumberInput, PriceInput, Radio, STErrorsDefault,STInputBox, STList, STListItem, STNavigationBar, STToolbar, TimeInput, Validator } from "@stamhoofd/components";
import { OrganizationSummary, STBillingStatus, STPackage, STPackageMeta, STPackageType, STPackageTypeHelper, STPricingType, Version } from '@stamhoofd/structures';
import { Component, Mixins,Prop } from "@simonbackx/vue-app-navigation/classes";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        DateSelection,
        PriceInput,
        Radio,
        Checkbox,
        LoadingButton,
        TimeInput,
        BackButton,
        STList,
        STListItem,
        NumberInput,
        Dropdown
    },
})
export default class EditPackageView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false

    /**
     * Pass all the changes we made back when we save this category
     */
    @Prop({ required: true })
        saveHandler: ((patch: AutoEncoderPatchType<OrganizationSummary>) => Promise<void>);

    @Prop({ required: true })
        pack: STPackage

    @Prop({ required: true })
        organization!: OrganizationSummary
    patchOrganization: AutoEncoderPatchType<OrganizationSummary> = OrganizationSummary.patch({
        id: this.organization.id
    })

    @Prop({ required: true })
        isNew: boolean

    get patchedOrganization() {
        return this.organization.patch(this.patchOrganization)
    }

    get patchedPackage() {
        const c = this.patchedOrganization.billingStatus.packages.find(c => c.id == this.pack.id)
        if (c) {
            return c
        }
        return this.pack
    }

    addOrganizationPatch(patch: AutoEncoderPatchType<OrganizationSummary> ) {
        if (this.saving) {
            return
        }
        this.patchOrganization = this.patchOrganization.patch(patch)
    }

    addPatch(patch: AutoEncoderPatchType<STPackage> ) {
        if (this.saving) {
            return
        }

        const p = STBillingStatus.patch({})
        patch.id = this.pack.id
        p.packages.addPatch(patch)

        this.patchOrganization = this.patchOrganization.patch({
            billingStatus: p
        })
    }

    // Saving

    async save() {
        if (this.saving) {
            return
        }

        const valid = await this.validator.validate()

        if (!valid) {
            return;
        }
        this.saving = true

        let patch = this.patchOrganization
        this.errorBox = null

        try {
            await this.saveHandler(patch)
            this.pop({ force: true })
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }

        this.saving = false
    }

    async deleteMe() {
        if (this.saving) {
            return
        }

        if (!await CenteredMessage.confirm("Ben je zeker dat je dit pakket wilt verwijderen?", "Verwijderen")) {
            return
        }
        const bs = STBillingStatus.patch({})
        bs.packages.addDelete(this.pack.id)
        const p = OrganizationSummary.patch({ billingStatus: bs })

        this.errorBox = null
        this.saving = true

        try {
            await this.saveHandler(p)
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }

        this.saving = false

        this.pop({ force: true })
    }

    cancel() {
        this.pop()
    }

    isChanged() {
        return patchContainsChanges(this.patchOrganization, this.organization, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.isChanged()) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    get type() {
        return this.patchedPackage.meta.type
    }

    set type(type: STPackageType) {
        this.addPatch(STPackage.patch({
            meta: STPackageMeta.patch({
                type
            })
        }))
    }

    get pricingType() {
        return this.patchedPackage.meta.pricingType
    }

    set pricingType(pricingType: STPricingType) {
        this.addPatch(STPackage.patch({
            meta: STPackageMeta.patch({
                pricingType
            })
        }))
    }

    get canDeactivate() {
        return this.patchedPackage.meta.canDeactivate
    }

    set canDeactivate(canDeactivate: boolean) {
        this.addPatch(STPackage.patch({
            meta: STPackageMeta.patch({
                canDeactivate
            })
        }))
    }

    get allowRenew() {
        return this.patchedPackage.meta.allowRenew
    }

    set allowRenew(allowRenew: boolean) {
        this.addPatch(STPackage.patch({
            meta: STPackageMeta.patch({
                allowRenew
            })
        }))
    }

    get unitPrice() {
        return this.patchedPackage.meta.unitPrice
    }

    set unitPrice(unitPrice: number) {
        this.addPatch(STPackage.patch({
            meta: STPackageMeta.patch({
                unitPrice
            })
        }))
    }

    get minimumAmount() {
        return this.patchedPackage.meta.minimumAmount
    }

    set minimumAmount(minimumAmount: number) {
        this.addPatch(STPackage.patch({
            meta: STPackageMeta.patch({
                minimumAmount
            })
        }))
    }    

    get paidPrice() {
        return this.patchedPackage.meta.paidPrice
    }

    set paidPrice(paidPrice: number) {
        this.addPatch(STPackage.patch({
            meta: STPackageMeta.patch({
                paidPrice
            })
        }))
    }

    get paidAmount() {
        return this.patchedPackage.meta.paidAmount
    }

    set paidAmount(paidAmount: number) {
        this.addPatch(STPackage.patch({
            meta: STPackageMeta.patch({
                paidAmount
            })
        }))
    }

    get startDate() {
        return this.patchedPackage.meta.startDate
    }

    set startDate(startDate: Date) {
        this.addPatch(STPackage.patch({
            meta: STPackageMeta.patch({
                startDate
            })
        }))
    }

    get enableEndDate() {
        return this.endDate !== null
    }

    set enableEndDate(enable: boolean) {
        if (enable === this.enableEndDate) {
            return
        }
        if (enable) {
            this.endDate = new Date()
        } else {
            this.endDate = null
        }
    }

    get endDate() {
        return this.patchedPackage.validUntil
    }

    set endDate(endDate: Date | null) {
        this.addPatch(STPackage.patch({
            validUntil: endDate
        }))
    }

    get enableRemoveAt() {
        return this.removeAt !== null
    }

    set enableRemoveAt(enable: boolean) {
        if (enable === this.enableRemoveAt) {
            return
        }
        if (enable) {
            this.removeAt = new Date()
        } else {
            this.removeAt = null
        }
    }

    get removeAt() {
        return this.patchedPackage.removeAt
    }

    set removeAt(removeAt: Date | null) {
        this.addPatch(STPackage.patch({
            removeAt
        }))
    }

    get enableFailedPayment() {
        return this.firstFailedPayment !== null
    }

    set enableFailedPayment(enable: boolean) {
        if (enable === this.enableFailedPayment) {
            return
        }
        if (enable) {
            this.firstFailedPayment = new Date()
            this.addPatch(STPackage.patch({
                meta: STPackageMeta.patch({
                    paymentFailedCount: Math.max(this.patchedPackage.meta.paymentFailedCount, 1)
                })
            }))

        } else {
            this.firstFailedPayment = null
            this.addPatch(STPackage.patch({
                meta: STPackageMeta.patch({
                    paymentFailedCount: 0
                })
            }))
        }
    }

    get firstFailedPayment() {
        return this.patchedPackage.meta.firstFailedPayment
    }

    set firstFailedPayment(firstFailedPayment: Date | null) {
        this.addPatch(STPackage.patch({
            meta: STPackageMeta.patch({
                firstFailedPayment
            })
        }))
    }

    get types() {
        return Object.values(STPackageType)
    }

    get pricingTypes() {
        return Object.values(STPricingType)
    }

    getTypeName(type: STPackageType) {
        return STPackageTypeHelper.getName(type)
    }

    getPricingTypeName(type: STPricingType) {
        switch (type) {
            case STPricingType.Fixed: return "Eénmalig"
            case STPricingType.PerYear: return "Per jaar"
            case STPricingType.PerMember: return "Per lid, per jaar"
        }
    }

}
</script>
