<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save" v-on="!isNew && deleteHandler ? {delete: doDelete} : {}">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <STInputBox :title="$t('9ffdbf7d-83b1-45e3-8ad5-db07b4a22d1e') " error-fields="name" :error-box="errors.errorBox">
                <input v-model="name" class="input" type="text" :placeholder="$t('9ffdbf7d-83b1-45e3-8ad5-db07b4a22d1e') ">
            </STInputBox>
        </div>

        <STInputBox :title="$t('688fc9a3-68af-4aa3-ae6c-7d35a5f954ad')" error-fields="description" :error-box="errors.errorBox" class="max">
            <textarea v-model="description" class="input" type="text" :placeholder="$t('37739daf-2424-4f6e-a316-d4ac6bdaef85')" autocomplete="off" />
        </STInputBox>

        <hr><h2>{{ $t('1d742718-992d-4487-9c5e-a4ac46841a27') }}</h2>

        <p class="style-description-small">
            {{ $t('b82a5b97-5abe-4f63-97fe-a738d9698039') }}
        </p>

        <div class="split-inputs">
            <STInputBox :title="$t('87bd59dd-77fa-4519-9fab-abf46707e51f')" error-fields="minimumDays" :error-box="errors.errorBox">
                <NumberInput v-model="min" :placeholder="$t('e41660ea-180a-45ef-987c-e780319c4331')" :required="false" />
            </STInputBox>

            <STInputBox :title="$t('94f1f064-808e-4447-9813-d1c2d9a0375a')" error-fields="maximumDays" :error-box="errors.errorBox">
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

    if (!await CenteredMessage.confirm($t('0388e538-52e1-421e-baac-6d788adf44d3'), $t('838cae8b-92a5-43d2-82ba-01b8e830054b'), $t('78cf134f-d4fb-4da4-b077-0419f29e4268'))) {
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

    return await CenteredMessage.confirm($t('996a4109-5524-4679-8d17-6968282a2a75'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
