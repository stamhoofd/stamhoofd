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

            <p v-if="isNew" class="info-box">
                Je moet het lid zelf op de hoogte brengen van de nieuwe afrekening
            </p>
        
            <STErrorsDefault :error-box="errorBox" />

            <STInputBox v-if="!isOnlinePayment" title="Betaalmethode" error-fields="method" :error-box="errorBox" class="max">
                <RadioGroup>
                    <Radio v-for="m in paymentMethods" :key="m" v-model="paymentMethod" :value="m">
                        {{ getPaymentName(m) }}
                    </Radio>
                </RadioGroup>
            </STInputBox>

            <div v-if="!isOnlinePayment" class="split-inputs">
                <div>
                    <STInputBox title="Prijs" error-fields="price" :error-box="errorBox">
                        <PriceInput v-model="price" />
                    </STInputBox>
                    <p v-if="!isNew" class="style-description-small">
                        Als je de prijs aanpast moet je dat zelf communiceren naar het lid. Deze is wel altijd zichtbaar als het lid zelf inlogt.
                    </p>
                </div>
                <STInputBox v-if="isTransfer" title="Mededeling" error-fields="transferDescription" :error-box="errorBox">
                    <input
                        v-model="transferDescription"
                        class="input"
                        type="text"
                        :placeholder="isNew ? 'Automatisch toewijzen' : 'Niet wijzigen'"
                    >
                </STInputBox>
            </div>

            <Checkbox v-model="isPaid">
                De afrekening is betaald
            </Checkbox>

            <div v-if="!isOnlinePayment && isPaid && paidAt" class="split-inputs">
                <STInputBox title="Betaald op" error-fields="paidAt" :error-box="errorBox">
                    <DateSelection v-model="paidAt" />
                </STInputBox>
                <TimeInput v-model="paidAt" title="Om" :validator="validator" /> 
            </div>
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
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox,DateSelection,ErrorBox, PriceInput, Radio,RadioGroup, Spinner,STErrorsDefault,STInputBox, STList, STNavigationBar, STToolbar, TimeInput, Validator } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { CreatePaymentGeneral, EncryptedPaymentGeneral, PaymentGeneral, PaymentMethod, PaymentMethodHelper, PaymentPatch, PaymentStatus, RegisterItem, Registration } from "@stamhoofd/structures"
import { RegisterCartPriceCalculator } from '@stamhoofd/structures/src/members/checkout/RegisterCartPriceCalculator';
import { Formatter } from '@stamhoofd/utility';
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
        Checkbox,
        TimeInput,
        DateSelection,
        RadioGroup,
        Radio
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

    @Prop({ required: true })
    callback!: (payments: EncryptedPaymentGeneral[]) => Promise<void>

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
        this.patchPayment = this.patchPayment.patch({ 
            status: isPaid ? PaymentStatus.Succeeded : PaymentStatus.Created,
            paidAt: isPaid && !this.paidAt ? new Date() : undefined
        })
    }

    get paidAt() {
        return this.patchPayment.paidAt !== undefined ? this.patchPayment.paidAt : this.payment.paidAt
    }

    set paidAt(paidAt: Date | null) {
        this.patchPayment = this.patchPayment.patch({ paidAt })
    }

    get paymentMethod() {
        return (this.patchPayment.method !== undefined ? this.patchPayment.method : this.payment.method) ?? PaymentMethod.Unknown
    }

    set paymentMethod(method: PaymentMethod) {
        this.patchPayment = this.patchPayment.patch({ method })
    }


    get transferDescription() {
        return (this.patchPayment.transferDescription !== undefined ? this.patchPayment.transferDescription : this.payment.transferDescription) ?? ""
    }

    set transferDescription(transferDescription: string | null) {
        if (this.transferDescription === transferDescription) {
            return
        }

        if (transferDescription !== null && transferDescription.length == 0) {
            const p = this.patchPayment.patch({ transferDescription: null })
            p.transferDescription = this.isNew ? null : undefined
            this.patchPayment = p
            return
        }
        this.patchPayment = this.patchPayment.patch({ transferDescription })
    }

    get isOnlinePayment() {
        return !this.payment.method || !this.paymentMethods.includes(this.payment.method)
    }

    get isTransfer() {
        return this.paymentMethod === PaymentMethod.Transfer
    }

    get paymentMethods() {
        return [PaymentMethod.Transfer, PaymentMethod.Unknown]
    }

    getPaymentName(method: PaymentMethod) {
        return Formatter.capitalizeFirstLetter(PaymentMethodHelper.getName(method))
    }

    async save() {
        if (this.saving) {
            return
        }
        this.saving = true

        try {
            if (this.isNew) {
                const request = await SessionManager.currentSession!.authenticatedServer.request({
                    method: "POST",
                    path: "/organization/payments",
                    body: [this.payment.patch(this.patchPayment)],
                    decoder: new ArrayDecoder(EncryptedPaymentGeneral as Decoder<EncryptedPaymentGeneral>)
                })
                await this.callback(request.data)
            } else {
                if (this.payment instanceof PaymentGeneral) {
                    this.patchPayment.id = this.payment.id
                } else {
                    console.warn("Received wrong payment type")
                }
                const request = await SessionManager.currentSession!.authenticatedServer.request({
                    method: "PATCH",
                    path: "/organization/payments",
                    body: [this.patchPayment],
                    decoder: new ArrayDecoder(EncryptedPaymentGeneral as Decoder<EncryptedPaymentGeneral>)
                })
                await this.callback(request.data)
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
        return (this.patchPayment.price !== undefined && this.patchPayment.price !== this.payment.price) || (this.patchPayment.status !== undefined && this.patchPayment.status !== this.payment.status)
    }

    async shouldNavigateAway() {
        if (!this.isChanged()) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    
}
</script>
