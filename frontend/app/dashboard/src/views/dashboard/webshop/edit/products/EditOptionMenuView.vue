<template>
    <SaveView :title="isNew ? 'Keuzemenu toevoegen' : 'Keuzemenu bewerken'" :disabled="!hasChanges && !isNew" @save="save">
        <h1 v-if="isNew">
            Keuzemenu toevoegen
        </h1>
        <h1 v-else>
            Keuzemenu bewerken
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />
        <STInputBox title="Naam" error-fields="name" :error-box="errors.errorBox">
            <input
                ref="firstInput"
                v-model="name"
                class="input"
                type="text"
                placeholder="bv. Kies je extra's"
                autocomplete="off"
            >
        </STInputBox>

        <Checkbox v-model="multipleChoice">
            Meerkeuze
        </Checkbox>
        <p class="style-description">
            Bij meerkeuze kunnen bestellers geen, één of meerdere keuzes aanduiden. In het andere geval moet er exact één keuze gemaakt worden (of je voegt nog een extra optie 'geen' toe).
        </p>

        <hr>
        <h2 class="style-with-button">
            <div>Keuzes</div>
            <div>
                <button class="button text only-icon-smartphone" type="button" @click="addOption">
                    <span class="icon add" />
                    <span>Keuze</span>
                </button>
            </div>
        </h2>

        <OptionMenuOptions :option-menu="patchedOptionMenu" @patch="addOptionMenuPatch" />

        <div v-if="!isNew" class="container">
            <hr>
            <h2>
                Verwijder dit keuzemenu
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>Verwijderen</span>
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
