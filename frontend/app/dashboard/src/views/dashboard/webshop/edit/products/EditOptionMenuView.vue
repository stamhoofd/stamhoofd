<template>
    <SaveView :title="isNew ? $t(`cb1db7b7-2470-448c-8ebd-ce5702439538`) : $t(`feef080d-4172-4ab0-a69f-d3769f32cfa8`)" :disabled="!hasChanges && !isNew" @save="save">
        <h1 v-if="isNew">
            {{ $t('f334796c-dc6b-45f0-825e-c8f2eeae931b') }}
        </h1>
        <h1 v-else>
            {{ $t('23592db3-6fa9-48b0-9660-78eff742219d') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />
        <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`)">
            <input ref="firstInput" v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`7d80640e-7ecc-40b0-86df-4f375d9fd300`)">
        </STInputBox>

        <Checkbox v-model="multipleChoice">
            {{ $t('d95331fe-56b0-4423-b485-5f600b6ab49c') }}
        </Checkbox>
        <p class="style-description">
            {{ $t("ad0d3d8a-67b1-4eb1-bce3-159acfecbaa0") }}
        </p>

        <hr><h2 class="style-with-button">
            <div>{{ $t('6c90965a-8334-43e6-8494-031e2932bc45') }}</div>
            <div>
                <button class="button text only-icon-smartphone" type="button" @click="addOption">
                    <span class="icon add" />
                    <span>{{ $t('6c80efa8-5658-4728-ba95-d0536fdd25bd') }}</span>
                </button>
            </div>
        </h2>

        <OptionMenuOptions :option-menu="patchedOptionMenu" @patch="addOptionMenuPatch" />

        <div v-if="!isNew" class="container">
            <hr><h2>
                {{ $t('c73c2d8c-9f00-457b-a6e5-24c45c383228') }}
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>{{ $t('63af93aa-df6a-4937-bce8-9e799ff5aebd') }}</span>
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
