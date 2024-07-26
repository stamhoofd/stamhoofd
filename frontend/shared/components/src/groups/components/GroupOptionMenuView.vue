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
const $t = useTranslate();
const pop = usePop();

const title = computed(() => {
    return props.isNew ? $t('Nieuw keuzemenu') : $t('Wijzig keuzemenu');
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
    if (!await CenteredMessage.confirm($t('Ben je zeker dat je dit keuzemenu wilt verwijderen?'), $t('shared.confirmDelete'), $t('Het keuzemenu wordt pas echt verwijderd als je verder gaat en alle wijzigingen opslaat.'))) {
        return;
    }
    if (deleting.value || saving.value || !props.deleteHandler) {
        return;
    }

    deleting.value = true;
    try {
        await props.deleteHandler();
        if (props.showToasts) {
            await Toast.success($t('shared.confirmation.deleted')).show();
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
    return await CenteredMessage.confirm($t('Ben je zeker dat je wilt sluiten zonder op te slaan?'), $t('Niet opslaan'))
}

defineExpose({
    shouldNavigateAway
})


</script>
