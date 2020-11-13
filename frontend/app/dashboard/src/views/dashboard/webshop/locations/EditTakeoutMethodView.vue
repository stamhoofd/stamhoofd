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

            <div class="split-inputs">
                <div>
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
                </div>
                <div>
                    <AddressInput v-model="address" title="Adres" :validator="validator" :required="true" />
                </div>
            </div>

            <EditTimeSlotsSection :time-slots="patchedTakeoutMethod.timeSlots" title="Keuze uit afhaalintervallen" @patch="patchTimeSlots">
                <p>Je kan tijdsintervallen toevoegen waartussen men de bestelling kan afhalen. Als je er geen toevoegt, dan moet er geen keuze gemaakt worden (bv. als je het elke week kan afhalen na activiteiten). Als je afhalen organiseert op één tijdstip, dan raden we je aan om hier één tijdstip toe te voegen (dan moet er nog steeds geen keuze gemaakt worden, maar dan kunnen we dit tijdstip duidelijk communiceren in de bestelbevestiging).</p>
            </EditTimeSlotsSection>
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
import { AddressInput, CenteredMessage, Checkbox, DateSelection, ErrorBox, NumberInput, Radio, RadioGroup, SegmentedControl, Spinner,STErrorsDefault,STInputBox, STList, STNavigationBar, STToolbar, UploadButton, Validator } from "@stamhoofd/components";
import { Address, AnyCheckoutMethodPatch, Image, OptionMenu, PrivateWebshop, Product, ProductPrice, ResolutionFit, ResolutionRequest, Version, WebshopMetaData, WebshopTakeoutMethod, WebshopTimeSlot, WebshopTimeSlots } from "@stamhoofd/structures"
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
        AddressInput,
        Radio,
        Checkbox,
        NumberInput,
        Spinner,
        UploadButton,
        STList,
        EditTimeSlotsSection
    },
})
export default class EditTakeoutMethodView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Prop({ required: true })
    takeoutMethod!: WebshopTakeoutMethod

    @Prop({ required: true })
    webshop: PrivateWebshop

    patchTakeoutMethod: AutoEncoderPatchType<WebshopTakeoutMethod> = WebshopTakeoutMethod.patch({ id: this.takeoutMethod.id })

    /**
     * If we can immediately save this product, then you can create a save handler and pass along the changes.
     */
    @Prop({ required: true })
    saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => void;

    get patchedTakeoutMethod() {
        return this.takeoutMethod.patch(this.patchTakeoutMethod)
    }

    get isNew() {
        return this.takeoutMethod.name.length == 0
    }

    get name() {
        return this.patchedTakeoutMethod.name
    }

    set name(name: string) {
        this.patchTakeoutMethod = this.patchTakeoutMethod.patch({ name })
    }

    get address() {
        return this.patchedTakeoutMethod.address
    }

    set address(address: Address) {
        this.patchTakeoutMethod = this.patchTakeoutMethod.patch({ address })
    }

    get description() {
        return this.patchedTakeoutMethod.description
    }

    set description(description: string) {
        this.patchTakeoutMethod = this.patchTakeoutMethod.patch({ description })
    }

    addPatch(patch: AutoEncoderPatchType<WebshopTakeoutMethod>) {
        this.patchTakeoutMethod = this.patchTakeoutMethod.patch(patch)
    }
   
    patchTimeSlots(patch: AutoEncoderPatchType<WebshopTimeSlots>) {
        this.addPatch(WebshopTakeoutMethod.patch({ timeSlots: patch }))
    }
  
    async save() {
        if (!await this.validator.validate()) {
            return;
        }
        const p = PrivateWebshop.patch({})
        const meta = WebshopMetaData.patch({})
        meta.checkoutMethods.addPatch(this.patchTakeoutMethod)
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
        meta.checkoutMethods.addDelete(this.takeoutMethod.id)
        p.meta = meta
        this.saveHandler(p)
        this.pop({ force: true })
    }

    cancel() {
        this.pop()
    }

    isChanged() {
        return patchContainsChanges(this.patchTakeoutMethod, this.takeoutMethod, { version: Version })
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
