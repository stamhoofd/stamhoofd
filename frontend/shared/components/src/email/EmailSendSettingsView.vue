<template>
    <SaveView
        :title="title"
        class="group-edit-view"
        :loading="saving"
        :save-icon-mobile="willSend ? 'send' : undefined"
        :save-icon="willSend ? 'send' : undefined"
        :save-text="willSend ? (sendAsEmail ? $t('d1e7abf8-20ac-49e5-8e0c-cc7fab78fc6b') : $t('Publiceren')) : $t('Opslaan')"
        :prefer-large-button="willSend"
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
                    {{ $t('Toon in het ledenportaal') }}
                </h3>
                <p class="style-description-small">
                    {{ $t('Leden kunnen het bericht terugvinden in hun ledenportaal onder het tabblad ‘Berichten’') }}
                </p>
            </STListItem>

            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="sendAsEmail" :disabled="patchedEmail.status !== EmailStatus.Draft" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('Versturen als e-mail') }}
                </h3>
                <p class="style-description-small">
                    {{ $t('Het bericht wordt ook als e-mail verzonden') }}
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
import { usePatch } from '../hooks';
import { CenteredMessage } from '../overlays/CenteredMessage';
import { Toast } from '../overlays/Toast';
import { Formatter } from '@stamhoofd/utility';
import { ErrorBox } from '../errors/ErrorBox';

const props = withDefaults(defineProps<{
    editEmail: EmailPreview;
    willSend: boolean;
}>(), {
});

const { patch, hasChanges, patched: patchedEmail, addPatch } = usePatch(props.editEmail);

const title = props.willSend ? $t('Bericht versturen') : $t('Bericht instellingen');
const saving = ref(false);
const errors = useErrors();
const dismiss = useDismiss();

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
            confirmText = emailRecipientsCount === 1 ? $t('Ben je zeker dat je de e-mail naar 1 ontvanger wilt versturen?') : $t('Ben je zeker dat je de e-mail naar {count} ontvangers wilt versturen?', { count: Formatter.integer(emailRecipientsCount) });
        }

        if (!sendAsEmail.value) {
            confirmText = $t(`Ben je zeker dat je dit bericht in het ledenportaal wilt publiceren?`);
        }

        const isConfirm = await CenteredMessage.confirm(confirmText, sendAsEmail.value ? $t(`e0c68f8b-ccb1-4622-8570-08abc7f5705a`) : $t('Publiceren'));
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
            Toast.success($t(`0adee17a-6cb5-4b32-a2a9-c6f44cbb3e7d`)).show();
            await GlobalEventBus.sendEvent('selectTabById', 'communication');
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
