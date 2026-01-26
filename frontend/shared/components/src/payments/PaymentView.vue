<template>
    <div class="st-view payment-view">
        <STNavigationBar :title="title">
            <template #right>
                <button v-if="hasPrevious || hasNext" v-tooltip="$t('03b92fed-e144-4ace-a931-dc8421734bcd')" type="button" class="button icon arrow-up" :disabled="!hasPrevious" @click="goBack" />
                <button v-if="hasNext || hasPrevious" v-tooltip="$t('187657c7-d1ad-4047-a693-ab0e215d41fc')" type="button" class="button icon arrow-down" :disabled="!hasNext" @click="goForward" />
            </template>
        </STNavigationBar>

        <main>
            <p v-if="payment.type !== PaymentType.Payment && payment.method !== PaymentMethod.Unknown" :class="'style-title-prefix ' + payment.theme">
                <span>{{ PaymentTypeHelper.getName(payment.type) }}</span>
                <span :class="'icon small ' + PaymentTypeHelper.getIcon(payment.type)" />
            </p>

            <h1 class="style-navigation-title with-icons">
                <span class="icon-spacer">{{ title }}</span>

                <span v-if="payment.isPending" v-tooltip="$t('ac279f6b-0c7c-4ef1-9178-1fd030fe7cc8')" class="icon small hourglass primary" />
                <span v-if="payment.isFailed" v-tooltip="$t('c25c4919-ea71-4874-8573-d02242040f6f')" class="icon small disabled error" />
            </h1>

            <template v-if="canWrite">
                <p v-if="payment.type === PaymentType.Reallocation">
                    {{ $t('1e5a1fda-ef7e-4719-ae84-907d10b31457', {platform: platform.config.name}) }}
                </p>
                <p v-if="payment.method === PaymentMethod.Transfer && payment.isFailed" class="error-box">
                    {{ $t('c3ab8dd2-19f1-40b8-82cf-1e6185307605') }}
                </p>

                <p v-if="payment.isPending && payment.method === PaymentMethod.Transfer && payment.isOverDue && payment.type == PaymentType.Payment" class="warning-box">
                    {{ $t('a5474f96-5271-4257-92ab-c6d8ccb7f7e9') }}
                </p>

                <p v-if="payment.isPending && payment.type == PaymentType.Refund" class="warning-box">
                    {{ $t("2f003407-e359-4e94-af1c-90b207464090") }}
                </p>
            </template>

            <STErrorsDefault :error-box="errors.errorBox" />

            <STList class="info">
                <STListItem v-if="payment.price">
                    <h3 class="style-definition-label">
                        {{ $t('8694e53a-8dc4-42dd-9fbb-c38057ed8403') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(payment.price) }}
                    </p>
                </STListItem>

                <STListItem v-if="payment.method === 'Transfer'">
                    <h3 class="style-definition-label">
                        {{ $t('136b7ba4-7611-4ee4-a46d-60758869210f') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ payment.transferDescription }}
                    </p>
                </STListItem>

                <STListItem v-if="payment.method === 'Transfer' && payment.transferSettings">
                    <h3 v-if="payment.price >= 0" class="style-definition-label">
                        {{ $t('6da2935e-b763-415f-b4ff-1923623c766c') }}
                    </h3>
                    <h3 v-else class="style-definition-label">
                        {{ $t('8bf7e685-075f-4d67-887b-d01070df9b6f') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ payment.transferSettings }}
                    </p>
                </STListItem>

                <STListItem v-if="isManualMethod">
                    <h3 class="style-definition-label">
                        {{ $t('b6391640-1e01-47f9-913d-360fb0903b75') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatDate(payment.createdAt) }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('c6a1f96a-0e71-44c1-89a2-20bfd206d9c6', {time: formatTime(payment.createdAt)}) }}
                    </p>
                </STListItem>

                <STListItem v-if="payment.paidAt && (payment.type === PaymentType.Payment || payment.type === PaymentType.Refund)">
                    <h3 v-if="payment.price == 0" class="style-definition-label">
                        {{ $t('7fb9593e-9937-4c47-ba0f-fb79a5ba3d87') }}
                    </h3>
                    <h3 v-else-if="payment.price >= 0" class="style-definition-label">
                        {{ $t('445f778c-5d66-44d3-af4a-84254a4475ea') }}
                    </h3>
                    <h3 v-else class="style-definition-label">
                        {{ $t('7cea4ccc-16d1-42ae-87af-34a603013577') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatDate(payment.paidAt) }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('c6a1f96a-0e71-44c1-89a2-20bfd206d9c6', {time: formatTime(payment.paidAt)}) }}
                    </p>
                </STListItem>

                <STListItem v-if="payment.iban">
                    <h3 class="style-definition-label">
                        {{ $t('8c09c44f-8cf2-4efa-8f67-fd845a747d4a') }}
                    </h3>

                    <p class="style-definition-text">
                        {{ payment.iban }}
                    </p>
                    <p v-if="payment.ibanName" class="style-description-small">
                        {{ $t('1663859d-2802-4317-9bd9-c8fc61d2baca', {name: payment.ibanName}) }}
                    </p>
                </STListItem>

                <STListItem v-if="payment.settlement" class="right-description right-stack">
                    <h3 class="style-definition-label">
                        {{ $t('8dead18a-892c-458e-9ef1-39f49a9b5807') }}
                    </h3>

                    <p class="style-definition-text">
                        {{ formatDate(payment.settlement.settledAt) }}<br>
                    </p>
                </STListItem>

                <STListItem v-if="payment.transferFee">
                    <h3 class="style-definition-label">
                        {{ $t('a483f935-9647-4904-b71e-8918ef3ad222') }}
                    </h3>

                    <p class="style-definition-text">
                        {{ formatPrice(payment.transferFee) }}
                    </p>
                    <p class="style-description-small">
                        <template v-if="VATPercentage > 0">
                            {{ $t('a95a8551-7686-4df2-92aa-2c453bba6bf6', {percentage: VATPercentage.toString()}) }}
                        </template> <a :href="$domains.getDocs('transactiekosten-inhouding')" class="inline-link" target="_blank">{{ $t('a36700a3-64be-49eb-b1fd-60af7475eb4e') }}</a>
                    </p>
                </STListItem>
            </STList>

            <hr><h2>{{ $t('f777a982-6f69-41cc-bef1-18d146e870db') }}</h2>

            <p v-if="!payment.customer" class="info-box">
                {{ $t('cc6a87de-8228-4a0b-8d31-b9805556c6b8') }}
            </p>
            <STList v-else-if="payment.customer.company" class="info">
                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('e016131d-770c-45fe-b6e9-5631761cbab2') }}
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ payment.customer.company.name }}
                    </p>
                    <p v-if="!payment.customer.company.VATNumber && !payment.customer.company.companyNumber" class="style-description">
                        {{ $t('594307a3-05b8-47cf-81e2-59fb6254deba') }}
                    </p>
                </STListItem>

                <STListItem v-if="payment.customer.company.VATNumber">
                    <h3 class="style-definition-label">
                        {{ $t('4d2a6054-26bf-49ed-b91f-59a8819e6436') }}
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ payment.customer.company.VATNumber || 'Niet BTW-plichtig' }}
                    </p>
                </STListItem>

                <STListItem v-if="payment.customer.company.companyNumber && (!payment.customer.company.VATNumber || (payment.customer.company.companyNumber !== payment.customer.company.VATNumber && payment.customer.company.companyNumber !== payment.customer.company.VATNumber.slice(2)))">
                    <h3 class="style-definition-label">
                        {{ $t('fb64a034-071e-45d6-8d78-6b5f291ee5f9') }}
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ payment.customer.company.companyNumber || 'Niet BTW-plichtig' }}
                    </p>
                </STListItem>

                <STListItem v-if="payment.customer.company.address">
                    <h3 class="style-definition-label">
                        {{ $t('f7e792ed-2265-41e9-845f-e3ce0bc5da7c') }}
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ payment.customer.company.address.toString() }}
                    </p>
                </STListItem>

                <STListItem v-if="payment.customer.company.administrationEmail">
                    <h3 class="style-definition-label">
                        {{ $t('7400cdce-dfb4-40e7-996b-4817385be8d8') }}
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ payment.customer.company.administrationEmail }}
                    </p>
                </STListItem>

                <STListItem v-if="payment.customer.name">
                    <h3 class="style-definition-label">
                        {{ $t('2cb138d8-38c3-4ca8-baa8-64bcd32fb2eb') }}
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
                        {{ $t('2cb138d8-38c3-4ca8-baa8-64bcd32fb2eb') }}
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
                <hr><h2>{{ $t('dc052084-eea5-407e-8775-237bf550895a') }}</h2>

                <STList>
                    <STListItem v-if="payment.isFailed && payment.type === PaymentType.Payment" :selectable="true" @click="markPending">
                        <template #left>
                            <IconContainer icon="bank" class="primary">
                                <template #aside>
                                    <span class="icon clock small" />
                                </template>
                            </IconContainer>
                        </template>

                        <h2 class="style-title-list">
                            {{ $t('49238d23-bcfc-4470-85bb-4249e618e752') }}
                        </h2>
                        <p class="style-description">
                            {{ $t("e93f8565-8fc6-4073-94f3-95d42c19d9a0") }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-if="(payment.isPending && payment.type === PaymentType.Payment) || (payment.isFailed && payment.type !== PaymentType.Payment)" :selectable="true" @click="markPaid">
                        <template #left>
                            <IconContainer icon="bank" class="success">
                                <template #aside>
                                    <span class="icon success small" />
                                </template>
                            </IconContainer>
                        </template>

                        <h2 class="style-title-list">
                            {{ $t('aca879f0-55d3-4964-a8ad-0eedf18228fb') }}
                        </h2>
                        <p v-if="payment.webshopIds.length" class="style-description">
                            {{ $t('9e211b50-4422-411f-9c77-8e036e2a2416') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-if="payment.isSucceeded && payment.type === PaymentType.Payment" :selectable="true" @click="markPending">
                        <template #left>
                            <IconContainer icon="bank" class="primary">
                                <template #aside>
                                    <span class="icon clock small" />
                                </template>
                            </IconContainer>
                        </template>

                        <h2 class="style-title-list">
                            {{ $t('3a66a01a-b0be-4696-b8ac-47c2e5532571') }}
                        </h2>
                        <p v-if="payment.method === 'Transfer'" class="style-description">
                            {{ $t('c3e75c59-a5a9-494a-aa75-d8528dcb6158') }}
                        </p>
                        <p v-else class="style-description">
                            {{ $t('4ac815c1-b06d-4fdb-a88a-2e4222ca535b') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-if="payment.isPending || (payment.isSucceeded && payment.type !== PaymentType.Payment && payment.type !== PaymentType.Reallocation)" :selectable="true" @click="markFailed">
                        <template #left>
                            <IconContainer icon="bank" class="error">
                                <template #aside>
                                    <span class="icon canceled small" />
                                </template>
                            </IconContainer>
                        </template>

                        <h2 class="style-title-list">
                            {{ $t('bc53d7e6-3dbc-45ec-beeb-5f132fcbedb9') }}
                        </h2>
                        <p v-if="payment.type !== PaymentType.Payment" class="style-description">
                            {{ $t('5c940c27-7609-443e-941c-52cd29067f9b') }}
                        </p>
                        <p v-else-if="payment.method === 'Transfer'" class="style-description">
                            {{ $t('Annuleer de overschrijving als je die na enkele dagen nog niet hebt ontvangen. De schuld komt dan opnieuw open te staan, de status ‘in verwerking’ vervalt en er kan een nieuwe betaalpoging worden ondernomen. Automatische herinneringsmails worden indien nodig opnieuw geactiveerd.') }}
                        </p>
                        <p v-else class="style-description">
                            {{ $t('Annuleer de betaling als je die na enkele dagen nog niet hebt ontvangen. De schuld komt dan opnieuw open te staan, de status ‘in verwerking’ vervalt en er kan een nieuwe betaalpoging worden ondernomen. Automatische herinneringsmails worden indien nodig opnieuw geactiveerd.') }}
                        </p>
                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </template>

            <template v-if="payment.balanceItemPayments.length">
                <hr><h2>{{ $t('4385bcc8-1643-4352-b766-a658e4c33f80') }}</h2>
                <STList>
                    <STListItem v-for="item in sortedItems" :key="item.id" :selectable="canWrite" @click="editBalanceItem(item.balanceItem)">
                        <template #left>
                            <BalanceItemIcon :item="item.balanceItem" :is-payable="false" />
                        </template>

                        <BalanceItemTitleBox :item="item.balanceItem" :is-payable="false" :price="item.price" :payment-status="payment.status" />

                        <template #right>
                            <span class="style-price-base" :class="{negative: item.price < 0}">{{ item.price === 0 ? 'Gratis' : formatPrice(item.price) }}</span>
                        </template>
                    </STListItem>
                </STList>

                <PriceBreakdownBox :price-breakdown="[{name: $t('43cf58c2-2263-4c99-87d2-71d61e8b95fe'), price: payment.price}]" />
            </template>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { ArrayDecoder, AutoEncoderPatchType, Decoder, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { CenteredMessage, EditBalanceItemView, GlobalEventBus, IconContainer, STErrorsDefault, STList, STListItem, STNavigationBar, Toast, useAppContext, useAuth, useBackForward, useContext, useErrors, usePlatform } from '@stamhoofd/components';
import { BalanceItem, BalanceItemWithPayments, Payment, PaymentGeneral, PaymentMethod, PaymentStatus, PaymentType, PaymentTypeHelper, PermissionLevel } from '@stamhoofd/structures';

import { useRequestOwner } from '@stamhoofd/networking';
import { Sorter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';
import PriceBreakdownBox from '../views/PriceBreakdownBox.vue';
import BalanceItemIcon from './BalanceItemIcon.vue';
import BalanceItemTitleBox from './BalanceItemTitleBox.vue';
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';

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
const present = usePresent();

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
    if (!await CenteredMessage.confirm($t('Betaling als betaald markeren?'), $t('Ja, betaald'))) {
        return;
    }
    await mark(PaymentStatus.Succeeded);
}

async function markPending() {
    if (!await CenteredMessage.confirm($t('Betaling toch niet ontvangen?'), $t('Ja, niet ontvangen'), $t('De betaling blijft in verwerking waardoor je deze later terug als betaald kan markeren als je het zou ontvangen.'))) {
        return;
    }
    await mark(PaymentStatus.Pending);
}

async function markFailed() {
    if (!await CenteredMessage.confirm($t('Betaling annuleren?'), $t('Ja, annuleren'), $t('Een geannuleerde betaling zorgt ervoor dat een nieuwe poging tot betaling ondernomen kan worden - eventueel via een andere betaalmethode. Gebruik het om een betaling definitief als niet-betaald te markeren. De openstaande schuld van de schuldenaar stijgt dan opnieuw en het deel ‘in verwerking’ daalt terug.'))) {
        return;
    }
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
        Toast.success($t(`f7fab124-62ac-432c-80a7-5d594058f3f1`)).setHide(1000).show();
    }
    catch (e) {
        Toast.fromError(e).show();
    }
    markingPaid.value = false;
}

async function editBalanceItem(balanceItem: BalanceItem) {
    if (!canWrite.value) {
        return;
    }
    const component = new ComponentWithProperties(EditBalanceItemView, {
        balanceItem,
        isNew: false,
        saveHandler: async (patch: AutoEncoderPatchType<BalanceItemWithPayments>) => {
            const arr: PatchableArrayAutoEncoder<BalanceItemWithPayments> = new PatchableArray();
            patch.id = balanceItem.id;
            arr.addPatch(patch);
            await context.value.authenticatedServer.request({
                method: 'PATCH',
                path: '/organization/balance',
                body: arr,
                decoder: new ArrayDecoder(BalanceItemWithPayments),
                shouldRetry: false,
            });
            GlobalEventBus.sendEvent('balanceItemPatch', balanceItem.patch(patch)).catch(console.error);
        },
    });
    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: component,
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}
</script>
