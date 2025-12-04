<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save" v-on="!isNew && deleteHandler ? {delete: doDelete} : {}">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox :title="$t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`)">
            <input v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`ab3872b4-6ef5-4584-af47-89e6a17e04b3`)">
        </STInputBox>

        <STInputBox error-fields="privacyPolicyUrl" :error-box="errors.errorBox" :title="$t(`a0fa9d2c-106e-4cb4-9e78-d137934fd2b1`)">
            <input v-model="url" class="input" type="url" :placeholder="$t('4c8b6dd3-e058-45f7-8da8-1e1a6014a7a7')">
        </STInputBox>

        <UploadFileButton accept="application/pdf" :text="$t(`00204508-e8ce-4b81-b978-4b0a4a0472f5`)" @change="url = $event.getPublicPath()" />

        <Checkbox v-model="enableAtSignup" class="long-text">
            {{ $t('c9169aad-6b6f-4701-b079-a9936697984c') }}
        </Checkbox>

        <template v-if="enableAtSignup">
            <Checkbox v-model="checkbox" class="long-text">
                {{ $t('1abf9a19-7075-498f-b7d7-d47fa9cfe2dc') }}
            </Checkbox>
            <p class="style-description-small">
                {{ $t('95480dc5-e4fd-4f88-9fe5-242f504180c0') }}
            </p>

            <STInputBox error-fields="meta.description" :error-box="errors.errorBox" class="max" :title="$t(`8b7c18d3-3588-4f07-a269-391283e4c2cc`)">
                <WYSIWYGTextInput v-model="richText" :placeholder="$t(`8eb4e674-0b88-48b5-a4e7-ea9021caf952`)" />
            </STInputBox>
            <p class="style-description-small">
                {{ $t('32f88e2b-d43e-49b2-b60b-dd2247700aeb') }}
            </p>
        </template>
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, Checkbox, ErrorBox, SaveView, UploadFileButton, useErrors, usePatch, WYSIWYGTextInput } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { PlatformPolicy } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

const errors = useErrors();
const saving = ref(false);
const deleting = ref(false);

const props = defineProps<{
    policy: PlatformPolicy;
    isNew: boolean;
    saveHandler: (p: AutoEncoderPatchType<PlatformPolicy>) => Promise<void>;
    deleteHandler: (() => Promise<void>) | null;
}>();
const title = computed(() => props.isNew ? $t(`2e109d45-8777-45fe-9596-4a08785f5923`) : $t(`ced74e50-34b9-4d83-a89d-542c4b0c4c45`));
const pop = usePop();

const { patched, addPatch, hasChanges, patch } = usePatch(props.policy);

const save = async () => {
    if (saving.value || deleting.value) {
        return;
    }
    saving.value = true;
    try {
        if (name.value.length === 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: $t(`f1755667-e6d5-4532-95a9-019c04c509bc`),
                field: 'name',
            });
        }

        await props.saveHandler(patch.value);
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    saving.value = false;
};

const doDelete = async () => {
    if (saving.value || deleting.value) {
        return;
    }

    if (!props.deleteHandler) {
        return;
    }

    if (!await CenteredMessage.confirm($t(`a1f2fa4d-10a4-4b67-af10-0fafda4b0246`), $t(`63af93aa-df6a-4937-bce8-9e799ff5aebd`))) {
        return;
    }

    deleting.value = true;
    try {
        await props.deleteHandler();
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    deleting.value = false;
};

const name = computed({
    get: () => patched.value.name,
    set: name => addPatch({ name }),
});

const url = computed({
    get: () => patched.value.url,
    set: url => addPatch({ url }),
});

const richText = computed({
    get: () => patched.value.richText,
    set: richText => addPatch({ richText }),
});

const checkbox = computed({
    get: () => patched.value.checkbox,
    set: checkbox => addPatch({ checkbox }),
});

const enableAtSignup = computed({
    get: () => patched.value.enableAtSignup,
    set: enableAtSignup => addPatch({ enableAtSignup }),
});

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
