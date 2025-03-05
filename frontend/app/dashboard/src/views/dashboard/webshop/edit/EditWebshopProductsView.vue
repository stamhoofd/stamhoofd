<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1 class="style-navigation-title">
            {{ viewTitle }}
        </h1>
        <STErrorsDefault :error-box="errors.errorBox"/>

        <template v-if="webshop.categories.length > 0">
            <STList v-model="draggableCategories" :draggable="true">
                <template #item="{item: category}">
                    <CategoryRow :category="category" :webshop="webshop" @patch="addPatch($event)" @move-up="moveCategoryUp(category)" @move-down="moveCategoryDown(category)"/>
                </template>
            </STList>
        </template>

        <template v-else-if="webshop.products.length > 0">
            <STList v-model="draggableProducts" :draggable="true">
                <template #item="{item: product}">
                    <ProductRow :product="product" :webshop="webshop" @patch="addPatch($event)" @move-up="moveProductUp(product)" @move-down="moveProductDown(product)"/>
                </template>
            </STList>
        </template>

        <p v-if="webshop.categories.length === 0">
            <button class="button text" type="button" @click="addProduct">
                <span class="icon add"/>
                <span v-if="isTickets">{{ $t('f0949a12-7b87-41cf-b2e1-e3bfacda8894') }}</span>
                <span v-else>{{ $t('3c2b0f17-52bd-4b6b-8a83-d88218682a72') }}</span>
            </button>
        </p>

        <p>
            <button class="button text" type="button" @click="addCategory">
                <span class="icon add"/>
                <span v-if="webshop.categories.length === 0 && webshop.products.length > 0">{{ $t('9a714cea-4e3f-49b2-8901-087c6a896fbd') }}</span>
                <span v-else>{{ $t('127967a5-502a-4e42-be8b-562cd96953d8') }}</span>
            </button>
        </p>

        <template v-if="webshop.canEnableCart">
            <hr><h2>{{ $t('608dd4a9-dbba-4c2b-818b-5e32296e7289') }}</h2>
            <p>
                {{ $t('d148d875-f5fb-4c89-a58d-f47f461c22f3') }}
            </p>

            <STList>
                <STListItem :selectable="true" element-name="label" class="left-center">
                    <template #left>
                        <Checkbox v-model="cartEnabled"/>
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('e8eb9939-94b1-4d1b-aec3-5897d04078e4') }}
                    </h3>
                </STListItem>
            </STList>
        </template>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { Category, PrivateWebshop, Product, ProductType, WebshopMetaData, WebshopTicketType } from '@stamhoofd/structures';
import CategoryRow from './categories/CategoryRow.vue';
import ProductRow from './products/ProductRow.vue';

import { computed } from 'vue';
import EditCategoryView from './categories/EditCategoryView.vue';
import EditProductView from './products/EditProductView.vue';
import { useEditWebshop, UseEditWebshopProps } from './useEditWebshop';

const props = defineProps<UseEditWebshopProps>();

const present = usePresent();

const { webshop, addPatch, errors, saving, save, hasChanges } = useEditWebshop({
    getProps: () => props,
});

const viewTitle = computed(() => {
    if (isTickets.value) {
        if (webshop.value.categories.length > 0) {
            return 'Ticket categorieën';
        }
        return 'Aanbod tickets en vouchers';
    }
    if (webshop.value.categories.length > 0) {
        return 'Product categorieën';
    }
    return 'Productaanbod';
});

const isTickets = computed(() => webshop.value.meta.ticketType === WebshopTicketType.Tickets);

const cartEnabled = computed({
    get: () => webshop.value.meta.cartEnabled,
    set: (cartEnabled: boolean) => {
        const patch = WebshopMetaData.patch({ cartEnabled });
        addPatch(PrivateWebshop.patch({ meta: patch }));
    },
});

function addProduct() {
    const product = Product.create({
        type: webshop.value.meta.ticketType === WebshopTicketType.Tickets ? ProductType.Ticket : ProductType.Product,
    });
    const p = PrivateWebshop.patch({});
    p.products.addPut(product);

    present(new ComponentWithProperties(EditProductView,
        {
            product,
            webshop: webshop.value.patch(p),
            isNew: true,
            saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => {
                // Merge both patches
                addPatch(p.patch(patch));

                // TODO: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
            },
        },
    ).setDisplayStyle('popup'))
        .catch(console.error);
}

function addCategory() {
    const category = Category.create({});

    if (webshop.value.categories.length === 0) {
        // Also inherit all products (only on save)
        category.productIds = webshop.value.products.map(p => p.id);
    }

    const p = PrivateWebshop.patch({});
    p.categories.addPut(category);

    present(new ComponentWithProperties(
        EditCategoryView,
        {
            category,
            webshop: webshop.value.patch(p),
            isNew: true,
            saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => {
                // Merge both patches
                addPatch(p.patch(patch));
            },
        }).setDisplayStyle('popup')).catch(console.error);
}

function moveCategoryUp(category: Category) {
    const index = webshop.value.categories.findIndex(c => category.id === c.id);
    if (index === -1 || index === 0) {
        return;
    }

    const moveTo = index - 2;
    const p = PrivateWebshop.patch({});
    p.categories.addMove(category.id, webshop.value.categories[moveTo]?.id ?? null);
    addPatch(p);
}

function moveCategoryDown(category: Category) {
    const index = webshop.value.categories.findIndex(c => category.id === c.id);
    if (index === -1 || index >= webshop.value.categories.length - 1) {
        return;
    }

    const moveTo = index + 1;
    const p = PrivateWebshop.patch({});
    p.categories.addMove(category.id, webshop.value.categories[moveTo].id);
    addPatch(p);
}

function moveProductUp(product: Product) {
    const index = webshop.value.products.findIndex(c => product.id === c.id);
    if (index === -1 || index === 0) {
        return;
    }

    const moveTo = index - 2;
    const p = PrivateWebshop.patch({});
    p.products.addMove(product.id, webshop.value.products[moveTo]?.id ?? null);
    addPatch(p);
}

function moveProductDown(product: Product) {
    const index = webshop.value.products.findIndex(c => product.id === c.id);
    if (index === -1 || index >= webshop.value.products.length - 1) {
        return;
    }

    const moveTo = index + 1;
    const p = PrivateWebshop.patch({});
    p.products.addMove(product.id, webshop.value.products[moveTo].id);
    addPatch(p);
}

const draggableProducts = computed({
    get: () => webshop.value.products,
    set: (products) => {
        if (products.length !== webshop.value.products.length) {
            return;
        }

        const patch = PrivateWebshop.patch({});
        for (const p of products.slice().reverse()) {
            patch.products.addMove(p.id, null);
        }
        addPatch(patch);
    },
});

const draggableCategories = computed({
    get: () => webshop.value.categories,
    set: (categories) => {
        if (categories.length !== webshop.value.categories.length) {
            return;
        }

        const patch = PrivateWebshop.patch({});
        for (const c of categories.slice().reverse()) {
            patch.categories.addMove(c.id, null);
        }
        addPatch(patch);
    },
});
</script>
