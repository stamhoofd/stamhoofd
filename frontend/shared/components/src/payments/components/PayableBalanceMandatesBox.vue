<template>
    <LoadingBoxTransition :error-box="errors.errorBox">
        <div v-if="mandates !== null">
            <p v-if="mandates.length === 0" class="info-box">
                {{ $t('Geen bankkaarten') }}
            </p>
            <STGrid v-else>
                <PaymentMandateRow v-for="mandate of mandates" :key="mandate.id" :mandate="mandate" :selectable="false">
                    <template #right>
                        <LoadingButton :loading="deletingMandates.has(mandate.id)">
                            <button v-tooltip="$t('Ontkoppel deze kaart')" type="button" class="button icon trash" @click.stop="deleteMandate(mandate.id)" />
                        </LoadingButton>
                    </template>
                </PaymentMandateRow>
            </STGrid>
        </div>
    </LoadingBoxTransition>
</template>

<script setup lang="ts">
import LoadingBoxTransition from '#containers/LoadingBoxTransition.vue';
import { useErrors } from '#errors/useErrors';
import { useRequiredOrganization } from '#hooks/useOrganization';
import STGrid from '#layout/STGrid.vue';
import PaymentMandateRow from '#mandates/PaymentMandateRow.vue';
import { useOrganizationPaymentMandates } from '#mandates/useOrganizationPaymentMandates';
import { CenteredMessage } from '#overlays/CenteredMessage';
import type { DetailedPayableBalance } from '@stamhoofd/structures';

const props = defineProps<{
    item: DetailedPayableBalance;
}>();

const organization = useRequiredOrganization()
const errors = useErrors();


const {mandates, deleteMandate: doDeleteMandate, deletingMandates} = useOrganizationPaymentMandates({
    payingOrganizationId: organization.value.id,
    sellingOrganizationId: props.item.organization.id,
    errors,
});

async function deleteMandate(mandateId: string) {
    if (!mandates.value) {
        return;
    }

    if (!await CenteredMessage.confirm({
        title: $t('Ben je zeker dat je deze bankkaart wilt verwijderen?'),
        requireCheckbox: $t('Ja, verwijder deze bankkaart'),
        confirmText: $t('Verwijderen'),
        destructive: true
    })) {
        return;
    }
    await doDeleteMandate(mandateId)
}



</script>
