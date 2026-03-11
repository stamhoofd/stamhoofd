<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save" v-on="!isNew && deleteHandler ? {delete: doDelete} : {}">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <STInputBox :title="$t('17edcdd6-4fb2-4882-adec-d3a4f43a1926') " error-fields="name" :error-box="errors.errorBox">
                <input v-model="name" class="input" type="text" :placeholder="$t('17edcdd6-4fb2-4882-adec-d3a4f43a1926') ">
            </STInputBox>
        </div>

        <STInputBox :title="$t('11d6f2fc-c72d-4c18-aa6d-b8118c2aaa5c')" error-fields="description" :error-box="errors.errorBox" class="max">
            <textarea v-model="description" class="input" type="text" :placeholder="$t('37739daf-2424-4f6e-a316-d4ac6bdaef85')" autocomplete="off" />
        </STInputBox>

        <hr><h2>{{ $t('1d742718-992d-4487-9c5e-a4ac46841a27') }}</h2>

        <p class="style-description-small">
            {{ $t('b82a5b97-5abe-4f63-97fe-a738d9698039') }}
        </p>

        <div class="split-inputs">
            <STInputBox :title="$t('87bd59dd-77fa-4519-9fab-abf46707e51f')" error-fields="minimumDays" :error-box="errors.errorBox">
                <NumberInput v-model="min" :placeholder="$t('3ef9e622-426f-4913-89a0-0ce08f4542d4')" :required="false" />
            </STInputBox>

            <STInputBox :title="$t('701fc423-4bf4-4de7-917b-eed7923b2164')" error-fields="maximumDays" :error-box="errors.errorBox">
                <NumberInput v-model="max" :placeholder="$t('104dca1f-f6eb-4193-ae27-5e5f96e4e481')" :required="false" />
            </STInputBox>
        </div>
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, NumberInput, SaveView, useErrors, usePatch } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { PlatformPremiseType } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

const errors = useErrors();
const saving = ref(false);
const deleting = ref(false);

const props = defineProps<{
    type: PlatformPremiseType;
    isNew: boolean;
    saveHandler: (p: AutoEncoderPatchType<PlatformPremiseType>) => Promise<void>;
    deleteHandler: (() => Promise<void>) | null;
}>();
const title = computed(() => props.isNew ? $t('58949c21-cefa-4818-b643-72b41b6e0449') : $t('595705ee-d41e-474a-8180-17b94cd0a3cc'));
const pop = usePop();

const { patched, addPatch, hasChanges, patch } = usePatch(props.type);

const save = async () => {
    if (saving.value || deleting.value) {
        return;
    }
    saving.value = true;
    try {
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

    if (!await CenteredMessage.confirm($t('0388e538-52e1-421e-baac-6d788adf44d3'), $t('14f2d606-a7c9-4cdf-9ee9-aca38beb9689'), $t('78cf134f-d4fb-4da4-b077-0419f29e4268'))) {
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

const description = computed({
    get: () => patched.value.description,
    set: description => addPatch({ description }),
});

const min = computed({
    get: () => patched.value.min,
    set: min => addPatch({ min }),
});

const max = computed({
    get: () => patched.value.max,
    set: max => addPatch({ max }),
});

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }

    return await CenteredMessage.confirm($t('1cb53933-ed06-45ae-9240-dd389298823c'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
