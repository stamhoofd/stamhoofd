<template>
    <div class="st-view background edit-invoice-view">
        <STNavigationBar :title="title" />

        <main>
            <h1>
                {{ title }}
            </h1>

            <hr>
            <h2>Facturatiegegevens</h2>

            <div class="split-inputs">
                <div>
                    <STInputBox title="Bedrijfsnaam" error-fields="companyName" :error-box="errorBox">
                        <input
                            id="organization-name"
                            v-model="companyName"
                            class="input"
                            type="text"
                            placeholder="Bedrijfsnaam"
                            autocomplete="organization"
                        >
                    </STInputBox>

                    <AddressInput v-model="companyAddress" title="Adres" :validator="validator" />
                </div>

                <div>
                    <VATNumberInput v-model="companyVATNumber" title="BTW-nummer" placeholder="Optioneel" :country="companyAddress.country" :validator="validator" :required="false" />

                    <STInputBox title="Ondernemingsnummer" error-fields="companyNumber" :error-box="errorBox">
                        <input
                            id="organization-number"
                            v-model="companyNumber"
                            class="input"
                            type="text"
                            placeholder="Optioneel"
                            autocomplete="companyNumber"
                        >
                    </STInputBox>

                    <STInputBox title="Contactpersoon" error-fields="companyContact" :error-box="errorBox">
                        <input v-model="companyContact" class="input" type="text" placeholder="Naam">
                    </STInputBox>
                </div>
            </div>

            <hr>
            <h2>Artikelen</h2>

            <STInputBox v-for="(item, index) in items" :key="item.id" class="max" :title="'Artikel '+(index+1)" :error-fields="'items.'+index" :error-box="errorBox">
                <div class="input-group max">
                    <div>
                        <input
                            :value="getItem(index, 'name')"
                            class="input"
                            type="text"
                            placeholder="Naam"
                            @input="setItem(item.id, 'name', $event.target.value)"
                        >
                    </div>
                    <div>
                        <PriceInput :value="getItem(index, 'unitPrice')" placeholder="Eenheidsprijs" :min="null" @input="setItem(item.id, 'unitPrice', $event)" />
                    </div>
                    <div>
                        <NumberInput :value="getItem(index, 'amount')" placeholder="Aantal stuks" :stepper="true" @input="setItem(item.id, 'amount', $event)" />
                    </div>
                    <button class="button icon trash gray" @click="deleteItem(item.id)" />
                </div>
                <textarea class="input" :value="getItem(index, 'description')" placeholder="Beschrijving" @input="setItem(item.id, 'description', $event.target.value)" />
            </STInputBox>
            

            <button class="button text" @click="createItem">
                <span class="icon add" />
                <span>Nieuw</span>
            </button>

            <hr>
            <div class="pricing-box">
                <STList>
                    <STListItem>
                        Prijs excl. BTW

                        <template #right>
                            {{ formatPrice(patchedInvoice.meta.priceWithoutVAT) }}
                        </template>
                    </STListItem>

                    <STListItem>
                        BTW ({{ patchedInvoice.meta.VATPercentage }}%)
    
                        <template #right>
                            {{ formatPrice(patchedInvoice.meta.VAT) }}
                        </template>
                    </STListItem>

                    <STListItem>
                        Te betalen

                        <template #right>
                            {{ formatPrice(patchedInvoice.meta.priceWithVAT) }}
                        </template> 
                    </STListItem>
                </STList>
            </div>
        </main>

        <STToolbar>
            <template #right>
                <button v-if="patchedInvoice.payment && patchedInvoice.payment.status !== 'Succeeded' && !isNew" class="button secundary" @click="markPaid">
                    Markeer als betaald
                </button>
                <button v-if="patchedInvoice.payment && patchedInvoice.payment.status === 'Succeeded' && !isNew" class="button secundary" @click="markNotPaid">
                    Toch niet betaald
                </button>

                <LoadingButton :loading="loading">
                    <button class="button primary" @click="save">
                        Opslaan
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoderPatchType, PartialWithoutMethods, PatchableArray, PatchableArrayAutoEncoder } from "@simonbackx/simple-encoding";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AddressInput,BackButton, ErrorBox, LoadingButton,NumberInput, PriceInput,STErrorsDefault,STInputBox, STList, STListItem, STNavigationBar, STToolbar, Validator, VATNumberInput } from "@stamhoofd/components";
import { Address, Payment, PaymentStatus, STInvoiceItem, STInvoiceMeta, STInvoicePrivate, STPendingInvoicePrivate } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        BackButton,
        STList,
        STListItem,
        LoadingButton,
        AddressInput,
        VATNumberInput,
        NumberInput,
        PriceInput
    },
    filters: {
        price: Formatter.price,
        date: Formatter.date.bind(Formatter),
        dateTime: Formatter.dateTime.bind(Formatter)
    }
})
export default class EditInvoiceView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    invoice!: STInvoicePrivate

    @Prop({ required: true })
    isNew: boolean

    invoicePatch = STInvoicePrivate.patch({})

    errorBox: ErrorBox | null = null
    validator = new Validator()

    loading = false

    @Prop({ required: true })
    callback: (patch: PatchableArrayAutoEncoder<STInvoicePrivate>) => Promise<void>
    

    get title() {
        return this.isNew ? "Nieuwe factuur maken" : "Factuur bewerken"
    }

    get patchedInvoice() {
        return this.invoice.patch(this.invoicePatch)
    }

    addMetaPatch(patch: PartialWithoutMethods<AutoEncoderPatchType<STInvoiceMeta>>) {
        this.invoicePatch = this.invoicePatch.patch({
            meta: STInvoiceMeta.patch(patch)
        })
    }

    get companyName() {
        return this.patchedInvoice.meta.companyName
    }

    set companyName(companyName: string) {
        this.addMetaPatch({ companyName })
    }

    get companyContact() {
        return this.patchedInvoice.meta.companyContact
    }

    set companyContact(companyContact: string) {
        this.addMetaPatch({ companyContact })
    }

    get companyAddress() {
        return this.patchedInvoice.meta.companyAddress
    }

    set companyAddress(companyAddress: Address) {
        this.addMetaPatch({ companyAddress })
    }

    get companyVATNumber() {
        return this.patchedInvoice.meta.companyVATNumber
    }

    set companyVATNumber(companyVATNumber: string | null) {
        this.addMetaPatch({ companyVATNumber })
    }

    get companyNumber() {
        return this.patchedInvoice.meta.companyNumber
    }

    set companyNumber(companyNumber: string | null) {
        this.addMetaPatch({ companyNumber })
    }

    createItem() {
        const meta = STInvoiceMeta.patch({})
        meta.items.addPut(STInvoiceItem.create({}))
        this.addMetaPatch(meta)
    }

    deleteItem(id: string) {
        const meta = STInvoiceMeta.patch({})
        meta.items.addDelete(id)
        this.addMetaPatch(meta)
    }

    get items() {
        return this.patchedInvoice.meta.items
    }

    getItem(index: number, property: string) {
        return this.items[index][property]
    }

    setItem(id: string, property: string, value: any) {
        const meta = STInvoiceMeta.patch({})
        meta.items.addPatch(STInvoiceItem.patch({
            id,
            [property]: value
        }))
        this.addMetaPatch(meta)

    }

    async markNotPaid() {
        if (this.loading) {
            return
        }
        this.loading = true

        try {
            const arr: PatchableArrayAutoEncoder<STInvoicePrivate> = new PatchableArray()

            arr.addPatch(STInvoicePrivate.patch({
                id: this.invoice.id,
                payment: Payment.patch({
                    status: PaymentStatus.Created
                })
            }))

            await this.callback(arr)
            this.pop({ force: true })
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }
        this.loading = false
    }

    async markPaid() {
        if (this.loading) {
            return
        }
        this.loading = true

        try {
            const arr: PatchableArrayAutoEncoder<STInvoicePrivate> = new PatchableArray()

            arr.addPatch(STInvoicePrivate.patch({
                id: this.invoice.id,
                payment: Payment.patch({
                    status: PaymentStatus.Succeeded
                })
            }))

            await this.callback(arr)
            this.pop({ force: true })
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }
        this.loading = false
    }

    async save() {
        if (this.loading) {
            return
        }
        this.loading = true

        try {
            const arr: PatchableArrayAutoEncoder<STInvoicePrivate> = new PatchableArray()

            if (this.isNew) {
                arr.addPut(this.patchedInvoice)
            } else {
                this.invoicePatch.id = this.invoice.id
                arr.addPatch(this.invoicePatch)
            }
            await this.callback(arr)
            this.pop({ force: true })
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }
        this.loading = false
    }
}
</script>