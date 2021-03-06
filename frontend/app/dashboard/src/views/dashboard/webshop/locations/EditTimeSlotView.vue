<template>
    <div class="st-view product-price-edit-view">
        <STNavigationBar :title="isNew ? 'Tijdsvak toevoegen' : 'Tijdsvak bewerken'">
            <template slot="right">
                <button class="button text" v-if="!isNew" @click="deleteMe">
                    <span class="icon trash"/>
                    <span>Verwijderen</span>
                </button>
                <button class="button icon close gray" @click="pop" />
            </template>
        </STNavigationBar>

        <main>
            <h1 v-if="isNew">
                Tijdsvak toevoegen
            </h1>
            <h1 v-else>
                Tijdsvak bewerken
            </h1>
          
            <STErrorsDefault :error-box="errorBox" />

            <STInputBox title="Datum" error-fields="date" :error-box="errorBox">
                <DateSelection v-model="date"/>
            </STInputBox>

            <TimeMinutesInput title="Van" :validator="validator" v-model="startTime" />
            <TimeMinutesInput title="Tot" :validator="validator" v-model="endTime" />
        </main>

        <STToolbar>
            <template slot="right">
                <button class="button secundary" @click="cancel">
                    Annuleren
                </button>
                <button class="button primary" @click="save">
                    Opslaan
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, PartialWithoutMethods, PatchableArray, PatchableArrayAutoEncoder, patchContainsChanges } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, STList, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, DateSelection, Validator, CenteredMessage, TimeMinutesInput } from "@stamhoofd/components";
import { Category, Group, GroupGenderType, GroupPatch, GroupPrices, GroupSettings, GroupSettingsPatch, Organization, PrivateWebshop, Product, ProductPrice, Version, WaitingListType, Webshop, WebshopTimeSlot, WebshopTimeSlots } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        TimeMinutesInput,
        DateSelection,
        STList
    },
})
export default class EditTimeSlotView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Prop({ required: true })
    timeSlot!: WebshopTimeSlot

    patchTimeSlot: AutoEncoderPatchType<WebshopTimeSlot> = WebshopTimeSlot.patch({ id: this.timeSlot.id })

    /**
     * If we can immediately save this product, then you can create a save handler and pass along the changes.
     */
    @Prop({ required: true })
    saveHandler: ((patch: AutoEncoderPatchType<WebshopTimeSlots>) => void);

    get patchedTimeSlot() {
        return this.timeSlot.patch(this.patchTimeSlot)
    }

    get isNew() {
        return false
    }

    get date() {
        return this.patchedTimeSlot.date
    }

    set date(date: Date) {
        this.addPatch(WebshopTimeSlot.patch({ date }))
    }

    get startTime() {
        return this.patchedTimeSlot.startTime
    }

    set startTime(startTime: number) {
        this.addPatch(WebshopTimeSlot.patch({ startTime }))
    }

    get endTime() {
        return this.patchedTimeSlot.endTime
    }

    set endTime(endTime: number) {
        this.addPatch(WebshopTimeSlot.patch({ endTime }))
    }


    addPatch(patch: AutoEncoderPatchType<WebshopTimeSlot>) {
        this.patchTimeSlot = this.patchTimeSlot.patch(patch)
    }

    async save() {
        if (!await this.validator.validate()) {
            return;
        }
        const p = WebshopTimeSlots.patch({})
        p.timeSlots.addPatch(this.patchTimeSlot)
        this.saveHandler(p)
        this.pop({ force: true })
    }

    async deleteMe() {
        if (!await CenteredMessage.confirm("Ben je zeker dat je dit tijdsvak wilt verwijderen?", "Verwijderen")) {
            return
        }
       const p = WebshopTimeSlots.patch({})
        p.timeSlots.addDelete(this.timeSlot.id)
        this.saveHandler(p)
        this.pop({ force: true })
    }

    cancel() {
        this.pop()
    }

    isChanged() {
        return patchContainsChanges(this.patchTimeSlot, this.timeSlot, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.isChanged()) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/text-styles.scss" as *;


</style>
