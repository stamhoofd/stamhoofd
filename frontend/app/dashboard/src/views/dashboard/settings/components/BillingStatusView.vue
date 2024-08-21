<template>
    <div class="st-view">
        <STNavigationBar title="Betalingen" />

        <main>
            <h1>Betalingen</h1>

            <hr>
            <h2>Openstaand</h2>

            <OutstandingBalanceTable :items="item.balanceItems" />

            <template v-if="pendingPayments.length > 0">
                <hr>
                <h2>In verwerking</h2>
                <p>Bij betalingen via overschrijving of domiciliëring kan het even duren voor we een betaling ontvangen en bevestigen. Je kan hier de status opvolgen.</p>

                <STList>
                    <STListItem v-for="payment of pendingPayments" :key="payment.id" :selectable="true" class="right-stack" @click="openPayment(payment)">
                        <template #left>
                            <span class="icon clock" />
                        </template>

                        <h3 class="style-title-list">
                            {{ PaymentMethodHelper.getNameCapitalized(payment.method) }}
                        </h3>

                        <p v-if="payment.getShortDescription()" class="style-description-small">
                            {{ payment.getShortDescription() }}
                        </p>
                        <p class="style-description-small">
                            Aangemaakt op {{ formatDate(payment.createdAt) }}
                        </p>

                        <template #right>
                            <span class="style-price-base">{{ formatPrice(payment.price) }}</span>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </template>


            <hr>
            <h2>Betalingen</h2>

            <STList>
                <STListItem v-for="payment of succeededPayments" :key="payment.id" :selectable="true" class="right-stack" @click="openPayment(payment)">
                    <template #left>
                        <span class="icon success" />
                    </template>

                    <h3 class="style-title-list">
                        {{ PaymentMethodHelper.getNameCapitalized(payment.method) }}
                    </h3>
                    <p v-if="payment.getShortDescription()" class="style-description-small">
                        {{ payment.getShortDescription() }}
                    </p>

                    <p v-if="!payment.paidAt || formatDate(payment.createdAt) !== formatDate(payment.paidAt)" class="style-description-small">
                        Aangemaakt op {{ formatDate(payment.createdAt) }}
                    </p>
                    <p v-if="payment.paidAt" class="style-description-small">
                        Betaald op {{ formatDate(payment.paidAt) }}
                    </p>

                    <template #right>
                        <span class="style-price-base">{{ formatPrice(payment.price) }}</span>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script setup lang="ts">
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { PaymentView } from '@stamhoofd/components';
import { DetailedBillingStatusItem, PaymentGeneral, PaymentMethodHelper } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { computed } from 'vue';
import OutstandingBalanceTable from "./OutstandingBalanceTable.vue";

const props = defineProps<{
    item: DetailedBillingStatusItem
}>();

const present = usePresent()

const pendingPayments = computed(() => {
    return props.item.payments.filter(p => p.isPending).sort((a, b) => Sorter.byDateValue(a.createdAt, b.createdAt))
});

const succeededPayments = computed(() => {
    return props.item.payments.filter(p => !p.isPending).sort((a, b) => Sorter.byDateValue(a.createdAt, b.createdAt))
}); 

async function openPayment(payment: PaymentGeneral) {
    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(PaymentView, {
                    payment,
                    getNext: (payment: PaymentGeneral) => {
                        const index = succeededPayments.value.findIndex(p => p.id === payment.id);
                        if (index === -1 || index === succeededPayments.value.length - 1) {
                            return null;
                        }
                        return succeededPayments.value[index + 1];
                    },
                    getPrevious: (payment: PaymentGeneral) => {
                        const index = succeededPayments.value.findIndex(p => p.id === payment.id);
                        if (index === -1 || index === 0) {
                            return null;
                        }
                        return succeededPayments.value[index - 1];
                    }
                })
            })
        ],
        modalDisplayStyle: 'popup'
    })
}

</script>
