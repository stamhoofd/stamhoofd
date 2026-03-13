<template>
    <LoadingViewTransition :error-box="errors.errorBox" >
        <PayableBalanceCollectionView v-if="payableBalanceCollection" :collection="payableBalanceCollection" :single-organization="false" />
    </LoadingViewTransition>
</template>

<script setup lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox';
import { useContext } from '@stamhoofd/components/hooks/useContext';
import { useErrors } from '@stamhoofd/components/errors/useErrors';
import LoadingViewTransition from '@stamhoofd/components/containers/LoadingViewTransition.vue';
import PayableBalanceCollectionView from '@stamhoofd/components/payments/PayableBalanceCollectionView.vue';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import { DetailedPayableBalanceCollection } from '@stamhoofd/structures';
import { Ref, ref } from 'vue';

const owner = useRequestOwner();
const context = useContext();
const errors = useErrors();
const payableBalanceCollection = ref(null) as Ref<DetailedPayableBalanceCollection | null>;

updateBalance().catch(console.error);

// Fetch balance
async function updateBalance() {
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: `/user/payable-balance/detailed`,
            decoder: DetailedPayableBalanceCollection as Decoder<DetailedPayableBalanceCollection>,
            shouldRetry: true,
            owner,
            timeout: 5 * 60 * 1000,
        });

        payableBalanceCollection.value = response.data;
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
}

</script>
