<template>
    <LoadingBoxTransition :error-box="errors.errorBox">
        <div v-if="mandates !== null">
            <p v-if="mandates.length === 0" class="info-box">
                {{ $t('Geen bankkaarten') }}
            </p>
            <STGrid v-else>
                <PaymentMandateRow v-for="mandate of mandates" :key="mandate.id" :mandate="mandate" :selectable="false" @contextmenu="showContextMenu($event, mandate.id)">
                    <template #right>
                        <LoadingButton :loading="updatingMandates.has(mandate.id)">
                            <button type="button" class="button icon more" @click.stop="showContextMenu($event, mandate.id)" />
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
import STGrid from '#layout/STGrid.vue';
import PaymentMandateRow from '#mandates/PaymentMandateRow.vue';
import { useOrganizationPaymentMandates } from '#mandates/useOrganizationPaymentMandates';
import { CenteredMessage } from '#overlays/CenteredMessage';
import { ContextMenu, ContextMenuItem } from '#overlays/ContextMenu';
import { Toast } from '#overlays/Toast';

const props = withDefaults(defineProps<{
    payingOrganizationId?: string | null,
    sellingOrganizationId: string, 
}>(), {
    payingOrganizationId: null, 
});

const errors = useErrors();

const {mandates, deleteMandate: doDeleteMandate, updatingMandates, setDefaultMandate} = useOrganizationPaymentMandates({
    payingOrganizationId: props.payingOrganizationId,
    sellingOrganizationId: props.sellingOrganizationId,
    errors,
});

async function showContextMenu(event: MouseEvent, mandateId: string) {
    event.preventDefault();
    const mandate = mandates.value?.find(m => m.id === mandateId);
    const isDefault = mandate?.isDefault;

    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: $t(`Instellen als standaard bankkaart`),
                icon: 'success',
                disabled: isDefault,
                action: async () => {
                    await setDefaultMandate(mandateId)
                },
            }),

            new ContextMenuItem({
                name: $t(`Verwijderen`),
                icon: 'trash',
                action: async () => {
                    await deleteMandate(mandateId)
                },
            }),
        ],
    ]);
    await menu.show({ clickEvent: event })
}

async function deleteMandate(mandateId: string) {
    if (!mandates.value) {
        return;
    }
    const mandate = mandates.value?.find(m => m.id === mandateId);
    if (mandate?.isDefault) {
        Toast.error('Voeg eerst een andere standaard betaalkaart toe').show();
        return;
    }

    if (!await CenteredMessage.confirm({
        title: $t('Ben je zeker dat je deze bankkaart wilt verwijderen?'),
        requireCheckbox: $t('Ja, verwijder “{cardNumber}”', {cardNumber: mandate?.name ?? $t('de bankkaart')}),
        confirmText: $t('Verwijderen'),
        destructive: true
    })) {
        return;
    }
    await doDeleteMandate(mandateId)
}

</script>
