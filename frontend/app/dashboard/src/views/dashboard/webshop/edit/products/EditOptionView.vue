<template>
    <SaveView :title="isNew ? $t(`Keuze toevoegen`) : name+' ' + $t(`bewerken`)" :disabled="!hasChanges && !isNew" @save="save">
        <h1 v-if="isNew">
            {{ $t('Keuze toevoegen') }}
        </h1>
        <h1 v-else>
            {{ name }} {{ $t('bewerken') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />
        <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`Naam`)">
            <input ref="firstInput" v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`Naam van deze keuze`)">
        </STInputBox>

        <STInputBox error-fields="price" :error-box="errors.errorBox" :title="$t(`Meer of minkost`)">
            <PriceInput v-model="price" :min="null" :placeholder="$t(`+ 0 euro`)" />
        </STInputBox>

        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="useStock" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('Beperk het beschikbare aantal stuks (waarvan nu {stock} verkocht of gereserveerd)', {stock: usedStock.toString()}) }}
                </h3>

                <p v-if="useStock" class="style-description-small">
                    {{ $t('Geannuleerde en verwijderde bestellingen worden niet meegerekend.') }}
                </p>

                <div v-if="useStock" class="split-inputs option" @click.stop.prevent>
                    <STInputBox title="" error-fields="stock" :error-box="errors.errorBox">
                        <NumberInput v-model="stock" />
                    </STInputBox>
                </div>
            </STListItem>
        </STList>

        <div v-if="!isNew && !isSingle" class="container">
            <hr><h2>
                {{ $t('Verwijder deze keuze') }}
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>{{ $t('Verwijderen') }}</span>
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
