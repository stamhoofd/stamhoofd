<template>
    <SaveView :title="isNew ? 'Tijdvak toevoegen' : 'Tijdvak bewerken'" :loading="saving" :disabled="!hasChanges && !isNew" @save="save">
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

        <div v-if="!isNew" class="container">
            <hr>
            <h2>
                Verwijder dit tijdsvak
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>Verwijderen</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoderPatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, DateSelection, ErrorBox, SaveView, STErrorsDefault, STInputBox, TimeMinutesInput, Validator } from "@stamhoofd/components";
import { Version, WebshopTimeSlot, WebshopTimeSlots } from "@stamhoofd/structures";
import { Component, Mixins, Prop } from "vue-property-decorator";

@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        TimeMinutesInput,
        DateSelection
    },
})
export default class EditTimeSlotView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Prop({ required: true })
    timeSlot!: WebshopTimeSlot

    @Prop({ required: true })
    isNew!: boolean

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