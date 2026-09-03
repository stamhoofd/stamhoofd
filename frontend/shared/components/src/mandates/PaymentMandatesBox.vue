<template>
    <LoadingBoxTransition :error-box="errors.errorBox">
        <div v-if="mandates !== null">
            <p v-if="mandates.length === 0" class="info-box">
                {{ $t('%1TE') }}
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
    payingOrganizationId?: string | null;
    sellingOrganizationId: string;

    /**
     * Whether the viewer is an admin of the selling organization and may block or unblock mandates
     */
    canBlock?: boolean;
}>(), {
    payingOrganizationId: null,
    canBlock: false,
});

const errors = useErrors();

const { mandates, deleteMandate: doDeleteMandate, updatingMandates, setDefaultMandate, setMandateBlocked } = useOrganizationPaymentMandates({
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
                name: $t(`%1Tc`),
                icon: 'success',
                disabled: isDefault || mandate?.isBlocked,
                action: async () => {
                    await setDefaultMandate(mandateId);
                },
            }),
            ...(props.canBlock
                ? [
                        mandate?.isBlocked
                            ? new ContextMenuItem({
                                    name: $t('%Zqs'),
                                    icon: 'unlock',
                                    action: async () => {
                                        await setMandateBlocked(mandateId, false);
                                    },
                                })
                            : new ContextMenuItem({
                                    name: $t('%Zqi'),
                                    icon: 'lock',
                                    action: async () => {
                                        await blockMandate(mandateId);
                                    },
                                }),
                    ]
                : []),

            new ContextMenuItem({
                name: $t(`%CJ`),
                icon: 'trash',
                destructive: true,
                action: async () => {
                    await deleteMandate(mandateId);
                },
            }),
        ],
    ]);
    await menu.show({ clickEvent: event });
}

async function blockMandate(mandateId: string) {
    const mandate = mandates.value?.find(m => m.id === mandateId);

    if (!await CenteredMessage.confirm({
        title: $t('%Zqq', { cardNumber: mandate?.name ?? $t('%ZgC') }),
        description: $t('%Zqo'),
        confirmText: $t('%Zqi'),
        destructive: true,
    })) {
        return;
    }
    await setMandateBlocked(mandateId, true);
}

async function deleteMandate(mandateId: string) {
    if (!mandates.value) {
        return;
    }
    const mandate = mandates.value?.find(m => m.id === mandateId);
    const fallback = $t('%ZgC');

    if (!await CenteredMessage.confirm({
        title: $t('%1UA'),
        requireCheckbox: $t('%1T7', { cardNumber: mandate?.name ?? fallback }),
        confirmText: $t('%CJ'),
        destructive: true,
    })) {
        return;
    }
    await doDeleteMandate(mandateId);
}

</script>
