<template>
    <SaveView
        :title="title"
        class="group-edit-view"
        :loading="saving"
        :save-icon-mobile="willSend ? 'send' : undefined"
        :save-icon="willSend ? 'send' : undefined"
        :save-text="willSend ? (sendAsEmail ? $t('d1e7abf8-20ac-49e5-8e0c-cc7fab78fc6b') : $t('c1cb8839-5e99-4b3c-bdcb-cdc43d9821b3')) : $t('87e450fe-1c15-4eed-9066-f78979e44810')"
        :prefer-large-button="false"
        :disabled="willSend && (!showInMemberPortal && !sendAsEmail)"
        @save="save"
    >
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="showInMemberPortal" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('6804cf8f-b057-41ce-a1b6-9b4f314dcab8') }}
                </h3>
                <p class="style-description-small">
                    {{ $t('3cdf36a0-362b-416c-a6ed-c971fcc5cbd3') }}
                </p>
            </STListItem>

            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="sendAsEmail" :disabled="patchedEmail.status !== EmailStatus.Draft" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('13e9b4f6-f1de-4af7-be7d-7d90f8a400d0') }}
                </h3>
                <p class="style-description-small">
                    {{ $t('d4ce8bf8-3868-4e41-8152-9a2d9bc05fac') }}
                </p>

                <template #right>
                    <p v-if="patchedEmail.emailRecipientsCount" class="style-description-small">
                        {{ formatInteger(patchedEmail.emailRecipientsCount) }}
                    </p>
                </template>
            </STListItem>
        </STList>
    </SaveView>
</template>

<script setup lang="ts">
import { useDismiss } from '@simonbackx/vue-app-navigation';
import { EmailPreview, EmailStatus } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import { usePatchEmail } from '../communication/hooks/usePatchEmail';
import { useErrors } from '../errors/useErrors';
import { GlobalEventBus } from '../EventBus';
import { useContext, usePatch } from '../hooks';
import { CenteredMessage } from '../overlays/CenteredMessage';
import { Toast } from '../overlays/Toast';
import { Formatter } from '@stamhoofd/utility';
import { ErrorBox } from '../errors/ErrorBox';
import { AppManager } from '@stamhoofd/networking';

const props = withDefaults(defineProps<{
    editEmail: EmailPreview;
    willSend: boolean;
}>(), {
});

const { patch, hasChanges, patched: patchedEmail, addPatch } = usePatch(props.editEmail);

const title = props.willSend ? $t('ce6d1409-7683-406e-836b-d1a48981c060') : $t('1dae9aca-798f-4dde-b420-8fcd4936a3fc');
const saving = ref(false);
const errors = useErrors();
const dismiss = useDismiss();
const context = useContext();

const showInMemberPortal = computed({
    get: () => patchedEmail.value?.showInMemberPortal ?? true,
    set: (show) => {
        addPatch({ showInMemberPortal: show });
    },
});

const sendAsEmail = computed({
    get: () => patchedEmail.value?.sendAsEmail ?? true,
    set: (send) => {
        addPatch({ sendAsEmail: send });
    },
});
const { patchEmail: doPatchEmail } = usePatchEmail();

async function save() {
    if (saving.value) {
        return;
    }

    if (props.willSend) {
        const emailRecipientsCount = patchedEmail.value.emailRecipientsCount;
        let confirmText = $t(`8ea1d574-6388-4033-bb4e-f2e031d2da3b`);

        if (emailRecipientsCount) {
            confirmText = emailRecipientsCount === 1 ? $t('62beee9f-1bbc-4d3c-9cec-58981122c5a6') : $t('3a666229-22b8-41b8-b2f8-17b70c32feb8', { count: Formatter.integer(emailRecipientsCount) });
        }

        if (!sendAsEmail.value) {
            confirmText = $t(`98603c16-adf9-4aa9-9685-4a1199dd04d4`);
        }

        const isConfirm = await CenteredMessage.confirm(confirmText, sendAsEmail.value ? $t(`e0c68f8b-ccb1-4622-8570-08abc7f5705a`) : $t('c1cb8839-5e99-4b3c-bdcb-cdc43d9821b3'));
        if (!isConfirm) {
            return;
        }
    }

    saving.value = true;
    try {
        if (props.willSend) {
            await doPatchEmail(
                props.editEmail,
                patch.value.patch({
                    status: EmailStatus.Queued,
                }),
            );
        }
        else {
            await doPatchEmail(
                props.editEmail,
                patch.value.patch({
                    status: EmailStatus.Queued,
                }),
            );
        }
        patch.value = EmailPreview.patch({});

        if (props.willSend) {
            if (props.editEmail.sendAsEmail) {
                Toast.success($t(`0adee17a-6cb5-4b32-a2a9-c6f44cbb3e7d`)).show();
            }
            else {
                Toast.success($t('730f955b-964e-4bb3-8caf-df6c7961c1ae')).show();
            }
            await GlobalEventBus.sendEvent('selectTabById', 'communication');

            // Mark review moment
            AppManager.shared.markReviewMoment(context.value);
        }
        await dismiss({ force: true });
    }
    catch (e) {
        console.error(e);
        errors.errorBox = new ErrorBox(e);
    }
    finally {
        saving.value = false;
    }
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('996a4109-5524-4679-8d17-6968282a2a75'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
