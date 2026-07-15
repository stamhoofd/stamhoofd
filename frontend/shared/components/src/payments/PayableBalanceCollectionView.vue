<template>
    <div class="st-view">
        <STNavigationBar :title="$t(`%1JH`)" />

        <main>
            <h1>{{ $t('%1JH') }}</h1>

            <div v-for="item in collection.organizations.filter(o => o.filteredBalanceItems.length > 0)" :key="item.organization.id" class="container">
                <hr>
                <h2>
                    {{ singleOrganization ? $t('%1Ni') : $t('%vX', {organization: item.organization.name}) }}
                </h2>

                <PayableBalanceTable :item="item" @checkout="$emit('checkout', item)" />
            </div>


            <template v-if="pendingPayments.length > 0">
                <hr>
                <h2>{{ $t('%1OL') }}</h2>
                <p>{{ $t('%h6') }}</p>

                <STList>
                    <PaymentRow v-for="payment of pendingPayments" :key="payment.id" :payments="pendingPayments" :payment="payment" />
                </STList>
            </template>

            <hr><h2>{{ $t('%1JH') }}</h2>

            <p v-if="succeededPayments.length === 0" class="info-box">
                {{ $t('%h7') }}
            </p>

            <STList v-else>
                <PaymentRow v-for="payment of succeededPayments" :key="payment.id" :payment="payment" :payments="succeededPayments" />
            </STList>
        </main>
    </div>
</template>

<script setup lang="ts">
import { GlobalEventBus } from '#EventBus.ts';
import { useVisibilityChange } from '#hooks/useVisibilityChange';
import { Toast } from '#overlays/Toast';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import type { DetailedPayableBalance, DetailedPayableBalanceCollection } from '@stamhoofd/structures';
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
        collection: DetailedPayableBalanceCollection;
        reload?: (() => Promise<DetailedPayableBalanceCollection>) | null;
    }>(), {
        singleOrganization: false,
        reload: null,
    },
);

defineEmits<{
    checkout: [value: DetailedPayableBalance]
}>()
const owner = useRequestOwner();
const pendingPayments = computed(() => {
    return props.collection.organizations.flatMap(i => i.payments).filter(p => p.isPending).sort((a, b) => Sorter.byDateValue(a.createdAt, b.createdAt));
});

const succeededPayments = computed(() => {
    return props.collection.organizations.flatMap(i => i.payments).filter(p => !p.isPending).sort((a, b) => Sorter.byDateValue(a.createdAt, b.createdAt));
});

// Fetch balance
async function updateBalance() {
    if (!props.reload) {
        return;
    }

    try {
        await props.reload();
    }
    catch (e) {
        Toast.fromError(e).show();
    }
}

useVisibilityChange(async () => {
    await updateBalance();
});

GlobalEventBus.addListener(owner, 'paymentPatch', async () => {
    await updateBalance();
});

</script>
