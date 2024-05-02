<template>
    <div class="st-view pack-edit-view">
        <STNavigationBar :title="isNew ? 'Nieuwe tegoed toevoegen' : 'Tegoed bewerken'">
            <template #left>
                <BackButton v-if="canPop" @click="pop" />
            </template>
            <template #right>
                <button v-if="!isNew" class="button text" @click="deleteMe">
                    <span class="icon trash" />
                    <span>Verwijderen</span>
                </button>
                <button v-if="!canPop" class="button icon close gray" @click="pop" />
            </template>
        </STNavigationBar>

        <main>
            <h1 v-if="isNew">
                Nieuwe tegoed toevoegen
            </h1>
            <h1 v-else>
                Tegoed bewerken
            </h1>

            <STErrorsDefault :error-box="errorBox" />

            <STInputBox title="Beschrijving" error-fields="description" :error-box="errorBox" class="full">
                <input v-model="description" class="input">
            </STInputBox>

            <STInputBox title="Waarde" error-fields="change" :error-box="errorBox">
                <PriceInput v-model="change" :min="null" />
            </STInputBox>

            <Checkbox v-model="enableExpireAt">
                Vervaldatum toevoegen
            </Checkbox>

            <Checkbox v-model="allowTransactions">
                Mag gebruikt worden voor transactiekosten
            </Checkbox>

            <div v-if="expireAt !== null" class="split-inputs">
                <STInputBox title="Vervalt op" error-fields="expireAt" :error-box="errorBox">
                    <DateSelection v-model="expireAt" />
                </STInputBox>
                <TimeInput v-model="expireAt" title="Tijdstip" :validator="validator" />
            </div>
        </main>

        <STToolbar>
            <template #right>
                <button class="button secundary" @click="cancel">
                    Annuleren
                </button>
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
import { AutoEncoderPatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton,CenteredMessage, Checkbox,DateSelection, ErrorBox, LoadingButton, PriceInput, STErrorsDefault,STInputBox, STList, STListItem, STNavigationBar, STToolbar, TimeInput, Validator } from "@stamhoofd/components";
import { OrganizationSummary, STBillingStatus, STCredit, Version } from '@stamhoofd/structures';
import { Component, Mixins,Prop } from "@simonbackx/vue-app-navigation/classes";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        PriceInput,
        LoadingButton,
        BackButton,
        STList,
        STListItem,
        Checkbox,
        DateSelection,
        TimeInput
    },
})
export default class EditCreditView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false

    /**
     * Pass all the changes we made back when we save this category
     */
    @Prop({ required: true })
    saveHandler: ((patch: AutoEncoderPatchType<OrganizationSummary>) => Promise<void>);

    @Prop({ required: true })
    credit: STCredit

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

    get patchedCredit() {
        const c = this.patchedOrganization.billingStatus.credits.find(c => c.id == this.credit.id)
        if (c) {
            return c
        }
        return this.credit
    }

    addOrganizationPatch(patch: AutoEncoderPatchType<OrganizationSummary> ) {
        if (this.saving) {
            return
        }
        this.patchOrganization = this.patchOrganization.patch(patch)
    }

    addPatch(patch: AutoEncoderPatchType<STCredit> ) {
        if (this.saving) {
            return
        }

        const p = STBillingStatus.patch({})
        patch.id = this.credit.id
        p.credits.addPatch(patch)

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

        if (!await CenteredMessage.confirm("Ben je zeker dat je dit tegoed wilt verwijderen?", "Verwijderen")) {
            return
        }
        const bs = STBillingStatus.patch({})
        bs.credits.addDelete(this.credit.id)
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

    get description() {
        return this.patchedCredit.description
    }

    set description(description: string) {
        this.addPatch(STCredit.patch({
            description
        }))
    }

    get change() {
        return this.patchedCredit.change
    }

    set change(change: number) {
        this.addPatch(STCredit.patch({
            change
        }))
    }

    get expireAt() {
        return this.patchedCredit.expireAt
    }

    set expireAt(expireAt: Date | null) {
        this.addPatch(STCredit.patch({
            expireAt
        }))
    }

    get enableExpireAt() {
        return this.patchedCredit.expireAt !== null
    }

    set enableExpireAt(enableExpireAt: boolean) {
        if (enableExpireAt === this.enableExpireAt) {
            return
        }
        if (enableExpireAt) {
            this.expireAt = new Date()
        } else {
            this.expireAt = null
        }
    }

    get allowTransactions() {
        return this.patchedCredit.allowTransactions
    }

    set allowTransactions(allowTransactions: boolean) {
        this.addPatch(STCredit.patch({
            allowTransactions
        }))
    }
}
</script>
