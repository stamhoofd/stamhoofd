<template>
    <SaveView :title="locationTitleName" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1 v-if="isNew">
            {{ locationTitleName }} toevoegen
        </h1>
        <h1 v-else>
            {{ locationTitleName }} bewerken
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

        <EditTimeSlotsSection v-if="isTakeout" :time-slots="patchedTakeoutMethod.timeSlots" title="Datum en tijd + keuze uit afhaalintervallen" @patch="patchTimeSlots">
            <p>Je kan tijdsintervallen toevoegen waartussen men de bestelling kan afhalen. Als je er geen toevoegt, dan moet er geen keuze gemaakt worden (bv. als je het elke week kan afhalen na activiteiten). Als je afhalen organiseert op één tijdstip, dan raden we je aan om hier één tijdstip toe te voegen (dan moet er nog steeds geen keuze gemaakt worden, maar dan kunnen we dit tijdstip duidelijk communiceren in de bestelbevestiging).</p>
        </EditTimeSlotsSection>
        <EditTimeSlotsSection v-else :time-slots="patchedTakeoutMethod.timeSlots" title="Datum en tijd + keuze uit shiften" @patch="patchTimeSlots">
            <p>Je kan tijdsintervallen toevoegen waartussen men de bestelling ter plaatse kan consumeren. Als je er geen toevoegt, dan moet er geen keuze gemaakt worden (afgeraden). Als je jouw evenement organiseert op één tijdstip, dan raden we je aan om hier één tijdstip toe te voegen (dan moet er nog steeds geen keuze gemaakt worden, maar dan kunnen we dit tijdstip duidelijk communiceren in de bestelbevestiging).</p>
        </EditTimeSlotsSection>

        <div v-if="!isNew" class="container">
            <hr>
            <h2>
                Verwijderen
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>Verwijderen</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoderPatchType, PartialWithoutMethods, patchContainsChanges } from '@simonbackx/simple-encoding';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AddressInput, CenteredMessage, ErrorBox, SaveView, STErrorsDefault, STInputBox, STList, Validator } from "@stamhoofd/components";
import { Address, CheckoutMethodType, PrivateWebshop, Version, WebshopMetaData, WebshopOnSiteMethod, WebshopTakeoutMethod, WebshopTimeSlots } from "@stamhoofd/structures";
import { Component, Mixins, Prop } from "vue-property-decorator";

import EditTimeSlotsSection from "./EditTimeSlotsSection.vue";

@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        AddressInput,
        STList,
        EditTimeSlotsSection
    },
})
export default class EditTakeoutMethodView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Prop({ required: true })
    takeoutMethod!: WebshopTakeoutMethod | WebshopOnSiteMethod

    @Prop({ required: true })
    isNew!: boolean

    @Prop({ required: true })
    webshop: PrivateWebshop

    patchTakeoutMethod: AutoEncoderPatchType<WebshopTakeoutMethod | WebshopOnSiteMethod> = this.takeoutMethod.type === CheckoutMethodType.Takeout ? WebshopTakeoutMethod.patch({ id: this.takeoutMethod.id }) : WebshopOnSiteMethod.patch({ id: this.takeoutMethod.id })

    /**
     * If we can immediately save this product, then you can create a save handler and pass along the changes.
     */
    @Prop({ required: true })
    saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => void;

    get isTakeout() {
        return this.takeoutMethod.type === CheckoutMethodType.Takeout
    }

    get locationTitleName() {
        if (this.isTakeout) {
            return "Afhaallocatie"
        }
        return "Ter plaatse consumeren"
    }

    get patchedTakeoutMethod() {
        return this.takeoutMethod.patch(this.patchTakeoutMethod)
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

    addPatch(patch: PartialWithoutMethods<AutoEncoderPatchType<WebshopTakeoutMethod | WebshopOnSiteMethod>>) {
        this.patchTakeoutMethod = this.patchTakeoutMethod.patch(patch)
    }
   
    patchTimeSlots(patch: AutoEncoderPatchType<WebshopTimeSlots>) {
        this.addPatch({ timeSlots: patch })
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
        if (!await CenteredMessage.confirm("Ben je zeker dat je deze locatie wilt verwijderen?", "Verwijderen")) {
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

    get hasChanges() {
        return patchContainsChanges(this.patchTakeoutMethod, this.takeoutMethod, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    
}
</script>

