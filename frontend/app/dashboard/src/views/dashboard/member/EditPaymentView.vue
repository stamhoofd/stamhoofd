<template>
    <SaveView :title="title" :disabled="!hasChanges && !isNew" class="edit-payment-view" :loading="loading" @save="save">
        <h1>
            {{ title }}
        </h1>

        <p v-if="price >= 0">
            Kies hieronder wat er precies betaald werd. 
        </p>
        <p v-else>
            Kies hieronder wat er precies terugbetaald (negatief bedrag invullen) werd. Let op dat Stamhoofd momenteel geen automatische terugbetalingen doet voor online betalingen. Je moet dus zelf het bedrag manueel terugbetalen of storten.
        </p>

        <STErrorsDefault :error-box="errorBox" />

        <STList>
            <STListItem v-for="item in filteredBalanceItems" :key="item.id" element-name="label" :selectable="true">
                <Checkbox slot="left" :checked="isItemSelected(item)" @change="setItemSelected(item, $event)" />

                <h3 class="style-title-list">
                    {{ item.description }}
                </h3>
                <p v-if="item.member && multipleMembers" class="style-description-small">
                    {{ item.member.name }}
                </p>
                <p class="style-description-small">
                    {{ formatDate(item.createdAt) }}
                </p>
                <p class="style-description-small">
                    {{ formatPrice(item.price) }}<template v-if="item.pricePaid !== 0">
                        waarvan {{ formatPrice(item.pricePaid) }} betaald
                        <template v-if="item.pricePaid > item.price">
                            (te veel betaald)
                        </template>
                    </template>
                </p>

                <PriceInput v-if="isItemSelected(item)" slot="right" :value="getItemPrice(item)" placeholder="Geen" :min="null" @input="setItemPrice(item, $event)" />
            </STListItem>
        </STList>

        <div class="style-pricing-box">
            <STList>
                <STListItem v-if="price >= 0">
                    Totaal betaald

                    <template slot="right">
                        {{ formatPrice(price) }}
                    </template>
                </STListItem>

                <STListItem v-else>
                    Totaal terugbetaald

                    <template slot="right">
                        {{ formatPrice(price) }}
                    </template>
                </STListItem>
            </STList>
        </div>

        <hr>
        <h2>Hoe?</h2>

        <div class="split-inputs">
            <div>
                <STInputBox title="Status" error-fields="status" :error-box="errorBox">
                    <Dropdown v-model="status">
                        <option v-for="m in availableStatuses" :key="m" :value="m">
                            {{ getStatusName(m) }}
                        </option>
                    </Dropdown>
                </STInputBox>
            </div>
            <div>
                <STInputBox v-if="status === 'Succeeded'" :title="price >= 0 ? 'Ontvangen op' : 'Terugbetaald op'" error-fields="paidAt" :error-box="errorBox">
                    <DateSelection v-model="paidAt" />
                </STInputBox>
            </div>
        </div>

        <STInputBox title="Betaalmethode" error-fields="method" :error-box="errorBox">
            <Dropdown v-model="method">
                <option v-for="m in availableMethods" :key="m" :value="m">
                    {{ getPaymentMethodName(m) }}
                </option>
            </Dropdown>
        </STInputBox>

        <p v-if="status !== 'Succeeded' && price >= 0" class="info-box">
            We raden aan enkel betalingen aan te maken die je hebt ontvangen. <template v-if="familyManager">
                Een lid kan zelf namelijk ook altijd het openstaande bedrag betalen via het ledenportaal.
            </template>
        </p>

        <p v-if="status !== 'Succeeded' && price < 0" class="info-box">
            We raden aan enkel terugbetalingen aan te maken die je al hebt terugbetaald.
        </p>

        <template v-if="method === 'Transfer'">
            <hr>
            <h2 v-if="price >= 0">
                Overschrijvingsdetails
            </h2>
            <h2 v-else>
                Rekening waarmee terugbetaald werd
            </h2>

            <STInputBox :title="price >= 0 ? 'Begunstigde' : 'Naam rekening'" error-fields="transferSettings.creditor" :error-box="errorBox">
                <input
                    v-model="creditor"
                    class="input"
                    type="text"
                    placeholder="Naam bankrekeningnummer"
                    autocomplete=""
                >
            </STInputBox>

            <IBANInput v-model="iban" title="Bankrekeningnummer" placeholder="Op deze rekening schrijft men over" :validator="validator" :required="false" />

            <STInputBox title="Mededeling" error-fields="transferDescription" :error-box="errorBox">
                <input
                    ref="firstInput"
                    v-model="transferDescription"
                    class="input"
                    type="text"
                    placeholder="Bv. Aankoop x"
                    autocomplete=""
                >
            </STInputBox>
        </template>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoderPatchType, PartialWithoutMethods, PatchableArray, PatchableArrayAutoEncoder, patchContainsChanges } from '@simonbackx/simple-encoding';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, DateSelection, Dropdown,ErrorBox, IBANInput,PriceInput, SaveView, STErrorsDefault, STInputBox, STList, STListItem, Validator } from "@stamhoofd/components";
