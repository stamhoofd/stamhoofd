<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1 class="style-navigation-title">
            {{ viewTitle }}
        </h1>
        <STErrorsDefault :error-box="errors.errorBox" />

        <template v-if="webshop.categories.length > 0">
            <STList v-model="draggableCategories" :draggable="true">
                <template #item="{item: category}">
                    <CategoryRow :category="category" :webshop="webshop" @patch="addPatch($event)" @move-up="moveCategoryUp(category)" @move-down="moveCategoryDown(category)" />
                </template>
            </STList>
        </template>

        <template v-else-if="webshop.products.length > 0">
            <STList v-model="draggableProducts" :draggable="true">
                <template #item="{item: product}">
                    <ProductRow :product="product" :webshop="webshop" @patch="addPatch($event)" @move-up="moveProductUp(product)" @move-down="moveProductDown(product)" />
                </template>
            </STList>
        </template>

        <p v-if="webshop.categories.length === 0">
            <button class="button text" type="button" @click="addProduct">
                <span class="icon add" />
                <span v-if="isTickets">{{ $t('ede8c6c4-9062-46a5-b873-1671c39f2edf') }}</span>
                <span v-else>{{ $t('dfdcd5e4-c2a2-4667-b77b-435eef982693') }}</span>
            </button>
        </p>

        <p>
            <button class="button text" type="button" @click="addCategory">
                <span class="icon add" />
                <span v-if="webshop.categories.length === 0 && webshop.products.length > 0">{{ $t('14dcbad9-e83b-4ff9-8f39-2a059d4caaf5') }}</span>
                <span v-else>{{ $t('2e3852ef-423e-4fcc-82bb-c886a6c61050') }}</span>
            </button>
        </p>

        <template v-if="webshop.canEnableCart">
            <hr><h2>{{ $t('5e2654f2-6423-47bc-b7e7-054e41bf287f') }}</h2>
            <p>
                {{ $t('d0990170-4ad6-48d7-a3d6-d4ac7d9f803c') }}
            </p>

            <STList>
                <STListItem :selectable="true" element-name="label" class="left-center">
                    <template #left>
                        <Checkbox v-model="cartEnabled" />
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('a5a76740-30d3-4b35-961c-558756998db3') }}
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

const { webshop, addPatch, errors, saving, save, hasChanges, shouldNavigateAway } = useEditWebshop({
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
        showStockBelow: null,
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

defineExpose({
    shouldNavigateAway,
});
</script>
