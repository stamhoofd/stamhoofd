<template>
    <div class="st-view payment-edit-view">
        <STNavigationBar :title="isNew ? 'Afrekening toevoegen' : 'Afrekening bewerken'">
            <template slot="right">
                <button class="button icon close gray" @click="pop" />
            </template>
        </STNavigationBar>

        <main>
            <h1 v-if="isNew">
                Afrekening toevoegen
            </h1>
            <h1 v-else>
                Afrekening bewerken
            </h1>
        
            <STErrorsDefault :error-box="errorBox" />

            <STInputBox title="Prijs" error-fields="price" :error-box="errorBox">
                <PriceInput v-model="price" />
            </STInputBox>

            <Checkbox v-model="isPaid">
                Betaald
            </Checkbox>
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
import { ArrayDecoder, Decoder, patchContainsChanges } from '@simonbackx/simple-encoding';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox,ErrorBox, PriceInput, Spinner,STErrorsDefault,STInputBox, STList, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { CreatePaymentGeneral, EncryptedPaymentGeneral, PaymentGeneral, PaymentPatch, PaymentStatus, Registration, Version } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        PriceInput,
        Spinner,
        STList,
        Checkbox
    },
})
export default class EditPaymentView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Prop({ required: true })
    payment!: PaymentGeneral | CreatePaymentGeneral

    @Prop({ required: false, default: () => [] })
    registrations!: Registration[]

    @Prop({ required: true })
    isNew!: boolean

    patchPayment = PaymentPatch.create({ id: "" })

    saving = false

    get price() {
        return this.patchPayment.price ?? this.payment.price
    }

    set price(price: number) {
        this.patchPayment = this.patchPayment.patch({ price })
    }

    get isPaid() {
        return (this.patchPayment.status ?? this.payment.status) === PaymentStatus.Succeeded
    }

    set isPaid(isPaid: boolean) {
        this.patchPayment = this.patchPayment.patch({ status: isPaid ? PaymentStatus.Succeeded : PaymentStatus.Created })
    }

    async save() {
        if (this.saving) {
            return
        }
        this.saving = true

        try {
            if (this.isNew) {
                const request = await SessionManager.currentSession?.authenticatedServer.request({
                    method: "POST",
                    path: "/organization/payments",
                    body: [this.payment.patch(this.patchPayment)],
                    decoder: new ArrayDecoder(EncryptedPaymentGeneral as Decoder<EncryptedPaymentGeneral>)
                })
            } else {
                // todo
            }
            // save here
            this.pop({ force: true })
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }
        this.saving = false
    }

    cancel() {
        this.pop()
    }

    isChanged() {
        return patchContainsChanges(this.patchPayment, this.payment, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.isChanged()) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    
}
</script>
