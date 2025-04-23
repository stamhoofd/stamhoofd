<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges && !isNew" :deleting="deleting" @save="save" v-on="!isNew && deleteHandler ? {delete: deleteMe} : {}">
        <h1>
            {{ title }}
        </h1>
        <STErrorsDefault :error-box="errors.errorBox" />

        <GroupOptionMenuBox :option-menu="patched" :group="group" :errors="errors" :level="1" @patch:option-menu="addPatch" @delete="deleteMe" />
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { Group, GroupOptionMenu } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import { useErrors } from '../../errors/useErrors';
import { usePatch } from '../../hooks';
import { CenteredMessage } from '../../overlays/CenteredMessage';
import { Toast } from '../../overlays/Toast';

import GroupOptionMenuBox from './GroupOptionMenuBox.vue';

const props = withDefaults(
    defineProps<{
        optionMenu: GroupOptionMenu;
        group: Group;
        isNew: boolean;
        saveHandler: (price: AutoEncoderPatchType<GroupOptionMenu>) => Promise<void>;
        deleteHandler?: (() => Promise<void>)|null,
        showToasts?: boolean
    }>(),
    {
        deleteHandler: null,
        showToasts: true
    }
);

const {patched, hasChanges, addPatch, patch} = usePatch(props.optionMenu);
const errors = useErrors();
const saving = ref(false);
const deleting = ref(false);

const pop = usePop();

const title = computed(() => {
    return props.isNew ? $t('a587b5d0-594e-421c-95a5-35c0c560938c') : $t('d7d3677f-6225-4769-a5b1-389a769bb84a');
});

async function save() {
    if (deleting.value || saving.value) {
        return;
    }

    saving.value = true;
    try {
        await props.saveHandler(patch.value);
        await pop({force: true})
    } catch (e) {
        Toast.fromError(e).show();
    } finally {
        saving.value = false;
    }
}

async function deleteMe() {
    if (!await CenteredMessage.confirm($t('f58412a9-9db9-4aa3-ad68-fa089d4f345b'), $t('201437e3-f779-47b6-b4de-a0fa00f3863e'), $t('9f8c1ed0-371b-4c22-940c-57d624734c18'))) {
        return;
    }
    if (deleting.value || saving.value || !props.deleteHandler) {
        return;
    }

    deleting.value = true;
    try {
        await props.deleteHandler();
        if (props.showToasts) {
            await Toast.success($t('eb66ea67-3c37-40f2-8572-9589d71ffab6')).show();
        }
        await pop({force: true})
    } catch (e) {
        Toast.fromError(e).show();
    } finally {
        deleting.value = false;
    }
}


const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('996a4109-5524-4679-8d17-6968282a2a75'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'))
}

defineExpose({
    shouldNavigateAway
})


</script>
