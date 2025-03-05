<template>
    <div class="st-view payment-view">
        <STNavigationBar :title="title">
            <template #right>
                <button v-if="hasPrevious || hasNext" v-tooltip="'Ga naar de vorige'" type="button" class="button navigation icon arrow-up" :disabled="!hasPrevious" @click="goBack"/>
                <button v-if="hasNext || hasPrevious" v-tooltip="'Ga naar de volgende'" type="button" class="button navigation icon arrow-down" :disabled="!hasNext" @click="goForward"/>
            </template>
        </STNavigationBar>

        <main>
            <p v-if="payment.type !== PaymentType.Payment && payment.method !== PaymentMethod.Unknown" :class="'style-title-prefix ' + payment.theme">
                <span>{{ PaymentTypeHelper.getName(payment.type) }}</span>
                <span :class="'icon small ' + PaymentTypeHelper.getIcon(payment.type)"/>
            </p>

            <h1 class="style-navigation-title with-icons">
                <span class="icon-spacer">{{ title }}</span>

                <span v-if="payment.isPending" v-tooltip="'In verwerking'" class="icon small hourglass primary"/>
                <span v-if="payment.isFailed" v-tooltip="'Mislukt'" class="icon small disabled error"/>
            </h1>

            <template v-if="canWrite">
                <p v-if="payment.type === PaymentType.Reallocation">
                    {{ $t('9729e2ae-1042-47f2-a9f0-c5c85ceef33b') }} {{ platform.config.name }} {{ $t('b9a02cc3-9cf5-4266-b7c8-99aaefa34e5f') }}
                </p>
                <p v-if="payment.method === PaymentMethod.Transfer && payment.isFailed" class="error-box">
                    {{ $t('1345eee5-39a9-4971-a60c-b2035bb830f4') }}
                </p>

                <p v-if="payment.isPending && payment.method === PaymentMethod.Transfer && payment.isOverDue && payment.type == PaymentType.Payment" class="warning-box">
                    {{ $t('48d4cdaf-2f0c-446a-a946-2382c613ec25') }}
                </p>

                <p v-if="payment.isPending && payment.type == PaymentType.Refund" class="warning-box">
                    {{ $t("9dfc47c4-45a8-453a-9462-e1897a3c7bef") }}
                </p>
            </template>

            <STErrorsDefault :error-box="errors.errorBox"/>

            <STList class="info">
                <STListItem v-if="payment.price">
                    <h3 class="style-definition-label">
                        {{ $t('9887d656-7979-4053-8325-8c21f0c50df9') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(payment.price) }}
                    </p>
                </STListItem>

                <STListItem v-if="payment.method === 'Transfer'">
                    <h3 class="style-definition-label">
                        {{ $t('fb7e4e6a-c7a6-4e1a-84ce-87bcf622f479') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ payment.transferDescription }}
                    </p>
                </STListItem>

                <STListItem v-if="payment.method === 'Transfer' && payment.transferSettings">
                    <h3 v-if="payment.price >= 0" class="style-definition-label">
                        {{ $t('da14a4ee-6de5-4e99-9a77-183293f56fb8') }}
                    </h3>
                    <h3 v-else class="style-definition-label">
                        {{ $t('30a70442-7ccb-44ff-9e4f-b2a64e1ead8d') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ payment.transferSettings }}
                    </p>
                </STListItem>

                <STListItem v-if="isManualMethod">
                    <h3 class="style-definition-label">
                        {{ $t('25981b4f-4483-47f9-8c3a-ac5e7bdc1a69') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatDate(payment.createdAt) }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('6a36a332-b846-4649-9125-0b519cd40c99') }} {{ formatTime(payment.createdAt) }}
                    </p>
                </STListItem>

                <STListItem v-if="payment.paidAt">
                    <h3 v-if="payment.price == 0" class="style-definition-label">
                        {{ $t('b5a1ab24-4aee-423b-99b0-16e19d4952f0') }}
                    </h3>
                    <h3 v-else-if="payment.price >= 0" class="style-definition-label">
                        {{ $t('977d1522-14fd-4d2c-a589-5ad2a3be8e1c') }}
                    </h3>
                    <h3 v-else class="style-definition-label">
                        {{ $t('a88dacba-5ef8-489e-bd63-b8ecde75944d') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatDate(payment.paidAt) }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('6a36a332-b846-4649-9125-0b519cd40c99') }} {{ formatTime(payment.paidAt) }}
                    </p>
                </STListItem>

                <STListItem v-if="payment.iban">
                    <h3 class="style-definition-label">
                        {{ $t('bb456a3b-2652-448b-822f-f82f6323e499') }}
                    </h3>

                    <p class="style-definition-text">
                        {{ payment.iban }}
                    </p>
                    <p v-if="payment.ibanName" class="style-description-small">
                        {{ $t('343e35ca-220a-42b8-b83e-628c7cfd5d89') }} {{ payment.ibanName }}
                    </p>
                </STListItem>

                <STListItem v-if="payment.settlement" class="right-description right-stack">
                    <h3 class="style-definition-label">
                        {{ $t('6ecad048-49d7-430b-88b5-96ba55dd638f') }}
                    </h3>

                    <p class="style-definition-text">
                        {{ formatDate(payment.settlement.settledAt) }}<br></p>
                </STListItem>

                <STListItem v-if="payment.transferFee">
                    <h3 class="style-definition-label">
                        {{ $t('83c429ed-efeb-41a2-bc7a-d4893b807382') }}
                    </h3>

                    <p class="style-definition-text">
                        {{ formatPrice(payment.transferFee) }}
                    </p>
                    <p class="style-description-small">
                        <template v-if="VATPercentage > 0">
                            {{ $t('1bea7f08-e754-4fd2-9b02-69a37d1d0128') }} {{ VATPercentage }}{{ $t('8c5b23e6-dbec-4a5c-8c74-6e0a1e5bb5a6') }}
                        </template> <a :href="$domains.getDocs('transactiekosten-inhouding')" class="inline-link" target="_blank">{{ $t('34099e11-aafe-435c-bd11-5b681610008e') }}</a>
                    </p>
                </STListItem>
            </STList>

            <hr><h2>{{ $t('add6177f-a067-4e79-b7b9-aee2070375f6') }}</h2>

            <p v-if="!payment.customer" class="info-box">
                {{ $t('722b3ce0-1f23-442a-89cf-3accaa47ed04') }}
            </p>
            <STList v-else-if="payment.customer.company" class="info">
                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('937311c1-f8ab-459b-ac7b-f9e6792cd972') }}
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ payment.customer.company.name }}
                    </p>
                    <p v-if="!payment.customer.company.VATNumber && !payment.customer.company.companyNumber" class="style-description">
                        {{ $t('522b4446-bd3d-4d53-a95a-e82f0de07d5e') }}
                    </p>
                </STListItem>

                <STListItem v-if="payment.customer.company.VATNumber">
                    <h3 class="style-definition-label">
                        {{ $t('a0d13010-dea0-47de-a082-3e42d41fdfb2') }}
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ payment.customer.company.VATNumber || 'Niet BTW-plichtig' }}
                    </p>
                </STListItem>

                <STListItem v-if="payment.customer.company.companyNumber && (!payment.customer.company.VATNumber || (payment.customer.company.companyNumber !== payment.customer.company.VATNumber && payment.customer.company.companyNumber !== payment.customer.company.VATNumber.slice(2)))">
                    <h3 class="style-definition-label">
                        {{ $t('4657f291-4cdd-4217-9a54-cd9ecec44b0e') }}
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ payment.customer.company.companyNumber || 'Niet BTW-plichtig' }}
                    </p>
                </STListItem>

                <STListItem v-if="payment.customer.company.address">
                    <h3 class="style-definition-label">
                        {{ $t('e6dc987c-457b-4253-9eef-db9ccdb774f1') }}
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ payment.customer.company.address.toString() }}
                    </p>
                </STListItem>

                <STListItem v-if="payment.customer.company.administrationEmail">
                    <h3 class="style-definition-label">
                        {{ $t('0be79160-b242-44dd-94f0-760093f7f9f2') }}
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ payment.customer.company.administrationEmail }}
                    </p>
                </STListItem>

                <STListItem v-if="payment.customer.name">
                    <h3 class="style-definition-label">
                        {{ $t('cba5b519-de30-4f20-8cad-64977289f909') }}
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ payment.customer.name }}
                    </p>
                    <p v-if="payment.customer.email" v-copyable class="style-description style-copyable">
                        {{ payment.customer.email }}
                    </p>
                </STListItem>
            </STList>

            <STList v-else class="info">
                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('cba5b519-de30-4f20-8cad-64977289f909') }}
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ payment.customer.name || 'Naamloos' }}
                    </p>
                    <p v-if="payment.customer.email" v-copyable class="style-description style-copyable">
                        {{ payment.customer.email }}
                    </p>
                </STListItem>
            </STList>

            <template v-if="isManualMethod && canWrite">
                <hr><h2>{{ $t('8424a02d-2147-40d1-9db2-ddece074a650') }}</h2>

                <STList>
                    <STListItem v-if="payment.isFailed && payment.type === PaymentType.Payment" :selectable="true" @click="markPending">
                        <h2 class="style-title-list">
                            {{ $t('37eeb984-e44b-460a-8536-8b864cbc7459') }}
                        </h2>
                        <p class="style-description">
                            {{ $t("f3aea31a-be71-40dc-a0ba-51c38a06497f") }}
                        </p>
                        <template #right>
                            <button type="button" class="button secundary hide-smartphone">
                                <span class="icon clock"/>
                                <span>{{ $t('37eeb984-e44b-460a-8536-8b864cbc7459') }}</span>
                            </button>
                            <button type="button" class="button icon success only-smartphone"/>
                        </template>
                    </STListItem>

                    <STListItem v-if="(payment.isPending && payment.type === PaymentType.Payment) || (payment.isFailed && payment.type !== PaymentType.Payment)" :selectable="true" @click="markPaid">
                        <h2 class="style-title-list">
                            {{ $t('b7ab3348-03f1-4fb1-9c3d-e2c2b9630e2e') }}
                        </h2>
                        <p v-if="payment.webshopIds.length" class="style-description">
                            {{ $t('51c82ad3-99d7-4342-a500-4ee857a4f324') }}
                        </p>
                        <template #right>
                            <button type="button" class="button secundary hide-smartphone">
                                <span class="icon success"/>
                                <span>{{ $t('5abee5e4-20d3-4a24-9e39-dba14b815ccc') }}</span>
                            </button>
                            <button type="button" class="button icon success only-smartphone"/>
                        </template>
                    </STListItem>

                    <STListItem v-if="payment.isSucceeded && payment.type === PaymentType.Payment" :selectable="true" @click="markPending">
                        <h2 class="style-title-list">
                            {{ $t('04556247-8c84-4422-bc18-5d35814b0089') }}
                        </h2>
                        <p v-if="payment.method === 'Transfer'" class="style-description">
                            {{ $t('80e8ea55-5df6-4b6c-9843-0d3aa09d5076') }}
                        </p>
                        <p v-else class="style-description">
                            {{ $t('cadf2cbb-dfc9-4763-afef-c1fd0fd49572') }}
                        </p>
                        <template #right>
                            <button type="button" class="button secundary hide-smartphone">
                                <span class="icon undo"/>
                                <span>{{ $t('9bb63975-8d99-43a6-bd09-c835d5234ce8') }}</span>
                            </button><button type="button" class="button icon undo only-smartphone"/>
                        </template>
                    </STListItem>

                    <STListItem v-if="payment.isPending || (payment.isSucceeded && payment.type !== PaymentType.Payment)" :selectable="true" @click="markFailed">
                        <h2 class="style-title-list">
                            {{ $t('9e721cec-a0bf-466e-b4dd-b8369369cebc') }}
                        </h2>
                        <p v-if="payment.type !== PaymentType.Payment" class="style-description">
                            {{ $t('34b22570-4b77-47b2-a0af-d2f379f30911') }}
                        </p>
                        <p v-else-if="payment.method === 'Transfer'" class="style-description">
                            {{ $t('af4a6f81-fc46-4cd2-8df1-8e24526f5aaf') }}
                        </p>
                        <p v-else class="style-description">
                            {{ $t('2fd95a9a-a5f9-4e74-8f62-84822ead3e51') }}
                        </p>
                        <template #right>
                            <button type="button" class="button secundary danger hide-smartphone">
                                <span class="icon canceled"/>
                                <span>{{ $t('9e721cec-a0bf-466e-b4dd-b8369369cebc') }}</span>
                            </button><button type="button" class="button icon canceled only-smartphone"/>
                        </template>
                    </STListItem>
                </STList>
            </template>

            <template v-if="payment.balanceItemPayments.length">
                <hr><h2>{{ $t('822d36fc-b3d0-4477-8c05-3699e43324ac') }}</h2>
                <STList>
                    <STListItem v-for="item in sortedItems" :key="item.id">
                        <template #left>
                            <BalanceItemIcon :item="item.balanceItem" :is-payable="false"/>
                        </template>

                        <BalanceItemTitleBox :item="item.balanceItem" :is-payable="false" :price="item.price" :payment-status="payment.status"/>

                        <template #right>
                            <span class="style-price-base" :class="{negative: item.price < 0}">{{ item.price === 0 ? 'Gratis' : formatPrice(item.price) }}</span>
                        </template>
                    </STListItem>
                </STList>

                <PriceBreakdownBox :price-breakdown="[{name: 'Totaal', price: payment.price}]"/>
            </template>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { ArrayDecoder, Decoder, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { GlobalEventBus, STErrorsDefault, STList, STListItem, STNavigationBar, Toast, useAppContext, useAuth, useBackForward, useContext, useErrors, usePlatform } from '@stamhoofd/components';
import { Payment, PaymentGeneral, PaymentMethod, PaymentStatus, PaymentType, PaymentTypeHelper, PermissionLevel } from '@stamhoofd/structures';

import { useRequestOwner } from '@stamhoofd/networking';
import { Sorter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';
import PriceBreakdownBox from '../views/PriceBreakdownBox.vue';
import BalanceItemIcon from './BalanceItemIcon.vue';
import BalanceItemTitleBox from './BalanceItemTitleBox.vue';

const props = withDefaults(
    defineProps<{
        payment: PaymentGeneral;
        getNext?: ((payment: PaymentGeneral) => PaymentGeneral | null) | null;
        getPrevious?: ((payment: PaymentGeneral) => PaymentGeneral | null) | null;
    }>(), {
        getNext: null,
        getPrevious: null,
    },
);

const { hasNext, hasPrevious, goBack, goForward } = useBackForward('payment', props);
const errors = useErrors();
const title = props.payment.title;
const isManualMethod = props.payment.method === PaymentMethod.Transfer || props.payment.method === PaymentMethod.PointOfSale || props.payment.method === PaymentMethod.Unknown;
const auth = useAuth();
const app = useAppContext();
const canWrite = computed(() => app === 'dashboard' && auth.canAccessPayment(props.payment, PermissionLevel.Write));
const VATPercentage = 21; // todo
const context = useContext();
const owner = useRequestOwner();
const markingPaid = ref(false);
const platform = usePlatform();

const sortedItems = computed(() => {
    return props.payment.balanceItemPayments.slice().sort((a, b) => {
        return Sorter.stack(
            Sorter.byNumberValue(a.price, b.price),
            Sorter.byStringValue(a.itemDescription ?? a.balanceItem.description, b.itemDescription ?? b.balanceItem.description),
        );
    });
});

async function reload() {
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: `/payments/${props.payment.id}`,
            decoder: PaymentGeneral as Decoder<PaymentGeneral>,
            owner,
            shouldRetry: true,
        });
        props.payment.deepSet(response.data);
    }
    catch (e) {
        Toast.fromError(e).show();
    }
}

async function markPaid() {
    await mark(PaymentStatus.Succeeded);
}

async function markPending() {
    await mark(PaymentStatus.Pending);
}

async function markFailed() {
    await mark(PaymentStatus.Failed);
}

async function mark(status: PaymentStatus) {
    if (markingPaid.value) {
        return;
    }

    markingPaid.value = true;

    try {
        const data: PatchableArrayAutoEncoder<Payment> = new PatchableArray();
        data.addPatch(Payment.patch({
            id: props.payment.id,
            status,
        }));

        // Create a patch for this payment
        const response = await context.value.authenticatedServer.request({
            method: 'PATCH',
            path: '/organization/payments',
            body: data,
            decoder: new ArrayDecoder(PaymentGeneral as Decoder<PaymentGeneral>),
            shouldRetry: false,
        });
        props.payment.deepSet(response.data[0]);
        GlobalEventBus.sendEvent('paymentPatch', props.payment).catch(console.error);
        new Toast('Betaalstatus gewijzigd', 'success').setHide(1000).show();
    }
    catch (e) {
        Toast.fromError(e).show();
    }
    markingPaid.value = false;
}
</script>
