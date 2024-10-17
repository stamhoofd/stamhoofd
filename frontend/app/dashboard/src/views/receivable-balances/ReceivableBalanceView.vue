<template>
    <LoadingView v-if="!detailedItem" />
    <div v-else class="st-view">
        <STNavigationBar :title="title">
            <template #right>
                <button v-if="hasPrevious || hasNext" v-tooltip="'Ga naar vorige groep'" type="button" class="button navigation icon arrow-up" :disabled="!hasPrevious" @click="goBack" />
                <button v-if="hasNext || hasPrevious" v-tooltip="'Ga naar volgende groep'" type="button" class="button navigation icon arrow-down" :disabled="!hasNext" @click="goForward" />
            </template>
        </STNavigationBar>

        <main>
            <h1 class="style-navigation-title">
                {{ title }}
            </h1>

            <STList class="info">
                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('4a07f8e5-c16e-4706-9387-9d3ded9e2b3c') }}
                    </h3>
                    <p v-copyable class="style-definition-text">
                        {{ capitalizeFirstLetter(getReceivableBalanceTypeName(detailedItem.objectType, $t)) }}
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('f7300ff2-638b-47c2-97b5-e8774aa0b6f5') }}
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ detailedItem.object.name }}
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('28c2bc66-231f-44f3-9249-c1981b871a1f') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(detailedItem.amount) }}
                    </p>
                    <p v-if="detailedItem.amountPending !== 0" class="style-description-small">
                        waarvan {{ formatPrice(detailedItem.amountPending) }} in verwerking
                    </p>
                </STListItem>
            </STList>

            <template v-if="filteredItems.length">
                <hr>

                <h2>Overzicht</h2>

                <SegmentedControl v-model="selectedTab" :items="['Gegroepeerd', 'Individueel']" />

                <ReceivableBalanceList v-if="selectedTab === 'Individueel'" :item="detailedItem" />
                <GroupedBalanceList v-else :item="detailedItem" />

                <BalancePriceBreakdown :item="detailedItem" />
            </template>

            <template v-if="pendingPayments.length > 0">
                <hr>
                <h2>In verwerking</h2>
                <p>Bij betalingen via overschrijving of domiciliëring kan het even duren voor een betaling wordt bevestigd.</p>

                <STList>
                    <PaymentRow v-for="payment of pendingPayments" :key="payment.id" :payments="pendingPayments" :payment="payment" />
                </STList>
            </template>

            <hr>
            <h2>Betalingen</h2>

            <p v-if="succeededPayments.length === 0" class="info-box">
                Je hebt nog geen ontvangen
            </p>

            <STList v-else>
                <PaymentRow v-for="payment of succeededPayments" :key="payment.id" :payment="payment" :payments="succeededPayments" />
            </STList>

            <hr>

            <h2>Contactpersonen</h2>

            <p>Deze personen ontvangen een e-mail bij elke communicatie rond dit openstaand bedrag.</p>

            <STList class="info">
                <STListItem v-for="(contact, index) of detailedItem.object.contacts" :key="index">
                    <h3 class="style-definition-label">
                        {{ contact.firstName || 'Onbekende naam' }} {{ contact.lastName }}
                    </h3>
                    <p v-for="(email, j) of contact.emails" :key="j" v-copyable class="style-definition-text style-copyable">
                        {{ email }}
                    </p>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { Decoder } from '@simonbackx/simple-encoding';
import { BalancePriceBreakdown, GlobalEventBus, GroupedBalanceList, LoadingView, PaymentRow, SegmentedControl, useBackForward, useContext } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { BalanceItemWithPayments, DetailedReceivableBalance, getReceivableBalanceTypeName, ReceivableBalance } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { computed, onMounted, ref, Ref } from 'vue';
import ReceivableBalanceList from './ReceivableBalanceList.vue';
import { useRequestOwner } from '@stamhoofd/networking';

const props = defineProps<{
    item: ReceivableBalance;
    getNext: (current: ReceivableBalance) => ReceivableBalance | null;
    getPrevious: (current: ReceivableBalance) => ReceivableBalance | null;
}>();

const $t = useTranslate();
const { goBack, goForward, hasNext, hasPrevious } = useBackForward('item', props);
const detailedItem = ref(null) as Ref<null | DetailedReceivableBalance>;
const context = useContext();
const selectedTab = ref('Gegroepeerd') as Ref<'Gegroepeerd' | 'Individueel'>;
const owner = useRequestOwner();

const title = computed(() => {
    return $t('28c2bc66-231f-44f3-9249-c1981b871a1f');
});

const pendingPayments = computed(() => {
    return detailedItem.value?.payments.filter(p => p.isPending).sort((a, b) => Sorter.byDateValue(a.createdAt, b.createdAt)) ?? [];
});

const succeededPayments = computed(() => {
    return detailedItem.value?.payments.filter(p => !p.isPending).sort((a, b) => Sorter.byDateValue(a.createdAt, b.createdAt)) ?? [];
});

const filteredItems = computed(() => {
    return detailedItem.value?.balanceItems.filter(i => BalanceItemWithPayments.getOutstandingBalance([i]).priceOpen !== 0) ?? [];
});

// Load detailed item
onMounted(async () => {
    await reload();
});

async function reload() {
    const response = await context.value.authenticatedServer.request({
        method: 'GET',
        path: `/receivable-balances/${props.item.objectType}/${props.item.object.id}`,
        decoder: DetailedReceivableBalance as Decoder<DetailedReceivableBalance>,
        owner,
    });

    detailedItem.value = response.data;
}

// Listen for patches in payments
GlobalEventBus.addListener(owner, 'paymentPatch', async () => {
    await reload();
});

GlobalEventBus.addListener(owner, 'balanceItemPatch', async () => {
    await reload();
});

</script>
