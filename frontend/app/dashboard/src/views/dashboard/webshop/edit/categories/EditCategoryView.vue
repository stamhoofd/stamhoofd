<template>
    <SaveView :title="isNew ? $t(`Categorie toevoegen`) : name+' ' + $t(`bewerken`)" :disabled="!hasChanges" @save="save">
        <h1 v-if="isNew">
            {{ $t('127967a5-502a-4e42-be8b-562cd96953d8') }}
        </h1>
        <h1 v-else>
            {{ name || 'Categorie' }} {{ $t('67c5998c-da2a-4c23-b089-86cc90f011e0') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox"/>
        <STInputBox error-fields="name" :error-box="errors.errorBox" :title="$t(`d32893b7-c9b0-4ea3-a311-90d29f2c0cf3`)">
            <input ref="firstInput" v-model="name" class="input" type="text" autocomplete="off" enterkeyhint="next" :placeholder="$t(`810b66b7-f60a-4585-8cfb-ea911546a1b2`)"></STInputBox>

        <STInputBox error-fields="description" :error-box="errors.errorBox" class="max" :title="$t(`a8f50d56-fbb4-4117-bbb2-6fe5737a797c`)">
            <textarea v-model="description" class="input" type="text" autocomplete="off" :placeholder="$t(`c415a97f-fc4b-41f7-9d6e-c27917d986cf`)"/>
        </STInputBox>

        <hr><h2 v-if="isTickets">
            {{ $t('f3005a87-5877-435d-bc0e-5b4883e7ca11') }}
        </h2>
        <h2 v-else>
            {{ $t('28dd11fe-b753-4579-bc3e-4ba626fef6b4') }}
        </h2>
        <STList v-model="draggableProducts" :draggable="true">
            <template #item="{item: product}">
                <ProductRow :product="product" :category="patchedCategory" :webshop="patched" @patch="addPatch($event)" @move-up="moveProductUp(product)" @move-down="moveProductDown(product)"/>
            </template>
        </STList>

        <p>
            <button class="button text" type="button" @click="addProduct">
                <span class="icon add"/>
                <span v-if="isTickets">{{ $t('f0949a12-7b87-41cf-b2e1-e3bfacda8894') }}</span>
                <span v-else>{{ $t('3c2b0f17-52bd-4b6b-8a83-d88218682a72') }}</span>
            </button>
        </p>

        <div v-if="!isNew" class="container">
            <hr><h2>
                {{ $t('143eea60-461e-44d9-8536-dd90e3e99413') }}
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash"/>
                <span>{{ $t('33cdae8a-e6f1-4371-9d79-955a16c949cb') }}</span>
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
