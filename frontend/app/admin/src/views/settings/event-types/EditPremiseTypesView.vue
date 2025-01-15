<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>

        <PremiseTypesList v-model="draggableTypes" :add-array-patch="addArrayPatch" />
    </SaveView>
</template>

<script lang="ts" setup>
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, Toast, useDraggableArray, useErrors, usePatchArray, usePlatform } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { usePlatformManager } from '@stamhoofd/networking';
import { Platform, PlatformConfig } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import PremiseTypesList from './PremiseTypesList.vue';

const errors = useErrors();
const pop = usePop();
const $t = useTranslate();
const platform = usePlatform();
const platformManager = usePlatformManager();

const originalTypes = computed(() => platform.value.config.premiseTypes);
const { patched: types, patch, addArrayPatch, hasChanges } = usePatchArray(originalTypes);
const draggableTypes = useDraggableArray(() => types.value, addArrayPatch);

const saving = ref(false);

const title = $t('5d0062df-e595-4e28-b1e3-d399102dfadf');

async function save() {
    if (saving.value) {
        return;
    }

    saving.value = true;

    try {
        await platformManager.value.patch(Platform.patch({
            config: PlatformConfig.patch({
                premiseTypes: patch.value,
            }),
        }));
        new Toast('De wijzigingen zijn opgeslagen', 'success green').show();
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
    return await CenteredMessage.confirm($t('996a4109-5524-4679-8d17-6968282a2a75'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