import { I18nController } from '@stamhoofd/frontend-i18n';
import { BalanceItemDetailed, BalanceItemPaymentDetailed, PaymentStatusHelper, TransferSettings } from '@stamhoofd/structures';
import { PaymentGeneral, PaymentMethod, PaymentMethodHelper, PaymentStatus, Version } from "@stamhoofd/structures";
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { FamilyManager } from '../../../classes/FamilyManager';
import { OrganizationManager } from '../../../classes/OrganizationManager';

@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault,
        PriceInput,
        STListItem,
        STList,
        Checkbox,
        DateSelection,
        Dropdown,
        IBANInput
    },
})
export default class EditPaymentView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Prop({ required: true })
        payment: PaymentGeneral

    @Prop({ required: true })
        balanceItems: BalanceItemDetailed[]

    @Prop({ required: true })
        isNew!: boolean

    @Prop({default: null})
        familyManager!: FamilyManager|null;
    
    patchPayment: AutoEncoderPatchType<PaymentGeneral> = PaymentGeneral.patch({})

    @Prop({ required: true })
        saveHandler: ((patch: AutoEncoderPatchType<PaymentGeneral>) => Promise<void>);

    availableMethods = [
        PaymentMethod.PointOfSale,
        PaymentMethod.Transfer,
    ];

    availableStatuses = [
        PaymentStatus.Pending,
        PaymentStatus.Succeeded,
        PaymentStatus.Failed,
    ];

    getMember(id: string) {
        return this.familyManager?.members.find(m => m.id == id)
    }

    get multipleMembers() {
        return (this.familyManager?.members.length ?? 0) > 1
    }

    get organization() {
        return OrganizationManager.organization
    }

    get title() {
        return this.isNew ? (this.price >= 0 ? 'Betaling registreren' : 'Terugbetaling registreren') : 'Betaling bewerken';
    }

    get patchedPayment() {
        return this.payment.patch(this.patchPayment)
    }

    get filteredBalanceItems() {
        return this.balanceItems.filter(b => b.price - b.pricePaid !== 0)
    }

    addPatch(patch: PartialWithoutMethods<AutoEncoderPatchType<PaymentGeneral>>) {
        this.patchPayment = this.patchPayment.patch(patch)
    }

    get price() {
        return this.patchedPayment.price;
    }

    set price(price: number) {
        this.addPatch({
            price
        })
    }

    get method() {
        return this.patchedPayment.method ?? PaymentMethod.Unknown;
    }

    set method(method: PaymentMethod) {
        if (this.method === method) {
            return
        }

        let transferSettings = this.organization.meta.registrationPaymentConfiguration.transferSettings.fillMissing(TransferSettings.create({creditor: this.organization.name}));
        const webshopId = this.balanceItems.find(b => b.order)?.order?.webshopId
        if (webshopId) {
            const webshop = this.organization.webshops.find(w => w.id == webshopId)
            if (webshop) {
                transferSettings = webshop.meta.paymentConfiguration.transferSettings.fillMissing(transferSettings);
            }
        }

        this.addPatch({
            method,
            transferDescription: method === PaymentMethod.Transfer ? transferSettings.generateDescription('', I18nController.shared.country) : undefined,
            transferSettings: method === PaymentMethod.Transfer ? transferSettings : undefined,
        })
    }

    get status() {
        return this.patchedPayment.status;
    }

    set status(status: PaymentStatus) {
        this.addPatch({
            status,
            paidAt: status == PaymentStatus.Succeeded ? new Date() : null
        })
    }

    get paidAt() {
        return this.patchedPayment.paidAt;
    }

    set paidAt(paidAt: Date | null) {
        this.addPatch({
            paidAt
        })
    }

    get transferDescription() {
        return this.patchedPayment.transferDescription ?? '';
    }

    set transferDescription(transferDescription: string) {
        this.addPatch({
            transferDescription
        })
    }

    get creditor() {
        return this.patchedPayment.transferSettings?.creditor ?? '';
    }

    set creditor(creditor: string) {
        this.addPatch({
            transferSettings: TransferSettings.patch({
                creditor
            })
        })
    }

    get iban() {
        return this.patchedPayment.transferSettings?.iban ?? '';
    }

    set iban(iban: string) {
        this.addPatch({
            transferSettings: TransferSettings.patch({
                iban
            })
        })
    }

    get balanceItemPayments() {
        return this.patchedPayment.balanceItemPayments
    }

    isItemSelected(item: BalanceItemDetailed) {
        return this.balanceItemPayments.find(p => p.balanceItem.id == item.id) != null
    }

    setItemSelected(item: BalanceItemDetailed, selected: boolean) {
        if (selected) {
            const add = BalanceItemPaymentDetailed.create({
                balanceItem: item,
                price: item.price - item.pricePaid
            });
            const arr: PatchableArrayAutoEncoder<BalanceItemPaymentDetailed> = new PatchableArray()
            arr.addPut(add)
            this.addPatch({
                balanceItemPayments: arr
            })
        } else {
            const id = this.balanceItemPayments.find(p => p.balanceItem.id == item.id)?.id

            if (id) {
                const arr: PatchableArrayAutoEncoder<BalanceItemPaymentDetailed> = new PatchableArray()
                arr.addDelete(id)
                this.addPatch({
                    balanceItemPayments: arr
                })
            }
        }
        this.recalculateTotal()
    }

    recalculateTotal() {
        this.price = this.balanceItemPayments.reduce((total, p) => total + p.price, 0)
    }

    getItemPrice(item: BalanceItemDetailed) {
        return this.balanceItemPayments.find(p => p.balanceItem.id == item.id)?.price
    }

    setItemPrice(item: BalanceItemDetailed, price: number) {
        const id = this.balanceItemPayments.find(p => p.balanceItem.id == item.id)?.id

        if (id) {
            const arr: PatchableArrayAutoEncoder<BalanceItemPaymentDetailed> = new PatchableArray()
            arr.addPatch(BalanceItemPaymentDetailed.patch({
                id,
                price
            }))
            this.addPatch({
                balanceItemPayments: arr
            })
        }
        this.recalculateTotal()
    }
  
    formatDate(date: Date) {
        return Formatter.date(date, true)
    }

    formatPrice(price: number) {
        return Formatter.price(price)
    }

    getPaymentMethodName(method: PaymentMethod) {
        return PaymentMethodHelper.getNameCapitalized(method);
    }   
    
    getStatusName(status: PaymentStatus) {
        return PaymentStatusHelper.getNameCapitalized(status);
    }

    mounted() {
        for (const item of this.filteredBalanceItems) {
            this.setItemSelected(item, true)
        }
    }

    loading = false

    async save() {
        if (this.loading) {
            return
        }
        this.errorBox = null;

        try {
            const valid = await this.validator.validate();
            if (!valid) {
                return;
            }
            this.loading = true
            await this.saveHandler(this.patchPayment)
            this.pop({ force: true })
        } catch (e) {
            this.errorBox = new ErrorBox(e);
        }
        this.loading = false
    }

    get hasChanges() {
        return patchContainsChanges(this.patchPayment, this.payment, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }
}
</script>