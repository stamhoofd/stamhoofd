<template>
    <SaveView :disabled="!hasChanges" :loading="saving" :title="$t(`%vY`)" @save="save">
        <h1>
            {{ $t('%vY') }}
        </h1>
        <p>
            {{ $t('%i1') }} <a :href="$domains.getDocs('toestemming-gegevens-verzamelen')" class="inline-link" target="_blank" rel="noopener">
                {{ $t('%i2') }}
            </a>
        </p>

        <p class="info-box">
            {{ $t('%i3') }}
        </p>

        <hr><h2>{{ $t('%i4') }}</h2>
        <p>{{ $t('%i5') }}</p>

        <STInputBox class="max" :title="$t(`%vC`)">
            <input v-model="title" class="input" :placeholder="inheritedDataPermission?.title || DataPermissionsSettings.defaultTitle">
        </STInputBox>

        <STInputBox class="max" :title="$t(`%6o`)">
            <textarea v-model="description" class="input" :placeholder="$t(`%14p`)" />
        </STInputBox>

        <STInputBox class="max" :title="$t(`%iB`)">
            <input v-model="checkboxLabel" class="input" :placeholder="inheritedDataPermission?.checkboxLabel || DataPermissionsSettings.defaultCheckboxLabel">
        </STInputBox>
        <p class="style-description-small">
            {{ $t('%i6') }}
        </p>

        <hr><h2>{{ $t('%i7') }}</h2>
        <p>{{ $t('%i8') }}</p>

        <STInputBox class="max" :title="$t(`%iC`)">
            <input v-model="warningText" class="input" :placeholder="inheritedDataPermission?.warningText || DataPermissionsSettings.defaultWarningText">
        </STInputBox>

        <hr><h2>{{ $t('%i9') }}</h2>
        <p>{{ $t('%iA') }}</p>

        <STInputBox class="max" :title="$t(`%iD`)">
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
    if (!base) return $t(`%10k`);
    return base + ' ' + $t(`%br`);
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
    return await CenteredMessage.confirm($t(`%A0`), $t(`%4X`));
};

defineExpose({
    shouldNavigateAway,
});

</script>
