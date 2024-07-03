<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox :title="$t('shared.name') ">
            <input
                v-model="name"
                class="input"
                type="text"
                :placeholder="$t('shared.name') "
            >
        </STInputBox>

        <STInputBox :title="$t('shared.description')" error-fields="settings.description" :error-box="errors.errorBox" class="max">
            <textarea
                v-model="description"
                class="input"
                type="text"
                :placeholder="$t('shared.optional')"
                autocomplete=""
            />
        </STInputBox>

        <div v-if="!isNew && deleteHandler" class="container">
            <hr>
            <h2>
                {{ $t('shared.actions') }}
            </h2>

            <button class="button secundary danger" type="button" @click="doDelete">
                <span class="icon trash" />
                <span>{{ $t('shared.delete') }}</span>
            </button>
        </div>
    </SaveView>
</template>


<script setup lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, SaveView, useErrors, usePatch } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { MembershipType } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

const errors = useErrors();
const saving = ref(false);
const deleting = ref(false);
const $t = useTranslate();

const props = defineProps<{
    type: MembershipType;
    isNew: boolean;
    saveHandler: (p: AutoEncoderPatchType<MembershipType>) => Promise<void>,
    deleteHandler: (() => Promise<void>)|null
}>();
const title = computed(() => props.isNew ? $t('admin.settings.membershipTypes.new.title') : $t('admin.settings.membershipTypes.edit.title'));
const pop = usePop();

const {patched, addPatch, hasChanges, patch} = usePatch(props.type);

const save = async () => {
    if (saving.value || deleting.value) {
        return;
    }
    saving.value = true;
    try {
        if (name.value.length < 2) {
            throw new SimpleError({
                code: "invalid_field",
                message: $t('shared.errors.name.empty'),
                field: "name"
            })
        }

        await props.saveHandler(patch.value)
        await pop({ force: true }) 
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    }
    saving.value = false;
};

const doDelete = async () => {
    if (saving.value || deleting.value) {
        return;
    }

    if (!props.deleteHandler) {
        return;
    }

    if (!await CenteredMessage.confirm($t('admin.settings.membershipTypes.delete.confirmation.title'), $t('shared.delete'), $t('admin.settings.membershipTypes.delete.confirmation.description'))) {
        return
    }
        
    deleting.value = true;
    try {
        await props.deleteHandler()
        await pop({ force: true }) 
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    }

    deleting.value = false;
};

const name = computed({
    get: () => patched.value.name,
    set: (name) => addPatch({name}),
});

const description = computed({
    get: () => patched.value.description,
    set: (description) => addPatch({description}),
});

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    
    return await CenteredMessage.confirm($t('shared.save.shouldNavigateAway.title'), $t('shared.save.shouldNavigateAway.confirm'))
}

defineExpose({
    shouldNavigateAway
})
</script>
