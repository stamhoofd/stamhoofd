<template>
    <div class="st-view">
        <STNavigationBar :title="$t(`cda73dc5-5612-4561-bf92-f18157dcad64`)" />

        <main>
            <h1>{{ $t('290c7beb-61c7-425d-b35e-333aba83bbc5') }}</h1>

            <PayableBalanceTable v-for="item in collection.organizations" :key="item.organization.id" :item="item" :show-name="!singleOrganization" />

            <template v-if="pendingPayments.length > 0">
                <hr><h2>{{ $t('ac279f6b-0c7c-4ef1-9178-1fd030fe7cc8') }}</h2>
                <p>{{ $t('d0099dec-d92f-41dc-9e42-7409de459d71') }}</p>

                <STList>
                    <PaymentRow v-for="payment of pendingPayments" :key="payment.id" :payments="pendingPayments" :payment="payment" />
                </STList>
            </template>

            <hr><h2>{{ $t('290c7beb-61c7-425d-b35e-333aba83bbc5') }}</h2>

            <p v-if="succeededPayments.length === 0" class="info-box">
                {{ $t('24b3d716-8db4-49c6-991d-239d5824e34d') }}
            </p>

            <STList v-else>
                <PaymentRow v-for="payment of succeededPayments" :key="payment.id" :payment="payment" :payments="succeededPayments" />
            </STList>
        </main>
    </div>
</template>

<script setup lang="ts">
import { useRequestOwner } from '@stamhoofd/networking';
import { DetailedPayableBalanceCollection } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { computed } from 'vue';
import { GlobalEventBus } from '../EventBus';
import { useVisibilityChange } from '../hooks/useVisibilityChange.js';
import { Toast } from '../overlays/Toast';
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
        const updated = await props.reload!();
        props.collection.deepSet(updated);
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
