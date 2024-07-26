<template>
    <SaveView :loading="saving" :title="title" :disabled="!hasChanges" :deleting="deleting" @save="save" v-on="!isNew && deleteHandler ? {delete: deleteMe} : {}">
        <h1>
            {{ title }}
        </h1>
        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox title="Naam" error-fields="name" :error-box="errors.errorBox">
            <input
                v-model="name"
                class="input"
                type="text"
                placeholder="Naam van deze keuze"
                autocomplete=""
            >
        </STInputBox>

        <ReduceablePriceInput v-model="price" title="Meer of minkost" :error-box="errors.errorBox" />

        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="hidden" />
                </template>

                <h3 class="style-title-list">
                    Verbergen
                </h3>
                <p v-if="hidden" class="style-description-small">
                    Deze keuze wordt onzichtbaar in het ledenportaal en is enkel manueel toe te voegen door een beheerder.
                </p>
            </STListItem>
            
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="useStock" />
                </template>

                <h3 class="style-title-list">
                    Beperk het beschikbare aantal stuks (waarvan nu {{ usedStock }} ingenomen of gereserveerd)
                </h3>

                <div v-if="useStock" class="split-inputs option" @click.stop.prevent>
                    <STInputBox title="" error-fields="stock" :error-box="errors.errorBox">
                        <NumberInput v-model="stock" suffix="stuks" suffix-singular="stuk" />
                    </STInputBox>
                </div>
            </STListItem>
        </STList>
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { NumberInput } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { Group, GroupOption, GroupOptionMenu } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import { useErrors } from '../../errors/useErrors';
import { usePatch } from '../../hooks';
import { CenteredMessage } from '../../overlays/CenteredMessage';
import { Toast } from '../../overlays/Toast';
import ReduceablePriceInput from './ReduceablePriceInput.vue';

const props = withDefaults(
    defineProps<{
        option: GroupOption;
        optionMenu: GroupOptionMenu;
        group: Group;
        isNew: boolean;
        saveHandler: (price: AutoEncoderPatchType<GroupOption>) => Promise<void>;
        deleteHandler?: (() => Promise<void>)|null,
        showToasts?: boolean
    }>(),
    {
        deleteHandler: null,
        showToasts: true
    }
);

const {patched, hasChanges, addPatch, patch} = usePatch(props.option);
const errors = useErrors();
const saving = ref(false);
const deleting = ref(false);
const $t = useTranslate();
const pop = usePop();

const title = computed(() => {
    return props.isNew ? $t('Nieuwe keuze') : $t('Wijzig keuze');
});

const name = computed({
    get: () => patched.value.name,
    set: (name) => addPatch({name})
})
const price = computed({
    get: () => patched.value.price,
    set: (price) => addPatch({price})
})

const hidden = computed({
    get: () => patched.value.hidden,
    set: (hidden) => addPatch({hidden})
})

const stock = computed({
    get: () => patched.value.stock,
    set: (stock) => addPatch({stock})
})

const usedStock = computed(() => patched.value.usedStock || 0);

const useStock = computed({
    get: () => patched.value.stock !== null,
    set: (useStock) => addPatch({stock: useStock ? (patched.value.usedStock || 10) : null})
})

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
    if (!await CenteredMessage.confirm($t('Ben je zeker dat je deze keuze wilt verwijderen?'), $t('shared.confirmDelete'), $t('De keuze wordt pas echt verwijderd als je verder gaat en alle wijzigingen opslaat.'))) {
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
