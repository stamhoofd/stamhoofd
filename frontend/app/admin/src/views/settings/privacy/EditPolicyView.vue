<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save" v-on="!isNew && deleteHandler ? {delete: doDelete} : {}">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox :title="$t(`Naam`)">
            <input v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`bv. privacyvoorwaarden`)">
        </STInputBox>

        <STInputBox error-fields="privacyPolicyUrl" :error-box="errors.errorBox" :title="$t(`Volledige link`)">
            <input v-model="url" class="input" type="url" :placeholder="$t('4c8b6dd3-e058-45f7-8da8-1e1a6014a7a7')">
        </STInputBox>

        <UploadFileButton accept="application/pdf" :text="$t(`Upload PDF`)" @change="url = $event.getPublicPath()" />

        <Checkbox v-model="enableAtSignup" class="long-text">
            {{ $t('Tonen bij het registeren') }}
        </Checkbox>

        <template v-if="enableAtSignup">
            <Checkbox v-model="checkbox" class="long-text">
                {{ $t('Verplicht aanvinkvakje') }}
            </Checkbox>
            <p class="style-description-small">
                {{ $t('Het aanvinkvakje moet aangevinkt worden bij het registreren als je dit aanzet. In het andere geval is het enkel een vermelding die impliciet aanvaard wordt.') }}
            </p>

            <STInputBox error-fields="meta.description" :error-box="errors.errorBox" class="max" :title="$t(`Aanvinktekst`)">
                <WYSIWYGTextInput v-model="richText" :placeholder="$t(`Tekst die naast het aanvinkvakje staat`)" />
            </STInputBox>
            <p class="style-description-small">
                {{ $t('Herhaal jouw link in deze tekst door een deel van de tekst te selecteren en op de link-knop te drukken.') }}
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
const title = computed(() => props.isNew ? $t(`Nieuwe voorwaarden`) : $t(`Voorwaarden bewerken`));
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
                message: $t(`Gelieve een naam in te vullen`),
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

    if (!await CenteredMessage.confirm($t(`Ben je zeker dat je deze voorwaarden wilt verwijderen?`), $t(`Verwijderen`))) {
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
