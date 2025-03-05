<template>
    <SaveView :disabled="!hasChanges" :loading="saving" @save="save" :title="$t(`Toestemming gegevensverzameling`)">
        <h1>
            {{ $t('584a8a6a-a446-4d6c-be89-41ee5713f4cd') }}
        </h1>
        <p>
            {{ $t('8580237d-e30f-4ae7-9f7d-efeb6d224624') }} <a :href="$domains.getDocs('toestemming-gegevens-verzamelen')" class="inline-link" target="_blank" rel="noopener">
                {{ $t('d7a53a98-eb19-4907-bfef-ffaf672524bf') }}
            </a>
        </p>

        <p class="info-box">
            {{ $t('aa770d65-de40-4cb2-afcc-1e4ff1e7c063') }}
        </p>

        <hr><h2>{{ $t('1999ed09-def6-4892-99a7-8b448ed667fb') }}</h2>
        <p>{{ $t('af7f8f76-7c5d-4226-8aef-5c7950125775') }}</p>

        <STInputBox class="max" :title="$t(`04043e8a-6a58-488e-b538-fea133738532`)">
            <input v-model="title" class="input" :placeholder="inheritedDataPermission?.title || DataPermissionsSettings.defaultTitle"></STInputBox>

        <STInputBox class="max" :title="$t(`f72f5546-ed6c-4c93-9b0d-9718f0cc9626`)">
            <textarea v-model="description" class="input" :placeholder="$t(`e64a0d25-fe5a-4c87-a087-97ad30b2b12b`)"/>
        </STInputBox>

        <STInputBox class="max" :title="$t(`a56d3f07-e708-4dec-b508-b8c1bc29dd77`)">
            <input v-model="checkboxLabel" class="input" :placeholder="inheritedDataPermission?.checkboxLabel || DataPermissionsSettings.defaultCheckboxLabel"></STInputBox>
        <p class="style-description-small">
            {{ $t('040bf147-5432-4272-bf4b-c7ff444f53f2') }} 
        </p>

        <hr><h2>{{ $t('964ddfbe-21a4-42d7-aa87-39d9a2872237') }}</h2>
        <p>{{ $t('e70589ef-5114-4c59-8549-412a6df67b8a') }}</p>
    
        <STInputBox class="max" :title="$t(`08cf0719-3841-497b-b18f-ce56703eeace`)">
            <input v-model="warningText" class="input" :placeholder="inheritedDataPermission?.warningText || DataPermissionsSettings.defaultWarningText"></STInputBox>

        <hr><h2>{{ $t('750fd745-976a-4168-b3da-2976ea18daea') }}</h2>
        <p>{{ $t('4d6676d6-3a58-4758-8433-f5c67e0ed002') }}</p>
    
        <STInputBox class="max" :title="$t(`5294ef59-b6e4-4978-93c8-9a1d18a3b813`)">
            <input v-model="checkboxWarning" class="input" :placeholder="checkboxWarningPlaceholder"></STInputBox>
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
        dataPermission: DataPermissionsSettings,
        inheritedDataPermission?: DataPermissionsSettings|null,
        saveHandler: (patch: AutoEncoderPatchType<DataPermissionsSettings>) => Promise<void>
    }>(), {
        inheritedDataPermission: null
    }
);

const {patched, patch, addPatch, hasChanges} = usePatch(props.dataPermission);
const errors = useErrors();
const pop = usePop();

const saving = ref(false);

const title = computed({
    get: () => patched.value?.title ?? "",
    set: (title) => {
        addPatch({
            title
        });
    }
});

const description = computed({
    get: () => patched.value?.description ?? "",
    set: (description) => {
        addPatch({
            description
        });
    }
});

const checkboxLabel = computed({
    get: () => patched.value?.checkboxLabel ?? "",
    set: (checkboxLabel) => {
        addPatch({
            checkboxLabel
        });
    }
});

const warningText = computed({
    get: () => patched.value?.warningText ?? "",
    set: (warningText) => {
        addPatch({
            warningText
        });
    }
});

const checkboxWarning = computed({
    get: () => patched.value?.checkboxWarning ?? "",
    set: (checkboxWarning) => {
        addPatch({
            checkboxWarning: checkboxWarning ?? null
        });
    }
});

const checkboxWarningPlaceholder = computed(() => {
    const base = props.inheritedDataPermission?.checkboxWarning || DataPermissionsSettings.defaultCheckboxWarning;
    if(!base) return '(Optioneel)';
    return base + ' (optioneel)';
})

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
