<template>
    <LoadingViewTransition :error-box="errors.errorBox" >
        <PayableBalanceCollectionView v-if="payableBalanceCollection" :collection="payableBalanceCollection" :single-organization="false" />
    </LoadingViewTransition>
</template>

<script setup lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { PayableBalanceCollectionView, ErrorBox, useContext, useErrors, LoadingViewTransition } from '@stamhoofd/components';
import { useRequestOwner } from '@stamhoofd/networking';
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
