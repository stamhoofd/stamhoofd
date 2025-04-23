<template>
    <SaveView :disabled="!hasChanges" :loading="saving" :title="$t(`27bc7f00-1839-4f47-b8e5-7f4c6996fa53`)" @save="save">
        <h1>
            {{ $t('3936222c-5399-4d5e-9543-e483fa4f058a') }}
        </h1>
        <p>
            {{ $t('30fe36de-4e4e-42e3-a2f9-7740b028b415') }} <a :href="$domains.getDocs('toestemming-gegevens-verzamelen')" class="inline-link" target="_blank" rel="noopener">
                {{ $t('d6386cef-8e84-4107-920a-03db17372613') }}
            </a>
        </p>

        <p class="info-box">
            {{ $t('ca8ee961-5e7e-4d1f-9516-87879c277e14') }}
        </p>

        <hr><h2>{{ $t('b2a56f24-fea4-4874-90be-f2d15e93e862') }}</h2>
        <p>{{ $t('c7dc695c-d0d0-4a3e-9945-51696a8850be') }}</p>

        <STInputBox class="max" :title="$t(`cbe7db4a-b65b-452b-a5d2-d369182fd28f`)">
            <input v-model="title" class="input" :placeholder="inheritedDataPermission?.title || DataPermissionsSettings.defaultTitle">
        </STInputBox>

        <STInputBox class="max" :title="$t(`3e3c4d40-7d30-4f4f-9448-3e6c68b8d40d`)">
            <textarea v-model="description" class="input" :placeholder="$t(`9e0461d2-7439-4588-837c-750de6946287`)" />
        </STInputBox>

        <STInputBox class="max" :title="$t(`5886d034-5962-4d4c-99f3-35733367a20b`)">
            <input v-model="checkboxLabel" class="input" :placeholder="inheritedDataPermission?.checkboxLabel || DataPermissionsSettings.defaultCheckboxLabel">
        </STInputBox>
        <p class="style-description-small">
            {{ $t('929bd872-8953-4a6e-a277-a75f9e14e5e4') }}
        </p>

        <hr><h2>{{ $t('00ca2877-3df2-4a3e-a749-c3313045d1f9') }}</h2>
        <p>{{ $t('d4433860-9f94-4e9f-96c1-3a81ca7064fc') }}</p>

        <STInputBox class="max" :title="$t(`3ea9a45c-0b2c-4ed5-9307-d05cbabe8e0d`)">
            <input v-model="warningText" class="input" :placeholder="inheritedDataPermission?.warningText || DataPermissionsSettings.defaultWarningText">
        </STInputBox>

        <hr><h2>{{ $t('de540668-74ff-46a3-a6f6-0b82f4c6cd36') }}</h2>
        <p>{{ $t('269c6b82-ddc0-4530-9ac6-5057127d2426') }}</p>

        <STInputBox class="max" :title="$t(`a226a0aa-0706-4312-b51a-3712299c8b00`)">
            <input v-model="checkboxWarning" class="input" :placeholder="checkboxWarningPlaceholder">
        </STInputBox>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { DataPermissionsSettings } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import { usePatch } from '../hooks';
import { CenteredMessage } from '../overlays/CenteredMessage';

const props = withDefaults(
    defineProps<{
        dataPermission: DataPermissionsSettings;
        inheritedDataPermission?: DataPermissionsSettings | null;
        saveHandler: (patch: AutoEncoderPatchType<DataPermissionsSettings>) => Promise<void>;
    }>(), {
        inheritedDataPermission: null,
    },
);

const { patched, patch, addPatch, hasChanges } = usePatch(props.dataPermission);
const errors = useErrors();
const pop = usePop();

const saving = ref(false);

const title = computed({
    get: () => patched.value?.title ?? '',
    set: (title) => {
        addPatch({
            title,
        });
    },
});

const description = computed({
    get: () => patched.value?.description ?? '',
    set: (description) => {
        addPatch({
            description,
        });
    },
});

const checkboxLabel = computed({
    get: () => patched.value?.checkboxLabel ?? '',
    set: (checkboxLabel) => {
        addPatch({
            checkboxLabel,
        });
    },
});

const warningText = computed({
    get: () => patched.value?.warningText ?? '',
    set: (warningText) => {
        addPatch({
            warningText,
        });
    },
});

const checkboxWarning = computed({
    get: () => patched.value?.checkboxWarning ?? '',
    set: (checkboxWarning) => {
        addPatch({
            checkboxWarning: checkboxWarning ?? null,
        });
    },
});

const checkboxWarningPlaceholder = computed(() => {
    const base = props.inheritedDataPermission?.checkboxWarning || DataPermissionsSettings.defaultCheckboxWarning;
    if (!base) return '(Optioneel)';
    return base + ' (optioneel)';
});

async function save() {
    if (saving.value) {
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
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
};

defineExpose({
    shouldNavigateAway,
});

</script>
