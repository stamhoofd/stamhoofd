<template>
    <PreviewPanel v-model:wide="previewWide">
        <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" @save="save">
            <!-- The preview only fits next to the settings on large screens -->
            <template v-if="showPreview && !previewWide" #navigation-buttons>
                <button v-tooltip="$t('%jH')" class="button icon eye" type="button" data-testid="webshop-preview-button" @click="openPreview()" />
            </template>
            <h1 class="larger">
                {{ viewTitle }}
            </h1>
            <p v-if="!modernWebshopEnabled">
                {{ description }}
            </p>
            <STErrorsDefault :error-box="errors.errorBox" />

            <template v-if="modernWebshopEnabled">
                <h2>{{ $t('%Zzd') }}</h2>
                <p>
                    {{ $t('%Zz3') }}
                </p>

                <OrderModeInput v-model="orderMode" :meta="webshop.meta" :show-single="showSingleOrderMode" />

                <hr>
                <template v-if="formProduct">
                    <EditProductBox :key="formProduct.id" :product="formProduct" :webshop="webshop" :is-new="false" :form-mode="true" :error-box="errors.errorBox" :validator="errors.validator" @patch:product="addProductPatch" @patch:webshop="addPatch" />

                    <hr>
                    <p>
                        <button class="button text" type="button" data-testid="add-product-button" @click="addProduct">
                            <span class="icon add" />
                            <span>{{ isTickets ? $t('%Rf') : $t('%ZzO') }}</span>
                        </button>
                    </p>
                </template>
                <template v-else>
                    <h2>{{ isTickets ? $t('%1AU') : $t('%Rv') }}</h2>
                    <p>{{ description }}</p>
                </template>
            </template>

            <template v-if="!formProduct && webshop.categories.length > 0">
                <STList v-model="draggableCategories" :draggable="true">
                    <template #item="{item: category}">
                        <CategoryRow :category="category" :webshop="webshop" @patch="addPatch($event)" @move-up="moveCategoryUp(category)" @move-down="moveCategoryDown(category)" />
                    </template>
                </STList>
            </template>

            <template v-else-if="!formProduct && webshop.products.length > 0">
                <STList v-model="draggableProducts" :draggable="true">
                    <template #item="{item: product}">
                        <ProductRow :product="product" :webshop="webshop" @patch="addPatch($event)" @move-up="moveProductUp(product)" @move-down="moveProductDown(product)" />
                    </template>
                </STList>
            </template>

            <p v-if="!formProduct && webshop.categories.length === 0">
                <button class="button text" type="button" data-testid="add-product-button" @click="addProduct">
                    <span class="icon add" />
                    <span v-if="isTickets">{{ $t('%Rf') }}</span>
                    <span v-else>{{ $t('%Rg') }}</span>
                </button>
            </p>

            <p v-if="!formProduct">
                <button class="button text" type="button" @click="addCategory">
                    <span class="icon add" />
                    <span v-if="webshop.categories.length === 0 && webshop.products.length > 0">{{ $t('%LO') }}</span>
                    <span v-else>{{ $t('%Rh') }}</span>
                </button>
            </p>

            <template v-if="!modernWebshopEnabled">
                <hr>
                <h2>{{ $t('%1DQ') }}</h2>
                <p>
                    {{ $t('%Ri') }}
                </p>

                <STList>
                    <STListItem :selectable="true" element-name="label" class="left-center">
                        <template #left>
                            <Checkbox v-model="cartEnabled" />
                        </template>
                        <h3 class="style-title-list">
                            {{ $t('%Rj') }}
                        </h3>
                    </STListItem>
                </STList>
            </template>
        </SaveView>

        <template v-if="showPreview" #preview>
            <WebshopPreviewCard :webshop="webshop" />
        </template>
    </PreviewPanel>
</template>

