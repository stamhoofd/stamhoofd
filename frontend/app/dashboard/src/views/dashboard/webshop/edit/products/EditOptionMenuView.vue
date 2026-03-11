<template>
    <SaveView :title="isNew ? $t(`%u7`) : $t(`%TH`)" :disabled="!hasChanges && !isNew" @save="save">
        <h1 v-if="isNew">
            {{ $t('%u7') }}
        </h1>
        <h1 v-else>
            {{ $t('%TH') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />
        <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`%Gq`)">
            <input ref="firstInput" v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`%TM`)">
        </STInputBox>

        <STList>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="multipleChoice" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('%TI') }}
                </h3>
                <p class="style-description-small">
                    {{ $t("%TL") }}
                </p>
            </STListItem>

            <STListItem v-if="!multipleChoice" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="autoSelectFirst" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('%1AH') }}
                </h3>
                <p class="style-description-small">
                    {{ $t("%1AI") }}
                </p>
            </STListItem>
        </STList>

        <hr><h2 class="style-with-button">
            <div>{{ $t('%TJ') }}</div>
            <div>
                <button class="button text only-icon-smartphone" type="button" @click="addOption">
                    <span class="icon add" />
                    <span>{{ $t('%TE') }}</span>
                </button>
            </div>
        </h2>

        <OptionMenuOptions :option-menu="patchedOptionMenu" @patch="addOptionMenuPatch" />

        <div v-if="!isNew" class="container">
            <hr><h2>
                {{ $t('%TK') }}
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>{{ $t('%CJ') }}</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, Checkbox, SaveView, STErrorsDefault, STInputBox, useErrors, usePatch } from '@stamhoofd/components';
import { Option, OptionMenu, Product } from '@stamhoofd/structures';

import { computed } from 'vue';
import EditOptionView from './EditOptionView.vue';
import OptionMenuOptions from './OptionMenuOptions.vue';

const props = defineProps<{
    product: Product;
    isNew: boolean;
    optionMenu: OptionMenu;
    // If we can immediately save this product, then you can create a save handler and pass along the changes.
    saveHandler: (patch: AutoEncoderPatchType<Product>) => void;
}>();

const errors = useErrors();
const pop = usePop();
const present = usePresent();

const { patched, patch, addPatch, hasChanges } = usePatch(props.product);

const patchedOptionMenu = computed(() => {
    const c = patched.value.optionMenus.find(c => c.id === props.optionMenu.id);
    if (c) {
        return c;
    }
    return props.optionMenu;
});

const name = computed({
    get: () => patchedOptionMenu.value.name,
    set: (name: string) => {
        addOptionMenuPatch(OptionMenu.patch({ name }));
    },
});

const multipleChoice = computed({
    get: () => patchedOptionMenu.value.multipleChoice,
    set: (multipleChoice: boolean) => {
        addOptionMenuPatch(OptionMenu.patch({ multipleChoice }));
    },
});

const autoSelectFirst = computed({
    get: () => patchedOptionMenu.value.autoSelectFirst,
    set: (autoSelectFirst: boolean) => {
        addOptionMenuPatch(OptionMenu.patch({ autoSelectFirst }));
    },
});

function addOptionMenuPatch(patch: AutoEncoderPatchType<OptionMenu>) {
    const p = Product.patch({});
    p.optionMenus.addPatch(OptionMenu.patch(Object.assign({}, patch, { id: props.optionMenu.id })));
    addPatch(p);
}

function addOption() {
    const option = Option.create({});
    const p = OptionMenu.patch({ id: props.optionMenu.id });
    p.options.addPut(option);

    present(new ComponentWithProperties(EditOptionView, { optionMenu: patchedOptionMenu.value.patch(p), option, isNew: true, saveHandler: (patch: AutoEncoderPatchType<OptionMenu>) => {
        // Merge both patches
        addOptionMenuPatch(p.patch(patch));

        // TODO: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
    } }).setDisplayStyle('sheet')).catch(console.error);
}

function save() {
    props.saveHandler(patch.value);
    pop({ force: true })?.catch(console.error);
}

async function deleteMe() {
    if (!await CenteredMessage.confirm('Ben je zeker dat je dit keuzemenu wilt verwijderen?', 'Verwijderen')) {
        return;
    }

    const p = Product.patch({});
    p.optionMenus.addDelete(props.optionMenu.id);
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
