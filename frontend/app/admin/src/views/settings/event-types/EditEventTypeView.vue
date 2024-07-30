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
                :placeholder="$t('Optioneel. Geef een uitleg wanneer dit type activiteit gebruikt moet worden.')"
                autocomplete=""
            />
        </STInputBox>

        <hr>
        <h2>{{ $t('Limieten') }}</h2>

        <STInputBox :title="$t('Maximum aantal activiteiten per jaar (optioneel)')" error-fields="maximum" :error-box="errors.errorBox">
            <NumberInput v-model="maximum" :placeholder="$t('Geen')" :required="false" />
        </STInputBox>
        <p class="style-description-small">{{ $t('Het maximum geldt per lokale groep') }}</p>

        <div class="split-inputs">
            <STInputBox :title="$t('Minimum aantal dagen')" error-fields="minimumDays" :error-box="errors.errorBox">
                <NumberInput v-model="minimumDays" :placeholder="$t('Geen')" :required="false" />
            </STInputBox>

            <STInputBox :title="$t('Maximum aantal dagen')" error-fields="maximumDays" :error-box="errors.errorBox">
                <NumberInput v-model="maximumDays" :placeholder="$t('Onbeperkt')" :required="false" />
            </STInputBox>
        </div>


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
import { CenteredMessage, ErrorBox, SaveView, useErrors, usePatch, NumberInput } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { PlatformEventType } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

const errors = useErrors();
const saving = ref(false);
const deleting = ref(false);
const $t = useTranslate();

const props = defineProps<{
    type: PlatformEventType;
    isNew: boolean;
    saveHandler: (p: AutoEncoderPatchType<PlatformEventType>) => Promise<void>,
    deleteHandler: (() => Promise<void>)|null
}>();
const title = computed(() => props.isNew ? $t('Nieuwe soort activiteit') : $t('Wijzig soort activiteit'));
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

    if (!await CenteredMessage.confirm($t('Ben je zeker dat je deze soort activiteit wilt verwijderen?'), $t('Verwijderen'), $t('Dit kan nare gevolgen hebben als er al activiteiten van dit type zijn'))) {
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

const maximum = computed({
    get: () => patched.value.maximum,
    set: (maximum) => addPatch({maximum}),
});

const minimumDays = computed({
    get: () => patched.value.minimumDays,
    set: (minimumDays) => addPatch({minimumDays}),
});

const maximumDays = computed({
    get: () => patched.value.maximumDays,
    set: (maximumDays) => addPatch({maximumDays}),
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
