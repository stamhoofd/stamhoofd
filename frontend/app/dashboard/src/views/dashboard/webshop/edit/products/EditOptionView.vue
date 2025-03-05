<template>
    <SaveView :title="isNew ? $t(`Keuze toevoegen`) : name+' ' + $t(`bewerken`)" :disabled="!hasChanges && !isNew" @save="save">
        <h1 v-if="isNew">
            {{ $t('911356c4-bd23-416d-9156-fbef6630b861') }}
        </h1>
        <h1 v-else>
            {{ name }} {{ $t('67c5998c-da2a-4c23-b089-86cc90f011e0') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox"/>
        <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`d32893b7-c9b0-4ea3-a311-90d29f2c0cf3`)">
            <input ref="firstInput" v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`a9d8f27c-b4d3-415a-94a4-2ec3c018ee48`)"></STInputBox>

        <STInputBox error-fields="price" :error-box="errors.errorBox" :title="$t(`aeb33249-07e1-420d-908b-17cb4ddb7e05`)">
            <PriceInput v-model="price" :min="null" :placeholder="$t(`adf86174-0aaa-4486-8428-bed8cce8851d`)"/>
        </STInputBox>

        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="useStock"/>
                </template>

                <h3 class="style-title-list">
                    {{ $t('083ceff7-ae68-4bd8-871a-6e4002991513') }} {{ usedStock }} {{ $t('e284d77b-c88c-4c0f-8464-58c4fe12eda8') }}
                </h3>

                <p v-if="useStock" class="style-description-small">
                    {{ $t('7ce15ac4-bde4-4893-8db7-e0d0ab030c79') }}
                </p>

                <div v-if="useStock" class="split-inputs option" @click.stop.prevent>
                    <STInputBox title="" error-fields="stock" :error-box="errors.errorBox">
                        <NumberInput v-model="stock"/>
                    </STInputBox>
                </div>
            </STListItem>
        </STList>

        <div v-if="!isNew && !isSingle" class="container">
            <hr><h2>
                {{ $t('d1933a7b-d63f-49d0-8e3d-1784236aee0e') }}
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash"/>
                <span>{{ $t('33cdae8a-e6f1-4371-9d79-955a16c949cb') }}</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, Checkbox, NumberInput, PriceInput, SaveView, STErrorsDefault, STInputBox, STList, STListItem, useErrors, usePatch } from '@stamhoofd/components';
import { Option, OptionMenu } from '@stamhoofd/structures';
import { computed } from 'vue';

const errors = useErrors();
const props = defineProps<{
    optionMenu: OptionMenu;
    isNew: boolean;
    option: Option;
    // If we can immediately save this product, then you can create a save handler and pass along the changes.
    saveHandler: ((patch: AutoEncoderPatchType<OptionMenu>) => void);
}>();

const pop = usePop();

const { patched, patch, hasChanges, addPatch } = usePatch(props.optionMenu);

const patchedOption = computed(() => {
    const c = patched.value.options.find(c => c.id === props.option.id);
    if (c) {
        return c;
    }
    return props.option;
});

const name = computed({
    get: () => patchedOption.value.name,
    set: (name: string) => {
        addOptionPatch(Option.patch({ name }));
    },
});

const price = computed({
    get: () => patchedOption.value.price,
    set: (price: number) => {
        addOptionPatch(Option.patch({ price }));
    },
});

const useStock = computed({
    get: () => patchedOption.value.stock !== null,
    set: (useStock: boolean) => {
        addOptionPatch(Option.patch({ stock: useStock ? (patchedOption.value.stock ?? patchedOption.value.stock ?? (patchedOption.value.usedStock || 10)) : null }));
    },
});

const stock = computed({
    get: () => patchedOption.value.stock,
    set: (stock: number | null) => {
        addOptionPatch(Option.patch({ stock }));
    },
});

const usedStock = computed(() => patchedOption.value.usedStock);

function addOptionPatch(patch: AutoEncoderPatchType<Option>) {
    const p = OptionMenu.patch({ id: props.optionMenu.id });
    p.options.addPatch(Option.patch(Object.assign({}, patch, { id: props.option.id })));
    addPatch(p);
}

async function save() {
    if (!await errors.validator.validate()) {
        return;
    }
    props.saveHandler(patch.value);
    pop({ force: true })?.catch(console.error);
}

const isSingle = computed(() => patched.value.options.length <= 1);

async function deleteMe() {
    if (!await CenteredMessage.confirm('Ben je zeker dat je deze keuze wilt verwijderen?', 'Verwijderen')) {
        return;
    }
    const p = OptionMenu.patch({});
    p.options.addDelete(props.option.id);
    props.saveHandler(p);
    pop({ force: true })?.catch(console.error);
}

async function shouldNavigateAway() {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm('Ben je zeker dat je wilt sluiten zonder op te slaan?', 'Niet opslaan');
}

defineExpose({
    shouldNavigateAway,
});
</script>
