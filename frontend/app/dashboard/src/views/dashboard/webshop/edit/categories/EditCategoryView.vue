<template>
    <SaveView :title="isNew ? $t(`Categorie toevoegen`) : name+' ' + $t(`8455850d-829f-412f-bf1f-eedb2caa9f57`)" :disabled="!hasChanges" @save="save">
        <h1 v-if="isNew">
            {{ $t('2e3852ef-423e-4fcc-82bb-c886a6c61050') }}
        </h1>
        <h1 v-else>
            {{ name || 'Categorie' }} {{ $t('ee3bc635-c294-4134-9155-7a74f47dec4f') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />
        <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`)">
            <input ref="firstInput" v-model="name" class="input" type="text" autocomplete="off" enterkeyhint="next" :placeholder="$t(`bf6e5f68-2419-4001-b0bf-69b7c4685c26`)">
        </STInputBox>

        <STInputBox error-fields="description" :error-box="errors.errorBox" class="max" :title="$t(`7390051c-e965-4c4d-b7a7-abc9bb7e78bf`)">
            <textarea v-model="description" class="input" type="text" autocomplete="off" :placeholder="$t(`b9c2fafd-1b18-411f-981f-be3308b21fca`)" />
        </STInputBox>

        <hr><h2 v-if="isTickets">
            {{ $t('b40d200c-4265-4d58-a7f4-7c2498b062b9') }}
        </h2>
        <h2 v-else>
            {{ $t('22b99054-a114-4393-8127-5ec9fbc2010f') }}
        </h2>
        <STList v-model="draggableProducts" :draggable="true">
            <template #item="{item: product}">
                <ProductRow :product="product" :category="patchedCategory" :webshop="patched" @patch="addPatch($event)" @move-up="moveProductUp(product)" @move-down="moveProductDown(product)" />
            </template>
        </STList>

        <p>
            <button class="button text" type="button" @click="addProduct">
                <span class="icon add" />
                <span v-if="isTickets">{{ $t('ede8c6c4-9062-46a5-b873-1671c39f2edf') }}</span>
                <span v-else>{{ $t('dfdcd5e4-c2a2-4667-b77b-435eef982693') }}</span>
            </button>
        </p>

        <div v-if="!isNew" class="container">
            <hr><h2>
                {{ $t('e3ea7df6-8ebd-4bf9-a25e-6be3bfc29e57') }}
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>{{ $t('63af93aa-df6a-4937-bce8-9e799ff5aebd') }}</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType, PatchableArray } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, SaveView, STErrorsDefault, STInputBox, STList, useDraggableArrayIds, useErrors, usePatch } from '@stamhoofd/components';
import { Category, PrivateWebshop, Product, ProductType, WebshopTicketType } from '@stamhoofd/structures';

import { computed } from 'vue';
import EditProductView from '../products/EditProductView.vue';
import ProductRow from '../products/ProductRow.vue';

const props = defineProps<{
    category: Category;
    isNew: boolean;
    webshop: PrivateWebshop;
    // If we can immediately save this product, then you can create a save handler and pass along the changes.
    saveHandler: ((patch: AutoEncoderPatchType<PrivateWebshop>) => void);
}>();

const errors = useErrors();
const present = usePresent();
const pop = usePop();
const { patch, patched, addPatch: addWebshopPatch, hasChanges } = usePatch(props.webshop);

const isTickets = computed(() => props.webshop.meta.ticketType === WebshopTicketType.Tickets);
const patchedCategory = computed(() => {
    const c = patched.value.categories.find(c => c.id === props.category.id);
    if (c) {
        return c;
    }
    return props.category;
});

const products = computed(() => {
    return patchedCategory.value.productIds.flatMap((id) => {
        const product = patched.value.products.find(p => p.id === id);
        if (product) {
            return [product];
        }
        return [];
    });
});

const name = computed({
    get: () => patchedCategory.value.name,
    set: (name: string) => {
        addCategoryPatch(Category.patch({ name }));
    },
});

const description = computed({
    get: () => patchedCategory.value.description,
    set: (description: string) => {
        addCategoryPatch(Category.patch({ description }));
    },
});

function addProduct() {
    const product = Product.create({
        type: props.webshop.meta.ticketType === WebshopTicketType.Tickets ? ProductType.Ticket : ProductType.Product,
    });
    const p = PrivateWebshop.patch({});
    p.products.addPut(product);

    const cp = Category.patch({ id: props.category.id });
    cp.productIds.addPut(product.id);
    p.categories.addPatch(cp);

    present(new ComponentWithProperties(EditProductView, { product, webshop: patched.value.patch(p), isNew: true, saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => {
        // Merge both patches
        addPatch(p.patch(patch));

        // TODO: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
    } }).setDisplayStyle('popup')).catch(console.error);
}

function addCategoryPatch(patch: AutoEncoderPatchType<Category>) {
    const p = PrivateWebshop.patch({});
    p.categories.addPatch(Category.patch(Object.assign({}, patch, { id: props.category.id })));
    addPatch(p);
}

function addPatch(patch: AutoEncoderPatchType<PrivateWebshop>) {
    addWebshopPatch(patch);

    // Delete all products that do not exist any longer
    const deleteIds = patchedCategory.value.productIds.flatMap((id) => {
        const product = patched.value.products.find(p => p.id === id);
        if (product) {
            // exists
            return [];
        }
        return [id];
    });

    if (deleteIds.length > 0) {
        // clean up
        const cp = Category.patch({ id: props.category.id });
        for (const id of deleteIds) {
            cp.productIds.addDelete(id);
            console.log('Automatically deleted product from this category: ' + id);
        }
        addCategoryPatch(cp);
    }
}

function save() {
    props.saveHandler(patch.value);
    pop({ force: true })?.catch(console.error);
}

async function deleteMe() {
    if (!await CenteredMessage.confirm('Ben je zeker dat je deze categorie wilt verwijderen?', 'Verwijderen')) {
        return;
    }
    const p = PrivateWebshop.patch({});
    p.categories.addDelete(props.category.id);

    for (const id of props.category.productIds) {
        p.products.addDelete(id);
    }
    props.saveHandler(p);
    pop({ force: true })?.catch(console.error);
}

function moveProductUp(product: Product) {
    const index = patchedCategory.value.productIds.findIndex(c => product.id === c);
    if (index === -1 || index === 0) {
        return;
    }

    const moveTo = index - 2;
    const p = Category.patch({});
    p.productIds.addMove(product.id, patchedCategory.value.productIds[moveTo] ?? null);
    addCategoryPatch(p);
}

function moveProductDown(product: Product) {
    const index = patchedCategory.value.productIds.findIndex(c => product.id === c);
    if (index === -1 || index >= patchedCategory.value.productIds.length - 1) {
        return;
    }

    const moveTo = index + 1;
    const p = Category.patch({});
    p.productIds.addMove(product.id, patchedCategory.value.productIds[moveTo]);
    addCategoryPatch(p);
}

const patchProductsArray = (productIds: PatchableArray<string, string, string>) => {
    addCategoryPatch(Category.patch({
        productIds,
    }));
};

const draggableProducts = useDraggableArrayIds(() => products.value, patchProductsArray);

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
