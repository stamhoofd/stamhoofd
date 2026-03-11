<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save" v-on="!isNew && deleteHandler ? {delete: doDelete} : {}">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox :title="$t(`%Gq`)">
            <input v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`%IK`)">
        </STInputBox>

        <STInputBox error-fields="privacyPolicyUrl" :error-box="errors.errorBox" :title="$t(`%IL`)">
            <input v-model="url" class="input" type="url" :placeholder="$t('%5y')">
        </STInputBox>

        <UploadFileButton accept="application/pdf" :text="$t(`%F`)" @change="url = $event.getPublicPath()" />

        <Checkbox v-model="enableAtSignup" class="long-text">
            {{ $t('%IG') }}
        </Checkbox>

        <template v-if="enableAtSignup">
            <Checkbox v-model="checkbox" class="long-text">
                {{ $t('%IH') }}
            </Checkbox>
            <p class="style-description-small">
                {{ $t('%II') }}
            </p>

            <STInputBox error-fields="meta.description" :error-box="errors.errorBox" class="max" :title="$t(`%IM`)">
                <WYSIWYGTextInput v-model="richText" :placeholder="$t(`%IN`)" />
            </STInputBox>
            <p class="style-description-small">
                {{ $t('%IJ') }}
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
const title = computed(() => props.isNew ? $t(`%IO`) : $t(`%IP`));
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
                message: $t(`%56`),
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

    if (!await CenteredMessage.confirm($t(`%IQ`), $t(`%CJ`))) {
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
    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
