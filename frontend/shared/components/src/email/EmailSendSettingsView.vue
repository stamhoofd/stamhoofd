<template>
    <SaveView
        :title="title"
        class="group-edit-view"
        :loading="saving"
        :save-icon-mobile="willSend ? 'send' : undefined"
        :save-icon="willSend ? 'send' : undefined"
        :save-text="willSend ? (sendAsEmail ? $t('%1DC') : $t('%1Fe')) : $t('%v7')"
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
                    {{ $t('%1Ff') }}
                </h3>
                <p class="style-description-small">
                    {{ $t('%1Fg') }}
                </p>
            </STListItem>

            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="sendAsEmail" :disabled="patchedEmail.status !== EmailStatus.Draft" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('%1Fh') }}
                </h3>
                <p class="style-description-small">
                    {{ $t('%1Fi') }}
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

const title = props.willSend ? $t('%1Fj') : $t('%1Fk');
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
        let confirmText = $t(`%vI`);

        if (emailRecipientsCount) {
            confirmText = emailRecipientsCount === 1 ? $t('%1Fl') : $t('%1Fm', { count: Formatter.integer(emailRecipientsCount) });
        }

        if (!sendAsEmail.value) {
            confirmText = $t(`%1Fo`);
        }

        const isConfirm = await CenteredMessage.confirm(confirmText, sendAsEmail.value ? $t(`%1DC`) : $t('%1Fe'));
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
                Toast.success($t(`%vJ`)).show();
            }
            else {
                Toast.success($t('%1Fn')).show();
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
    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
