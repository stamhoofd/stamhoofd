<template>
    <SaveView :title="title" :disabled="!hasChanges && !isNew" class="edit-payment-view" :loading="loading" @save="save">
        <h1>
            {{ title }}
        </h1>

        <p v-if="price >= 0">
            Kies hieronder wat er precies betaald werd - en pas eventueel aan hoeveel.
        </p>
        <p v-else>
            {{ $t('f24d4ba4-4b42-4fa1-b99f-4b90dd1a3208') }}
        </p>

        <STErrorsDefault :error-box="errorBox" />

        <SelectBalanceItemsList :items="balanceItems" :list="patchedPayment.balanceItemPayments" @patch="addPatch({balanceItemPayments: $event})" />

        <hr>
        <h2>Hoe?</h2>

        <div class="split-inputs">
            <div>
                <STInputBox title="Betaalmethode" error-fields="method" :error-box="errorBox">
                    <Dropdown v-model="method">
                        <option v-for="m in availableMethods" :key="m" :value="m">
                            {{ getPaymentMethodName(m) }}
                        </option>
                    </Dropdown>
                </STInputBox>

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

        <p v-if="status !== 'Succeeded' && price >= 0" class="info-box">
            We raden aan enkel betalingen aan te maken die je hebt ontvangen. In het andere geval is het beter om de personen via de website te laten betalen - dan kunnen ze een betaalmethode kiezen (dat is ook veiliger tegen Phishing).
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
import { AutoEncoderPatchType, PartialWithoutMethods, patchContainsChanges } from '@simonbackx/simple-encoding';
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins, Prop } from '@simonbackx/vue-app-navigation/classes';
import { I18nController } from '@stamhoofd/frontend-i18n';
import { BalanceItem, PaymentGeneral, PaymentMethod, PaymentMethodHelper, PaymentStatus, PaymentStatusHelper, TransferSettings, Version } from '@stamhoofd/structures';

import { ErrorBox } from '../errors/ErrorBox';
import STErrorsDefault from '../errors/STErrorsDefault.vue';
import { Validator } from '../errors/Validator';
import Checkbox from '../inputs/Checkbox.vue';
import DateSelection from '../inputs/DateSelection.vue';
import Dropdown from '../inputs/Dropdown.vue';
import IBANInput from '../inputs/IBANInput.vue';
import PriceInput from '../inputs/PriceInput.vue';
import STInputBox from '../inputs/STInputBox.vue';
import STList from '../layout/STList.vue';
import STListItem from '../layout/STListItem.vue';
import SaveView from '../navigation/SaveView.vue';
import { CenteredMessage } from '../overlays/CenteredMessage';
import SelectBalanceItemsList from './SelectBalanceItemsList.vue';

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
        IBANInput,
        SelectBalanceItemsList,
    },
})
export default class EditPaymentView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null;
    validator = new Validator();

    @Prop({ required: true })
    payment: PaymentGeneral;

    @Prop({ required: true })
    balanceItems: BalanceItem[];

    @Prop({ required: true })
    isNew!: boolean;

    patchPayment: AutoEncoderPatchType<PaymentGeneral> = PaymentGeneral.patch({});

    @Prop({ required: true })
    saveHandler: ((patch: AutoEncoderPatchType<PaymentGeneral>) => Promise<void>);

    availableMethods = [
        PaymentMethod.Transfer,
        PaymentMethod.PointOfSale,
    ];

    availableStatuses = [
        PaymentStatus.Pending,
        PaymentStatus.Succeeded,
        PaymentStatus.Failed,
    ];

    get organization() {
        return this.$organization;
    }

    get title() {
        return this.isNew ? (this.price >= 0 ? 'Betaling registreren' : 'Terugbetaling registreren') : 'Betaling bewerken';
    }

    get patchedPayment() {
        return this.payment.patch(this.patchPayment);
    }

    get filteredBalanceItems() {
        return this.balanceItems.filter(b => b.price - b.pricePaid !== 0);
    }

    addPatch(patch: PartialWithoutMethods<AutoEncoderPatchType<PaymentGeneral>>) {
        this.patchPayment = this.patchPayment.patch(patch as any);
    }

    get price() {
        return this.patchedPayment.price;
    }

    set price(price: number) {
        this.addPatch({
            price,
        });
    }

    get method() {
        return this.patchedPayment.method ?? PaymentMethod.Unknown;
    }

    set method(method: PaymentMethod) {
        if (this.method === method) {
            return;
        }

        let transferSettings = this.organization.meta.registrationPaymentConfiguration.transferSettings.fillMissing(TransferSettings.create({ creditor: this.organization.name }));
        const webshopId = this.balanceItems.find(b => b.order)?.order?.webshopId;
        if (webshopId) {
            const webshop = this.organization.webshops.find(w => w.id === webshopId);
            if (webshop) {
                transferSettings = webshop.meta.paymentConfiguration.transferSettings.fillMissing(transferSettings);
            }
        }

        this.addPatch({
            method,
            transferDescription: method === PaymentMethod.Transfer ? transferSettings.generateDescription('', I18nController.shared.country) : undefined,
            transferSettings: method === PaymentMethod.Transfer ? transferSettings : undefined,
        });
    }

    get status() {
        return this.patchedPayment.status;
    }

    set status(status: PaymentStatus) {
        this.addPatch({
            status,
            paidAt: status === PaymentStatus.Succeeded ? new Date() : null,
        });
    }

    get paidAt() {
        return this.patchedPayment.paidAt;
    }

    set paidAt(paidAt: Date | null) {
        this.addPatch({
            paidAt,
        });
    }

    get transferDescription() {
        return this.patchedPayment.transferDescription ?? '';
    }

    set transferDescription(transferDescription: string) {
        this.addPatch({
            transferDescription,
        });
    }

    get creditor() {
        return this.patchedPayment.transferSettings?.creditor ?? '';
    }

    set creditor(creditor: string) {
        this.addPatch({
            transferSettings: TransferSettings.patch({
                creditor,
            }),
        });
    }

    get iban() {
        return this.patchedPayment.transferSettings?.iban ?? '';
    }

    set iban(iban: string) {
        this.addPatch({
            transferSettings: TransferSettings.patch({
                iban,
            }),
        });
    }

    get balanceItemPayments() {
        return this.patchedPayment.balanceItemPayments;
    }

    getPaymentMethodName(method: PaymentMethod) {
        return PaymentMethodHelper.getNameCapitalized(method);
    }

    getStatusName(status: PaymentStatus) {
        return PaymentStatusHelper.getNameCapitalized(status);
    }

    loading = false;

    async save() {
        if (this.loading) {
            return;
        }
        this.errorBox = null;

        try {
            const valid = await this.validator.validate();
            if (!valid) {
                return;
            }
            this.loading = true;
            await this.saveHandler(this.patchPayment);
            this.pop({ force: true });
        }
        catch (e) {
            this.errorBox = new ErrorBox(e);
        }
        this.loading = false;
    }

    get hasChanges() {
        return patchContainsChanges(this.patchPayment, this.payment, { version: Version });
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true;
        }
        return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
    }
}
</script>
