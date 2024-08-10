<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <STInputBox :title="$t('shared.name') " error-fields="name" :error-box="errors.errorBox">
                <input
                    v-model="name"
                    class="input"
                    type="text"
                    :placeholder="$t('shared.name') "
                >
            </STInputBox>
        </div>

        <STInputBox :title="$t('Beschrijving')" error-fields="description" :error-box="errors.errorBox" class="max">
            <textarea
                v-model="description"
                class="input"
                type="text"
                :placeholder="$t('Optioneel Geef een beschrijving van dit soort gebouw.')"
                autocomplete=""
            />
        </STInputBox>

        <div v-if="!isNew && deleteHandler" class="container">
            <hr>
            <h2>
                {{ $t('Acties') }}
            </h2>

            <button class="button secundary danger" type="button" @click="doDelete">
                <span class="icon trash" />
                <span>{{ $t('Verwijderen') }}</span>
            </button>
        </div>
    </SaveView>
</template>


<script setup lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, SaveView, useErrors, usePatch } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { PlatformPremiseType } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

const errors = useErrors();
const saving = ref(false);
const deleting = ref(false);
const $t = useTranslate();

const props = defineProps<{
    type: PlatformPremiseType;
    isNew: boolean;
    saveHandler: (p: AutoEncoderPatchType<PlatformPremiseType>) => Promise<void>,
    deleteHandler: (() => Promise<void>)|null
}>();
const title = computed(() => props.isNew ? $t('Nieuw soort gebouw') : $t('Wijzig soort gebouw'));
const pop = usePop();

const {patched, addPatch, hasChanges, patch} = usePatch(props.type);

const save = async () => {
    if (saving.value || deleting.value) {
        return;
    }
    saving.value = true;
    try {
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

    if (!await CenteredMessage.confirm($t('Ben je zeker dat je dit soort gebouw wilt verwijderen?'), $t('Verwijderen'), $t('Dit kan nare gevolgen hebben als er al gebouwen van dit type zijn'))) {
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
    set: (description) => {
        console.log(description)
        addPatch({description})
    },
});

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
