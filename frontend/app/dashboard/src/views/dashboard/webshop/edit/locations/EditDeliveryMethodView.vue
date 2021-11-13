<template>
    <div class="st-view product-edit-view">
        <STNavigationBar title="Leveringsoptie">
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
                Leveringsoptie toevoegen
            </h1>
            <h1 v-else>
                Leveringsoptie bewerken
            </h1>
        
            <STErrorsDefault :error-box="errorBox" />

            <STInputBox title="Leveringsnaam" error-fields="name" :error-box="errorBox">
                <input
                    ref="firstInput"
                    v-model="name"
                    class="input"
                    type="text"
                    :placeholder="$t('dashboard.webshop.deliveryMethod.name.placeholder')"
                    autocomplete=""
                >
            </STInputBox>

            <STInputBox title="Beschrijving" error-fields="description" :error-box="errorBox" class="max">
                <textarea
                    v-model="description"
                    class="input"
                    type="text"
                    placeholder="Hier kan je eventeel leveringsinformatie kwijt (optioneel)"
                    autocomplete=""
                />
            </STInputBox>
            <EditDeliveryRegionsSection :delivery-method="patchedDeliveryMethod" @patch="addPatch" />

            <EditTimeSlotsSection :time-slots="patchedDeliveryMethod.timeSlots" title="Keuze uit leveringstijdstip" @patch="patchTimeSlots">
                <p>Je kan tijdsintervallen toevoegen waartussen je de bestelling aan huis kan leveren. Als je er geen toevoegt, dan moet er geen keuze gemaakt worden (bv. via post versturen). Als je leveren organiseert op één tijdstip, dan raden we je aan om hier één tijdstip toe te voegen (dan moet er nog steeds geen keuze gemaakt worden, maar dan kunnen we dit tijdstip duidelijk communiceren in de bestelbevestiging).</p>
            </EditTimeSlotsSection>

            <hr>
            <h2>Leveringskost</h2>
            <CheckoutMethodPriceBox :checkout-method-price="patchedDeliveryMethod.price" :error-box="errorBox" @patch="patchPrice" />
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
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AddressInput, CenteredMessage, Checkbox, DateSelection, ErrorBox, NumberInput, Radio, RadioGroup, SegmentedControl, Spinner,STErrorsDefault,STInputBox, STList, STNavigationBar, STToolbar, UploadButton, Validator } from "@stamhoofd/components";
import { CheckoutMethodPrice,PrivateWebshop, Version, WebshopDeliveryMethod, WebshopMetaData, WebshopTimeSlots } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";

import CheckoutMethodPriceBox from "./CheckoutMethodPriceBox.vue"
import EditDeliveryRegionsSection from "./EditDeliveryRegionsSection.vue"
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
        EditTimeSlotsSection,
        CheckoutMethodPriceBox,
        EditDeliveryRegionsSection
    },
})
export default class EditDeliveryMethodView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Prop({ required: true })
    deliveryMethod!: WebshopDeliveryMethod

    @Prop({ required: true })
    webshop: PrivateWebshop

    patchDeliveryMethod: AutoEncoderPatchType<WebshopDeliveryMethod> = WebshopDeliveryMethod.patch({ id: this.deliveryMethod.id })

    /**
     * If we can immediately save this product, then you can create a save handler and pass along the changes.
     */
    @Prop({ required: true })
    saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => void;

    get patchedDeliveryMethod() {
        return this.deliveryMethod.patch(this.patchDeliveryMethod)
    }

    get isNew() {
        return this.deliveryMethod.name.length == 0
    }

    get name() {
        return this.patchedDeliveryMethod.name
    }

    set name(name: string) {
        this.patchDeliveryMethod = this.patchDeliveryMethod.patch({ name })
    }

    get description() {
        return this.patchedDeliveryMethod.description
    }

    set description(description: string) {
        this.patchDeliveryMethod = this.patchDeliveryMethod.patch({ description })
    }

    addPatch(patch: AutoEncoderPatchType<WebshopDeliveryMethod>) {
        this.patchDeliveryMethod = this.patchDeliveryMethod.patch(patch)
    }
   
    patchTimeSlots(patch: AutoEncoderPatchType<WebshopTimeSlots>) {
        this.addPatch(WebshopDeliveryMethod.patch({ timeSlots: patch }))
    }

    patchPrice(patch: AutoEncoderPatchType<CheckoutMethodPrice>) {
        this.addPatch(WebshopDeliveryMethod.patch({ price: patch }))
    }
  
    async save() {
        if (!await this.validator.validate()) {
            return;
        }
        const p = PrivateWebshop.patch({})
        const meta = WebshopMetaData.patch({})
        meta.checkoutMethods.addPatch(this.patchDeliveryMethod)
        p.meta = meta
        this.saveHandler(p)
        this.pop({ force: true })
    }

    async deleteMe() {
        if (!await CenteredMessage.confirm("Ben je zeker dat je deze leveringsoptie wilt verwijderen?", "Verwijderen")) {
            return
        }

        const p = PrivateWebshop.patch({})
        const meta = WebshopMetaData.patch({})
        meta.checkoutMethods.addDelete(this.deliveryMethod.id)
        p.meta = meta
        this.saveHandler(p)
        this.pop({ force: true })
    }

    cancel() {
        this.pop()
    }

    isChanged() {
        return patchContainsChanges(this.patchDeliveryMethod, this.deliveryMethod, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.isChanged()) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    
}
</script>

