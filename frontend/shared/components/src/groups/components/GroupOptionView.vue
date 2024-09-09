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

        <ReduceablePriceInput v-model="price" :group="group" title="Meer of minkost" :error-box="errors.errorBox" :validator="errors.validator" />

        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="hidden" />
                </template>

                <h3 class="style-title-list">
                    Verborgen
                </h3>
                <p v-if="hidden" class="style-description-small">
                    Deze keuze wordt onzichtbaar in het ledenportaal en is enkel manueel toe te voegen door een beheerder.
                </p>
            </STListItem>
            
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="allowAmount" />
                </template>

                <h3 class="style-title-list">
                    Meerdere stuks
                </h3>
                <p class="style-description-small">
                    Een lid kan zelf een aantal stuks kiezen met een invulveld en plus- en minknop bij deze keuze.
                </p>
            </STListItem>

            <STListItem v-if="allowAmount" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="useMaximum" />
                </template>

                <h3 class="style-title-list">
                    Beperk hoeveel stuks maximaal kunnen worden gekozen per inschrijving
                </h3>

                <div v-if="useMaximum" class="split-inputs option" @click.stop.prevent>
                    <STInputBox title="Maximum aantal" error-fields="maximum" :error-box="errors.errorBox">
                        <NumberInput v-model="maximum" suffix="stuks" suffix-singular="stuk" :required="false" :placeholder="$t('c5562430-7c78-454c-8d61-7b4a98fbaf02')" :min="2" />
                    </STInputBox>
                </div>
            </STListItem>

            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="useStock" />
                </template>

                <h3 class="style-title-list">
                    Beperk het totale beschikbare aantal stuks (waarvan nu {{ usedStock }} ingenomen of gereserveerd)
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
    return props.isNew ? $t('c4c91c69-3b09-4db5-b83f-170475a509f7') : $t('0dbd634f-8012-4d75-97a2-594f6dffe752');
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


const usedStock = computed(() => patched.value.getUsedStock(props.group) || 0);

const useStock = computed({
    get: () => patched.value.stock !== null,
    set: (useStock) => addPatch({stock: useStock ? (patched.value.getUsedStock(props.group) || 10) : null})
})

const maximum = computed({
    get: () => patched.value.maximum,
    set: (maximum) => addPatch({maximum})
})

const useMaximum = computed({
    get: () => patched.value.maximum !== null,
    set: (useMaximum) => addPatch({maximum: useMaximum ? 10 : null})
})

const allowAmount = computed({
    get: () => patched.value.allowAmount,
    set: (allowAmount) => addPatch({allowAmount})
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
    if (!await CenteredMessage.confirm($t('6e82b7fc-581f-43cb-8b3a-cff97b9820ed'), $t('201437e3-f779-47b6-b4de-a0fa00f3863e'), $t('659cbbac-a470-4ab6-803d-b45ac580ea68'))) {
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
