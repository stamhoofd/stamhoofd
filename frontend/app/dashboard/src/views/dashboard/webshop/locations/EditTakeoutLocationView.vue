<template>
    <div class="st-view product-edit-view">
        <STNavigationBar title="Afhaallocatie">
            <template slot="right">
                <button v-if="!isNew" class="button text" @click="deleteMe">
                    <span class="icon trash" />
                    <span>Verwijderen</span>
                </button>
                <button class="button icon close gray" @click="pop" />
            </template>
        </STNavigationBar>

        <main>
            <h1 v-if="isNew">
                Afhaallocatie toevoegen
            </h1>
            <h1 v-else>
                Afhaallocatie bewerken
            </h1>
        
            <STErrorsDefault :error-box="errorBox" />
            <STInputBox title="Locatienaam" error-fields="name" :error-box="errorBox">
                <input
                    ref="firstInput"
                    v-model="name"
                    class="input"
                    type="text"
                    placeholder="bv. kantine"
                    autocomplete=""
                >
            </STInputBox>

            <STInputBox title="Beschrijving" error-fields="description" :error-box="errorBox" class="max">
                <textarea
                    v-model="description"
                    class="input"
                    type="text"
                    placeholder="Hier kan je eventeel afhaalinstructies kwijt (optioneel)"
                    autocomplete=""
                />
            </STInputBox>

            <EditTimeSlotsSection :timeSlots="patchedTakeoutLocation.timeSlots" @patch="patchTimeSlots" />
        
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
import { AutoEncoderPatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, DateSelection, ErrorBox, PriceInput, Radio, RadioGroup, SegmentedControl, NumberInput, Spinner,STErrorsDefault,STInputBox, STList, STNavigationBar, STToolbar, UploadButton, Validator } from "@stamhoofd/components";
import { Image, OptionMenu, PrivateWebshop, Product, ProductPrice, ResolutionFit, ResolutionRequest, Version, WebshopMetaData, WebshopTakeoutLocation, WebshopTimeSlot, WebshopTimeSlots } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";
import EditTimeSlotsSection from "./EditTimeSlotsSection.vue"

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        SegmentedControl,
        DateSelection,
        RadioGroup,
        PriceInput,
        Radio,
        Checkbox,
        NumberInput,
        Spinner,
        UploadButton,
        STList,
        EditTimeSlotsSection
    },
})
export default class EditTakeoutLocationView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Prop({ required: true })
    takeoutLocation!: WebshopTakeoutLocation

    @Prop({ required: true })
    webshop: PrivateWebshop

    patchTakeoutLocation: AutoEncoderPatchType<WebshopTakeoutLocation> = WebshopTakeoutLocation.patch({ id: this.takeoutLocation.id })

    /**
     * If we can immediately save this product, then you can create a save handler and pass along the changes.
     */
    @Prop({ required: true })
    saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => void;

    get patchedTakeoutLocation() {
        return this.takeoutLocation.patch(this.patchTakeoutLocation)
    }

    get isNew() {
        return this.takeoutLocation.name.length == 0
    }

    get name() {
        return this.patchedTakeoutLocation.name
    }

    set name(name: string) {
        this.patchTakeoutLocation = this.patchTakeoutLocation.patch({ name })
    }

    get description() {
        return this.patchedTakeoutLocation.description
    }

    set description(description: string) {
        this.patchTakeoutLocation = this.patchTakeoutLocation.patch({ description })
    }

    addPatch(patch: AutoEncoderPatchType<WebshopTakeoutLocation>) {
        this.patchTakeoutLocation = this.patchTakeoutLocation.patch(patch)
    }
   
    patchTimeSlots(patch: AutoEncoderPatchType<WebshopTimeSlots>) {
        this.addPatch(WebshopTakeoutLocation.patch({ timeSlots: patch }))
    }
  
    save() {
        const p = PrivateWebshop.patch({})
        const meta = WebshopMetaData.patch({})
        meta.takeoutLocations.addPatch(this.patchTakeoutLocation)
        p.meta = meta
        this.saveHandler(p)
        this.pop({ force: true })
    }

    async deleteMe() {
        if (!await CenteredMessage.confirm("Ben je zeker dat je deze afhaallocatie wilt verwijderen?", "Verwijderen")) {
            return
        }

        const p = PrivateWebshop.patch({})
        const meta = WebshopMetaData.patch({})
        meta.takeoutLocations.addDelete(this.takeoutLocation.id)
        p.meta = meta
        this.saveHandler(p)
        this.pop({ force: true })
    }

    cancel() {
        this.pop()
    }

    isChanged() {
        return patchContainsChanges(this.patchTakeoutLocation, this.takeoutLocation, { version: Version })
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
@use "@stamhoofd/scss/base/variables.scss" as *;


</style>
