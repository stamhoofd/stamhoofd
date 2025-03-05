<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save" v-on="!isNew && deleteHandler ? {delete: doDelete} : {}">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox"/>

        <STInputBox :title="$t(`d32893b7-c9b0-4ea3-a311-90d29f2c0cf3`)">
            <input v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`4e6baa26-ebdd-43c1-a8f5-3da0b79ce646`)"></STInputBox>

        <STInputBox error-fields="privacyPolicyUrl" :error-box="errors.errorBox" :title="$t(`82530bca-53e8-4dc7-b04b-dc520853efc8`)">
            <input v-model="url" class="input" type="url" :placeholder="$t('4c8b6dd3-e058-45f7-8da8-1e1a6014a7a7')"></STInputBox>

        <UploadFileButton accept="application/pdf" @change="url = $event.getPublicPath()" :text="$t(`d25801f1-2a68-4d06-8ff7-29118efee363`)"/>

        <Checkbox v-model="enableAtSignup" class="long-text">
            {{ $t('f5d9f28e-0848-4f7c-b57e-1b7111aa00df') }}
        </Checkbox>

        <template v-if="enableAtSignup">
            <Checkbox v-model="checkbox" class="long-text">
                {{ $t('c97da592-24c7-462c-aa20-195e2e937a61') }}
            </Checkbox>
            <p class="style-description-small">
                {{ $t('3b90166d-41ad-46c0-96c4-ca975dec1131') }}
            </p>

            <STInputBox error-fields="meta.description" :error-box="errors.errorBox" class="max" :title="$t(`e62e2295-a80e-4e25-b559-991dfadb6daf`)">
                <WYSIWYGTextInput v-model="richText" :placeholder="$t(`e31632a6-b1b2-42b6-8803-b6cc8d21b7d6`)"/>
            </STInputBox>
            <p class="style-description-small">
                {{ $t('35402d81-fce4-44c0-b9e5-1f7b6d4e0f30') }}
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
const title = computed(() => props.isNew ? 'Nieuwe voorwaarden' : 'Voorwaarden bewerken');
const pop = usePop();
const $t = useTranslate();

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
                message: 'Gelieve een naam in te vullen',
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

    if (!await CenteredMessage.confirm('Ben je zeker dat je deze voorwaarden wilt verwijderen?', 'Verwijderen')) {
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
