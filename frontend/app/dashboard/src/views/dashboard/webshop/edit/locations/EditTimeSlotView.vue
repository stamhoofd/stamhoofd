<template>
    <SaveView :title="isNew ? 'Tijdvak toevoegen' : 'Tijdvak bewerken'" :disabled="!hasChanges && !isNew" @save="save">
        <h1 v-if="isNew">
            Tijdvak toevoegen
        </h1>
        <h1 v-else>
            Tijdvak bewerken
        </h1>
          
        <STErrorsDefault :error-box="errorBox" />

        <STInputBox title="Datum" error-fields="date" :error-box="errorBox">
            <DateSelection v-model="date" />
        </STInputBox>

        <TimeMinutesInput v-model="startTime" title="Van" :validator="validator" />
        <TimeMinutesInput v-model="endTime" title="Tot" :validator="validator" />

        <STInputBox error-fields="maxOrders" title="Maximum aantal bestellingen" :error-box="errorBox">
            <NumberInput v-model="maxOrders" :required="false" placeholder="Geen limiet" />
        </STInputBox>
        <p v-if="remainingOrders !== null && remainingOrders !== maxOrders" class="style-description">
            Nog {{ remainingOrders }} bestellingen
        </p>

        <STInputBox error-fields="maxPersons" title="Maximum aantal personen" :error-box="errorBox">
            <NumberInput v-model="maxPersons" :required="false" placeholder="Geen limiet" />
        </STInputBox>
        <p v-if="remainingPersons !== null && remainingPersons !== maxPersons" class="style-description">
            Nog {{ remainingPersons }} personen
        </p>

        <div v-if="!isNew" class="container">
            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>Verwijderen</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoderPatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, DateSelection, ErrorBox, NumberInput, SaveView, STErrorsDefault, STInputBox, TimeMinutesInput, Validator } from "@stamhoofd/components";
import { PrivateWebshop, ProductType, Version, WebshopTimeSlot, WebshopTimeSlots } from "@stamhoofd/structures";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";

@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        TimeMinutesInput,
        DateSelection,
        Checkbox,
        NumberInput
    },
})
export default class EditTimeSlotView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Prop({ required: true })
    timeSlot!: WebshopTimeSlot

    @Prop({ required: true })
    isNew!: boolean

    @Prop({ required: true })
    webshop: PrivateWebshop

    patchTimeSlot: AutoEncoderPatchType<WebshopTimeSlot> = WebshopTimeSlot.patch({ id: this.timeSlot.id })

    /**
     * If we can immediately save this product, then you can create a save handler and pass along the changes.
     */
    @Prop({ required: true })
    saveHandler: ((patch: AutoEncoderPatchType<WebshopTimeSlots>) => void);

    get patchedTimeSlot() {
        return this.timeSlot.patch(this.patchTimeSlot)
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

    // Stock
    get remainingOrders() {
        return this.patchedTimeSlot.remainingOrders
    }

    get maxOrders() {
        return this.patchedTimeSlot.maxOrders
    }

    set maxOrders(maxOrders: number | null) {
        this.patchTimeSlot = this.patchTimeSlot.patch({ maxOrders })
    }

    get remainingPersons() {
        return this.patchedTimeSlot.remainingPersons
    }

    get maxPersons() {
        return this.patchedTimeSlot.maxPersons
    }

    set maxPersons(maxPersons: number | null) {
        this.patchTimeSlot = this.patchTimeSlot.patch({ maxPersons })
    }

    addPatch(patch: AutoEncoderPatchType<WebshopTimeSlot>) {
        this.patchTimeSlot = this.patchTimeSlot.patch(patch)
    }

    async save() {
        if (!await this.validator.validate()) {
            return;
        }

        try {
            if (this.patchedTimeSlot.maxPersons !== null && !this.webshop.products.find(p => p.type === ProductType.Person)) {
                throw new SimpleError({
                    code: "invalid_field",
                    field: "maxPersons",
                    message: "Je hebt geen enkel artikel in jouw webshop met type 'Personen'. Het maximum aantal voor personen werkt dan niet. Voeg eerst een product toe aan je webshop met type 'Personen'."
                })
            }
        } catch (e) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            this.errorBox = new ErrorBox(e)
            return
        }
        const p = WebshopTimeSlots.patch({})
        p.timeSlots.addPatch(this.patchTimeSlot)
        this.saveHandler(p)
        this.pop({ force: true })
    }

    async deleteMe() {
        if (!await CenteredMessage.confirm("Ben je zeker dat je dit tijdvak wilt verwijderen?", "Verwijderen")) {
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

    get hasChanges() {
        return patchContainsChanges(this.patchTimeSlot, this.timeSlot, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    
}
</script>