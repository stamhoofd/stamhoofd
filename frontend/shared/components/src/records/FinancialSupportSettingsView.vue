<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges" @save="save">
        <h1>
            {{ title || FinancialSupportSettings.defaultTitle }}
        </h1>

        <p>{{ $t("639d486a-9f7c-4083-a10b-54809dca2c7c") }}</p>
         
        <p class="info-box">
            {{ $t('646b3e51-563e-44a3-b2da-d356c29019c3') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox"/>

        <template v-if="!inheritedFinancialSupport">
            <STInputBox class="max" :title="$t(`c27bda98-1c92-4aa2-86a7-a32d980ef60b`)">
                <input v-model="title" class="input" :placeholder="FinancialSupportSettings.defaultTitle"></STInputBox>
            <p class="style-description-small">
                {{ $t(`51b025f3-c08b-49bd-8884-f52bb5eb84fa`) }}
            </p>
        </template>

        <hr><h2>{{ $t('1999ed09-def6-4892-99a7-8b448ed667fb') }}</h2>
        <p>{{ $t('cf0653ca-5d45-4eec-8799-b36d23c410ed') }}</p>

        <STInputBox class="max" :title="$t(`f72f5546-ed6c-4c93-9b0d-9718f0cc9626`)">
            <textarea v-model="description" class="input" :placeholder="inheritedFinancialSupport?.description || FinancialSupportSettings.defaultDescription"/>
        </STInputBox>
        <p class="style-description-small">
            {{ $t('32c78d01-17b5-44f2-bb7a-907a310220c2') }}
        </p>

        <STInputBox class="max" :title="$t(`a56d3f07-e708-4dec-b508-b8c1bc29dd77`)">
            <input v-model="checkboxLabel" class="input" :placeholder="inheritedFinancialSupport?.checkboxLabel || FinancialSupportSettings.defaultCheckboxLabel"></STInputBox>
        <p class="style-description-small">
            {{ $t(`2e785781-b722-4431-b7d4-cf6ad702f2cb`) }}{{ FinancialSupportSettings.defaultCheckboxLabel }}"
        </p>

        <hr><h2>{{ $t('03a36461-9a39-479d-a37e-832d0defd2a7') }}</h2>
        <p>{{ $t('48cf6db1-dc0c-4392-85a1-b61b002d1ea4') }}</p>
        
        <STInputBox class="max" :title="$t(`ec2d213d-35b7-4938-bd72-a05f8a4569b0`)">
            <input v-model="warningText" class="input" :placeholder="inheritedFinancialSupport?.warningText || FinancialSupportSettings.defaultWarningText"></STInputBox>

        <hr><h2>{{ $t('6fcb249d-513b-4533-a2ad-da44b5b7d394') }}</h2>
        <p>{{ $t('bb1806eb-666b-4003-910a-36c284b495cb') }}</p>
        
        <STInputBox :title="$t(`c27bda98-1c92-4aa2-86a7-a32d980ef60b`)">
            <input v-model="priceName" class="input" :placeholder="inheritedFinancialSupport?.priceName || FinancialSupportSettings.defaultPriceName"></STInputBox>

        <hr><h2>{{ $t('b679f5d0-718b-4d63-8358-0e4cec9e946d') }}</h2>
        <p>{{ $t('7388c031-6285-4228-9fce-2a8901d29feb') }}</p>

        <STList>
            <STListItem>
                <Checkbox v-model="preventSelfAssignment" :locked="inheritedFinancialSupport?.preventSelfAssignment">
                    {{ $t('29e4863f-99b0-45dc-beea-676fdec2ba51') }}
                </Checkbox>

                <template v-if="preventSelfAssignment">
                    <STInputBox class="max extra-padding" :title="$t(`6e0723a1-1d1b-4102-832e-3178f8b8e258`)">
                        <textarea v-model="preventSelfAssignmentText" class="input" :placeholder="FinancialSupportSettings.defaultPreventSelfAssignmentText"/>
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
        financialSupport: FinancialSupportSettings,
        inheritedFinancialSupport?: FinancialSupportSettings|null,
        saveHandler: (patch: AutoEncoderPatchType<FinancialSupportSettings>) => Promise<void>
    }>(), {
        inheritedFinancialSupport: null
    }
);

const {patched, patch, addPatch, hasChanges} = usePatch(props.financialSupport);
const errors = useErrors();
const pop = usePop();

const saving = ref(false);

const title = computed({
    get: () => patched.value.title,
    set: (title) => {
        addPatch({
            title
        });
    }
});

const description = computed({
    get: () => patched.value.description,
    set: (description) => {
        addPatch({
            description
        });
    }
});

const checkboxLabel = computed({
    get: () => patched.value.checkboxLabel ?? "",
    set: (checkboxLabel) => {
        addPatch({
            checkboxLabel
        });
    }
});

const warningText = computed({
    get: () => patched.value.warningText ?? "",
    set: (warningText) => {
        addPatch({
            warningText
        });
    }
});

const priceName = computed({
    get: () => patched.value.priceName ?? "",
    set: (priceName) => {
        addPatch({
            priceName
        });
    }
});

const preventSelfAssignment = computed({
    get: () => patched.value.preventSelfAssignment === true || props.inheritedFinancialSupport?.preventSelfAssignment === true,
    set: (preventSelfAssignment: boolean) => {
        addPatch({
            preventSelfAssignment
        });
    }
});

const preventSelfAssignmentText = computed({
    get: () => patched.value.preventSelfAssignmentText,
    set: (preventSelfAssignmentText) => {
        addPatch({
            preventSelfAssignmentText
        });
    }
});

async function save() {
    if (saving.value) {
        return;
    }
    saving.value = true;
    try {
        await props.saveHandler(patch.value);
        await pop({force: true});
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    saving.value = false;
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
}

defineExpose({
    shouldNavigateAway
})
</script>
