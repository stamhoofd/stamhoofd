<template>
    <LoadingView v-if="!outstandingBalance" :error-box="errors.errorBox" />
    <BillingStatusView v-else :items="outstandingBalance?.organizations" :single-organization="false" />
</template>

<script setup lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { BillingStatusView, ErrorBox, useContext, useErrors } from '@stamhoofd/components';
import { useRequestOwner } from '@stamhoofd/networking';
import { OrganizationDetailedBillingStatus } from '@stamhoofd/structures';
import { Ref, ref } from 'vue';

const owner = useRequestOwner();
const context = useContext()
const errors = useErrors()
const outstandingBalance = ref(null) as Ref<OrganizationDetailedBillingStatus | null>

updateBalance().catch(console.error)

// Fetch balance
async function updateBalance() {
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: `/user/billing/status/detailed`,
            decoder: OrganizationDetailedBillingStatus as Decoder<OrganizationDetailedBillingStatus>,
            shouldRetry: true,
            owner,
            timeout: 5 * 60 * 1000
        })

        outstandingBalance.value = response.data
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    }

}

</script>
