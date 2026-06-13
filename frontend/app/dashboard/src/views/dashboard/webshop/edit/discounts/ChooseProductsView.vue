<template>
    <div class="st-view">
        <STNavigationBar :title="title" />

        <main>
            <h1>
                {{ title }}
            </h1>

            <div v-for="category of categories" :key="category.id" class="container">
                <hr v-if="categories.length > 1">
                <h2 v-if="categories.length > 1">
                    {{ category.name }}
                </h2>
                <STList>
                    <STListItem v-for="product in getCategoryProducts(category)" :key="product.id" :selectable="true" element-name="label" @click="selectProduct(product)">
                        <h3 class="style-title-list">
                            {{ product.name }}
                        </h3>
                        <p v-if="(product.type == 'Ticket' || product.type == 'Voucher') && product.location" class="style-description-small" v-text="product.location.name" />
                        <p v-if="(product.type == 'Ticket' || product.type == 'Voucher') && product.dateRange" class="style-description-small" v-text="doFormatDateRange(product.dateRange)" />

                        <template #right>
                            <span v-if="isProductSelected(product)" class="icon success primary" />
                        </template>
                    </STListItem>
                </STList>
            </div>
        </main>
    </div>
</template>

<script lang="ts" setup>
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import type { PrivateWebshop, Product, ProductDateRange } from '@stamhoofd/structures';
import { Category } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';

const props = withDefaults(defineProps<{
    webshop: PrivateWebshop;
    selectedProductIds?: string[];
    saveHandler: (selectedIds: string[]) => void;
}>(), {
    selectedProductIds: () => [],
});

const title = 'Selecteer één of meerdere artikels';
const editableSelectedProductIds = ref([...props.selectedProductIds]);

function getCategoryProducts(category: Category) {
    return category.productIds.flatMap((id) => {
        const product = props.webshop.products.find(p => p.id === id);
        return product ? [product] : [];
    });
}

const categories = computed(() => {
    const categories = props.webshop.categories.filter(c => getCategoryProducts(c).length > 0) ?? [];
    if (categories.length <= 0) {
        return [
            Category.create({
                name: '',
                productIds: props.webshop.products.map(p => p.id),
            }),
        ];
    }
    return categories;
});

const doFormatDateRange = (dateRange: ProductDateRange) => Formatter.capitalizeFirstLetter(dateRange.toString());

function isProductSelected(product: Product) {
    return editableSelectedProductIds.value.includes(product.id);
}

function selectProduct(product: Product) {
    editableSelectedProductIds.value = editableSelectedProductIds.value.filter(id => props.webshop.products.some(p => p.id === id));

    if (editableSelectedProductIds.value.includes(product.id)) {
        if (editableSelectedProductIds.value.length <= 1) {
            return;
        }
        editableSelectedProductIds.value = editableSelectedProductIds.value.filter(id => id !== product.id);
    } else {
        editableSelectedProductIds.value.push(product.id);
    }
    props.saveHandler(editableSelectedProductIds.value);
}
</script>