<script lang="ts" setup>
import type { AutoEncoderPatchType } from '@common/encoding';
import { usePresent } from '@browser/navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import { useFeatureFlagComputed } from '@stamhoofd/components/hooks/useFeatureFlag.ts';
import PreviewPanel from '@stamhoofd/components/layout/PreviewPanel.vue';
import { Category, PrivateWebshop, Product, ProductType, WebshopMetaData, WebshopOrderMode, WebshopTicketType } from '@stamhoofd/structures';
import CategoryRow from './categories/CategoryRow.vue';
import OrderModeInput from './OrderModeInput.vue';
import { usesSeatingPlan } from './orderModeOptions';
import EditProductBox from './products/EditProductBox.vue';
import ProductRow from './products/ProductRow.vue';
import { getSingleFormProduct } from './singleForm';
import type { UseEditWebshopProps } from './useEditWebshop';
import { useEditWebshop } from './useEditWebshop';
import { useWebshopPreview } from './useWebshopPreview';
import WebshopPreviewCard from './WebshopPreviewCard.vue';
import { computed, ref } from 'vue';

const props = defineProps<UseEditWebshopProps>();

const present = usePresent();

const { webshop, originalWebshop, addPatch, errors, saving, save, hasChanges, shouldNavigateAway } = useEditWebshop({
    getProps: () => props,
});

const description = computed(() => {
    return webshop.value.meta.ticketType === WebshopTicketType.Tickets ? $t('%Zyi') : $t('%1Oq');
});

const viewTitle = computed(() => {
    if (isTickets.value) {
        if (webshop.value.categories.length > 0) {
            return $t('%ZpA');
        }
        return $t('%Ph');
    }
    if (webshop.value.categories.length > 0) {
        return $t('%Zpm');
    }
    return $t('%Pf');
});

const isTickets = computed(() => webshop.value.meta.ticketType === WebshopTicketType.Tickets);

const modernWebshopEnabled = useFeatureFlagComputed('modern-webshop');

const { showPreview, openPreview } = useWebshopPreview(webshop);
const previewWide = ref(false);

function setOrderMode(orderMode: WebshopOrderMode) {
    addPatch(PrivateWebshop.patch({ meta: WebshopMetaData.patch({ orderMode }) }));
}

const cartEnabled = computed({
    get: () => webshop.value.shouldEnableCart,
    set: (cartEnabled: boolean) => setOrderMode(cartEnabled ? WebshopOrderMode.Cart : WebshopOrderMode.Single),
});

const orderMode = computed({
    get: () => webshop.value.meta.orderMode,
    set: (orderMode: WebshopOrderMode) => {
        if (orderMode === WebshopOrderMode.Single && webshop.value.products.length === 0) {
            // One at a time starts with a single form
            const patch = PrivateWebshop.patch({ meta: WebshopMetaData.patch({ orderMode }) });
            const product = createProduct();
            product.name = webshop.value.meta.name;
            patch.products.addPut(product);
            addPatch(patch);
            return;
        }
        setOrderMode(orderMode);
    },
});

// Not with a seating plan, unless the webshop already orders one at a time
const showSingleOrderMode = computed(() => !usesSeatingPlan(webshop.value) || originalWebshop.meta.orderMode === WebshopOrderMode.Single || webshop.value.meta.orderMode === WebshopOrderMode.Single);

const formProduct = computed(() => modernWebshopEnabled.value ? getSingleFormProduct(webshop.value) : null);

function addProductPatch(patch: AutoEncoderPatchType<Product>) {
    const p = PrivateWebshop.patch({});
    p.products.addPatch(patch);
    addPatch(p);
}

function createProduct() {
    return Product.create({
        type: webshop.value.meta.ticketType === WebshopTicketType.Tickets ? ProductType.Ticket : ProductType.Product,
        showStockBelow: null,
    });
}

function addProduct() {
    const product = createProduct();
    const p = PrivateWebshop.patch({});
    p.products.addPut(product);

    present(AsyncComponent(() => import('./products/EditProductView.vue'), {
        product,
        webshop: webshop.value.patch(p),
        isNew: true,
        saveHandler: (patch: AutoEncoderPatchType<PrivateWebshop>) => {
            // Merge both patches
            addPatch(p.patch(patch));

            // TODO: if webshop is saveable: also save it. But maybe that should not happen here but in a special type of emit?
        },
    }).setDisplayStyle('popup'))
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

    present(AsyncComponent(() => import('./categories/EditCategoryView.vue'), {
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
