<template>
    <div class="st-view">
        <STNavigationBar :title="$t(`Betalingen`)"/>

        <main>
            <h1>{{ $t('e8b43c8b-cc18-46bd-bc0c-d40f2dfc306c') }}</h1>

            <PayableBalanceTable v-for="item in collection.organizations" :key="item.organization.id" :item="item" :show-name="!singleOrganization"/>

            <template v-if="pendingPayments.length > 0">
                <hr><h2>{{ $t('8083d1d7-7325-4b2c-a708-9ddf0c5d38c8') }}</h2>
                <p>{{ $t('b06fe417-326d-471f-a8a7-936d4e8e9677') }}</p>

                <STList>
                    <PaymentRow v-for="payment of pendingPayments" :key="payment.id" :payments="pendingPayments" :payment="payment"/>
                </STList>
            </template>

            <hr><h2>{{ $t('e8b43c8b-cc18-46bd-bc0c-d40f2dfc306c') }}</h2>

            <p v-if="succeededPayments.length === 0" class="info-box">
                {{ $t('21f2f969-321e-4ced-b286-bf0e8caa64d7') }}
            </p>

            <STList v-else>
                <PaymentRow v-for="payment of succeededPayments" :key="payment.id" :payment="payment" :payments="succeededPayments"/>
            </STList>
        </main>
    </div>
</template>

<script setup lang="ts">
import { DetailedPayableBalanceCollection } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { computed } from 'vue';
import { GlobalEventBus } from '../EventBus';
import { Toast } from '../overlays/Toast';
import PayableBalanceTable from './PayableBalanceTable.vue';
import PaymentRow from './components/PaymentRow.vue';
import { useRequestOwner } from '@stamhoofd/networking';
import { useVisibilityChange } from '../composables';

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
