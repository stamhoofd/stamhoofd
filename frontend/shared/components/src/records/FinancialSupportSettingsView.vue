<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges" @save="save">
        <h1>
            {{ title || FinancialSupportSettings.defaultTitle }}
        </h1>

        <p>{{ $t("367d239e-3b54-4eb0-b6bd-9c994f3f9523") }}</p>

        <p class="info-box">
            {{ $t('bf4e3b50-034f-4095-89ba-4580c09aaa43') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <template v-if="!inheritedFinancialSupport">
            <STInputBox class="max" :title="$t(`e5ccedf8-b036-4a6d-9340-3751894f0ae2`)">
                <input v-model="title" class="input" :placeholder="FinancialSupportSettings.defaultTitle">
            </STInputBox>
            <p class="style-description-small">
                {{ $t(`54c43796-dab2-4458-96b2-7566541e865b`) }}
            </p>
        </template>

        <hr><h2>{{ $t('b2a56f24-fea4-4874-90be-f2d15e93e862') }}</h2>
        <p>{{ $t('7ccf0d86-8609-411f-9f3f-fb801ae61b5e') }}</p>

        <STInputBox class="max" :title="$t(`3e3c4d40-7d30-4f4f-9448-3e6c68b8d40d`)">
            <textarea v-model="description" class="input" :placeholder="inheritedFinancialSupport?.description || FinancialSupportSettings.defaultDescription" />
        </STInputBox>
        <p class="style-description-small">
            {{ $t('133c6530-b963-48d4-b1a9-fd7a8d286772') }}
        </p>

        <STInputBox class="max" :title="$t(`5886d034-5962-4d4c-99f3-35733367a20b`)">
            <input v-model="checkboxLabel" class="input" :placeholder="inheritedFinancialSupport?.checkboxLabel || FinancialSupportSettings.defaultCheckboxLabel">
        </STInputBox>
        <p class="style-description-small">
            {{ $t(`fb1e6ade-f8d5-450e-8d10-029b29fce80d`) }}{{ FinancialSupportSettings.defaultCheckboxLabel }}"
        </p>

        <hr><h2>{{ $t('56be103d-0397-4d29-a75b-5e431a0ceadd') }}</h2>
        <p>{{ $t('04626342-7da4-4fb8-ba4a-9e9d2a6b1197') }}</p>

        <STInputBox class="max" :title="$t(`73dbf494-16a3-4e9a-8cbe-5170334209c0`)">
            <input v-model="warningText" class="input" :placeholder="inheritedFinancialSupport?.warningText || FinancialSupportSettings.defaultWarningText">
        </STInputBox>

        <hr><h2>{{ $t('7d4be8f3-fc0f-42ed-bb86-5bf672dedf5c') }}</h2>
        <p>{{ $t('d3c56d05-d038-4aad-b796-445ddce980b9') }}</p>

        <STInputBox :title="$t(`e5ccedf8-b036-4a6d-9340-3751894f0ae2`)">
            <input v-model="priceName" class="input" :placeholder="inheritedFinancialSupport?.priceName || FinancialSupportSettings.defaultPriceName">
        </STInputBox>

        <hr><h2>{{ $t('0208fdd1-27c1-42bc-b6fb-32dd4fafe7ee') }}</h2>
        <p>{{ $t('f29a7edb-249f-4332-a9f7-22fb53873be5') }}</p>

        <STList>
            <STListItem>
                <Checkbox v-model="preventSelfAssignment" :locked="inheritedFinancialSupport?.preventSelfAssignment">
                    {{ $t('7e707e25-868c-417a-adb1-05532b8d0c9e') }}
                </Checkbox>

                <template v-if="preventSelfAssignment">
                    <STInputBox class="max extra-padding" :title="$t(`da131f14-8671-4826-a270-34a867bf14b5`)">
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
    return await CenteredMessage.confirm($t(`c9111e95-2f59-4164-b0af-9fbf434bf6dd`), $t(`de41b0f3-1297-4058-b390-3bfb99e3d4e0`));
};

defineExpose({
    shouldNavigateAway,
});
</script>
