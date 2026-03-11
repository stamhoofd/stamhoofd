<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges" @save="save">
        <h1>
            {{ title || FinancialSupportSettings.defaultTitle }}
        </h1>

        <p>{{ $t("%j4") }}</p>

        <p class="info-box">
            {{ $t('%iu') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <template v-if="!inheritedFinancialSupport">
            <STInputBox class="max" :title="$t(`%j5`)">
                <input v-model="title" class="input" :placeholder="FinancialSupportSettings.defaultTitle">
            </STInputBox>
            <p class="style-description-small">
                {{ $t(`%j6`) }}
            </p>
        </template>

        <hr><h2>{{ $t('%i4') }}</h2>
        <p>{{ $t('%iv') }}</p>

        <STInputBox class="max" :title="$t(`%6o`)">
            <textarea v-model="description" class="input" :placeholder="inheritedFinancialSupport?.description || FinancialSupportSettings.defaultDescription" />
        </STInputBox>
        <p class="style-description-small">
            {{ $t('%iw') }}
        </p>

        <STInputBox class="max" :title="$t(`%iB`)">
            <input v-model="checkboxLabel" class="input" :placeholder="inheritedFinancialSupport?.checkboxLabel || FinancialSupportSettings.defaultCheckboxLabel">
        </STInputBox>
        <p class="style-description-small">
            {{ $t(`%j7`) }}{{ FinancialSupportSettings.defaultCheckboxLabel }}"
        </p>

        <hr><h2>{{ $t('%ix') }}</h2>
        <p>{{ $t('%iy') }}</p>

        <STInputBox class="max" :title="$t(`%JE`)">
            <input v-model="warningText" class="input" :placeholder="inheritedFinancialSupport?.warningText || FinancialSupportSettings.defaultWarningText">
        </STInputBox>

        <hr><h2>{{ $t('%iz') }}</h2>
        <p>{{ $t('%j0') }}</p>

        <STInputBox :title="$t(`%j5`)">
            <input v-model="priceName" class="input" :placeholder="inheritedFinancialSupport?.priceName || FinancialSupportSettings.defaultPriceName">
        </STInputBox>

        <hr><h2>{{ $t('%j1') }}</h2>
        <p>{{ $t('%j2') }}</p>

        <STList>
            <STListItem>
                <Checkbox v-model="preventSelfAssignment" :locked="inheritedFinancialSupport?.preventSelfAssignment">
                    {{ $t('%j3') }}
                </Checkbox>

                <template v-if="preventSelfAssignment">
                    <STInputBox class="max extra-padding" :title="$t(`%j8`)">
                        <textarea v-model="preventSelfAssignmentText" class="input" :placeholder="FinancialSupportSettings.defaultPreventSelfAssignmentText" />
                    </STInputBox>
                </template>
            </STListItem>
        </STList>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { FinancialSupportSettings } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import { usePatch } from '../hooks';
import { CenteredMessage } from '../overlays/CenteredMessage';

const props = withDefaults(
    defineProps<{
        financialSupport: FinancialSupportSettings;
        inheritedFinancialSupport?: FinancialSupportSettings | null;
        saveHandler: (patch: AutoEncoderPatchType<FinancialSupportSettings>) => Promise<void>;
    }>(), {
        inheritedFinancialSupport: null,
    },
);

const { patched, patch, addPatch, hasChanges } = usePatch(props.financialSupport);
const errors = useErrors();
const pop = usePop();

const saving = ref(false);

const title = computed({
    get: () => patched.value.title,
    set: (title) => {
        addPatch({
            title,
        });
    },
});

const description = computed({
    get: () => patched.value.description,
    set: (description) => {
        addPatch({
            description,
        });
    },
});

const checkboxLabel = computed({
    get: () => patched.value.checkboxLabel ?? '',
    set: (checkboxLabel) => {
        addPatch({
            checkboxLabel,
        });
    },
});

const warningText = computed({
    get: () => patched.value.warningText ?? '',
    set: (warningText) => {
        addPatch({
            warningText,
        });
    },
});

const priceName = computed({
    get: () => patched.value.priceName ?? '',
    set: (priceName) => {
        addPatch({
            priceName,
        });
    },
});

const preventSelfAssignment = computed({
    get: () => patched.value.preventSelfAssignment === true || props.inheritedFinancialSupport?.preventSelfAssignment === true,
    set: (preventSelfAssignment: boolean) => {
        addPatch({
            preventSelfAssignment,
        });
    },
});

const preventSelfAssignmentText = computed({
    get: () => patched.value.preventSelfAssignmentText,
    set: (preventSelfAssignmentText) => {
        addPatch({
            preventSelfAssignmentText,
        });
    },
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
