<template>
    <div class="st-view">
        <STNavigationBar title="Betalingen" />

        <main>
            <h1>Betalingen</h1>

            <PayableBalanceTable v-for="item in items" :key="item.organization.id" :item="item" :show-name="!singleOrganization" />

            <template v-if="pendingPayments.length > 0">
                <hr>
                <h2>In verwerking</h2>
                <p>Bij betalingen via overschrijving of domiciliëring kan het even duren voor we een betaling ontvangen en bevestigen. Je kan hier de status opvolgen.</p>

                <STList>
                    <PaymentRow v-for="payment of pendingPayments" :key="payment.id" :payments="pendingPayments" :payment="payment" />
                </STList>
            </template>

            <hr>
            <h2>Betalingen</h2>

            <p v-if="succeededPayments.length === 0" class="info-box">
                Je hebt nog geen betalingen gedaan
            </p>

            <STList v-else>
                <PaymentRow v-for="payment of succeededPayments" :key="payment.id" :payment="payment" :payments="succeededPayments" />
            </STList>
        </main>
    </div>
</template>

<script setup lang="ts">
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { PaymentView } from '@stamhoofd/components';
import { DetailedPayableBalance, PaymentGeneral } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { computed } from 'vue';
import PayableBalanceTable from './PayableBalanceTable.vue';
import PaymentRow from './components/PaymentRow.vue';

const props = withDefaults(
    defineProps<{
        /**
         * Whether the view is dedicated to a single organization (so we can hide organization names in the view)
         */
        singleOrganization?: boolean;
        items: DetailedPayableBalance[];
    }>(), {
        singleOrganization: false,
    },
);

const present = usePresent();

const pendingPayments = computed(() => {
    return props.items.flatMap(i => i.payments).filter(p => p.isPending).sort((a, b) => Sorter.byDateValue(a.createdAt, b.createdAt));
});

const succeededPayments = computed(() => {
    return props.items.flatMap(i => i.payments).filter(p => !p.isPending).sort((a, b) => Sorter.byDateValue(a.createdAt, b.createdAt));
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
                    },
                }),
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

</script>
