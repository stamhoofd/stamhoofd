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
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { usePatchPlatform } from '@stamhoofd/components/hooks/usePatchPlatform.ts';
import { useDraggableArray } from '@stamhoofd/components/hooks/useDraggableArray.ts';
import { usePatchArray } from '@stamhoofd/components/hooks/usePatchArray.ts';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform.ts';
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { Platform, PlatformConfig } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import PremiseTypesList from './PremiseTypesList.vue';

const errors = useErrors();
const pop = usePop();

const platform = usePlatform();
const patchPlatform = usePatchPlatform();

const originalTypes = computed(() => platform.value.config.premiseTypes);
const { patched: types, patch, addArrayPatch, hasChanges } = usePatchArray(originalTypes);
const draggableTypes = useDraggableArray(() => types.value, addArrayPatch);

const saving = ref(false);

const title = $t('%5g');

async function save() {
    if (saving.value) {
        return;
    }

    saving.value = true;

    try {
        await patchPlatform(Platform.patch({
            config: PlatformConfig.patch({
                premiseTypes: patch.value,
            }),
        }));
        new Toast($t(`%HA`), 'success green').show();
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
    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
