<template>
    <SaveView title="Leveringsoptie" :disabled="!hasChanges" @save="save">
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

        <EditTimeSlotsSection :webshop="webshop" :time-slots="patchedDeliveryMethod.timeSlots" title="Keuze uit leveringstijdstip" @patch="patchTimeSlots">
            <p>Je kan tijdsintervallen toevoegen waartussen je de bestelling aan huis kan leveren. Als je er geen toevoegt, dan moet er geen keuze gemaakt worden (bv. via post versturen). Als je leveren organiseert op één tijdstip, dan raden we je aan om hier één tijdstip toe te voegen (dan moet er nog steeds geen keuze gemaakt worden, maar dan kunnen we dit tijdstip duidelijk communiceren in de bestelbevestiging).</p>
        </EditTimeSlotsSection>

        <hr>
        <h2>Leveringskost</h2>
        <CheckoutMethodPriceBox :checkout-method-price="patchedDeliveryMethod.price" :error-box="errorBox" @patch="patchPrice" />

        <div v-if="!isNew" class="container">
            <hr>
            <h2>
                Verwijder deze leveringsoptie
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
import { CenteredMessage, ErrorBox, SaveView, STErrorsDefault, STInputBox, STList, Validator } from "@stamhoofd/components";
import { CheckoutMethodPrice, PrivateWebshop, Version, WebshopDeliveryMethod, WebshopMetaData, WebshopTimeSlots } from "@stamhoofd/structures";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";

import CheckoutMethodPriceBox from "./CheckoutMethodPriceBox.vue";
import EditDeliveryRegionsSection from "./EditDeliveryRegionsSection.vue";
import EditTimeSlotsSection from "./EditTimeSlotsSection.vue";

@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
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
    isNew!: boolean

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

    get hasChanges() {
        return patchContainsChanges(this.patchDeliveryMethod, this.deliveryMethod, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    
}
</script>

