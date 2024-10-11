<template>
    <LoadingView v-if="!billingStatus" />
    <div class="st-view">
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
                        {{ $t('Type') }}
                    </h3>
                    <p v-copyable class="style-definition-text">
                        {{ capitalizeFirstLetter(getReceivableBalanceTypeName(item.objectType, $t)) }}
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('Naam') }}
                    </h3>
                    <p v-copyable class="style-definition-text style-copyable">
                        {{ item.object.name }}
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('Openstaand bedrag') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(item.amountOpen) }}
                    </p>
                    <p v-if="item.amountPending !== 0" class="style-description-small">
                        {{ formatPrice(item.amount) }} waarvan {{ formatPrice(item.amountPending) }} in verwerking
                    </p>
                </STListItem>
            </STList>

            <hr>

            <h2>Overzicht</h2>

            <STList>
                <STListItem v-for="item in billingStatus?.balanceItems" :key="item.id">
                    <template #left>
                        <span v-if="item.amount === 0" class="style-amount min-width">
                            <span class="icon disabled gray" />
                        </span>
                        <span v-else class="style-amount min-width">{{ formatFloat(item.amount) }}</span>
                    </template>

                    <p v-if="item.itemPrefix" class="style-title-prefix-list">
                        {{ item.itemPrefix }}
                    </p>

                    <h3 class="style-title-list">
                        {{ item.itemTitle }}
                    </h3>

                    <p v-if="item.itemDescription" class="style-description-small">
                        {{ item.itemDescription }}
                    </p>

                    <p class="style-description-small">
                        {{ formatDate(item.createdAt) }}
                    </p>

                    <p v-if="item.amount === 0" class="style-description-small">
                        Deze schuld werd verwijderd maar werd al (deels) betaald
                    </p>

                    <p v-else class="style-description-small">
                        {{ formatFloat(item.amount) }} x {{ formatPrice(item.unitPrice) }} te betalen
                    </p>

                    <p v-if="item.pricePaid !== 0" class="style-description-small">
                        {{ formatPrice(item.pricePaid) }} betaald
                    </p>

                    <p v-if="item.pricePending !== 0" class="style-description-small">
                        {{ formatPrice(item.pricePending) }} in verwerking
                    </p>

                    <template #right>
                        <p class="style-price-base">
                            {{ formatPrice(item.priceOpen) }}
                        </p>
                    </template>
                </STListItem>
            </STList>

            <hr>

            <h2>Contactpersonen</h2>

            <p>Deze personen ontvangen een e-mail bij elke communicatie rond dit openstaand bedrag.</p>

            <STList class="info">
                <STListItem v-for="(contact, index) of item.object.contacts" :key="index">
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
import { LoadingView, useBackForward } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { ReceivableBalance, getReceivableBalanceTypeName, DetailedPayableBalance } from '@stamhoofd/structures';
import { computed, ref, Ref } from 'vue';

const props = defineProps<{
    item: ReceivableBalance;
    getNext: (current: ReceivableBalance) => ReceivableBalance | null;
    getPrevious: (current: ReceivableBalance) => ReceivableBalance | null;
}>();

const $t = useTranslate();
const { goBack, goForward, hasNext, hasPrevious } = useBackForward('item', props);
const billingStatus = ref(null) as Ref<null | DetailedPayableBalance>;

const title = computed(() => {
    return $t('Openstaand bedrag');
});

</script>
