<template>
    <div class="st-view">
        <STNavigationBar :title="$t(`%76`)" />

        <main>
            <h1>{{ $t('%vX', {organization: item.organization.name}) }}</h1>

            <PayableBalanceTable :item="item" @checkout="checkout" />
        </main>
    </div>
</template>

<script setup lang="ts">
import PayableBalanceTable from '@stamhoofd/components/payments/PayableBalanceTable.vue';
import type { DetailedPayableBalance } from '@stamhoofd/structures';
import { OrganizationCheckout } from '@stamhoofd/structures';
import { PayBalanceMode } from './packages/OrganizationCheckoutViewModel';
import { useStartOrganizationCheckout } from './packages/useStartOrganizationCheckout';

const props = defineProps<{
    item: DetailedPayableBalance;
}>();
const startOrganizationCheckout = useStartOrganizationCheckout()

async function checkout() {
    await startOrganizationCheckout({
        payBalanceMode: PayBalanceMode.Recommended,
        sellingOrganization: props.item.organization,
        payableBalance: props.item,
        checkout: OrganizationCheckout.create({}),
        displayOptions: {
            action: 'show'
        }
    })
}

</script>
