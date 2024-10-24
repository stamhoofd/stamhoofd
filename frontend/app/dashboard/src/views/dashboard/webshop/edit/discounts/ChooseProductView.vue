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
                        <p v-if="(product.type === 'Ticket' || product.type === 'Voucher') && product.location" class="style-description-small" v-text="product.location.name" />
                        <p v-if="(product.type === 'Ticket' || product.type === 'Voucher') && product.dateRange" class="style-description-small" v-text="formatDateRange(product.dateRange)" />

                        <template v-if="product.id === selectedProductId" #right>
                            <span class="icon success primary" />
                        </template>
                    </STListItem>
                </STList>
            </div>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { usePop } from '@simonbackx/vue-app-navigation';
import { STList, STListItem, STNavigationBar } from '@stamhoofd/components';
import { Category, PrivateWebshop, Product, ProductDateRange } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';

const props = withDefaults(defineProps<{
    webshop: PrivateWebshop;
    selectedProductId: string | null;
    saveHandler: (selected: Product) => void;
}>(), {
    selectedProductId: null,
});

const pop = usePop();
const title = 'Selecteer een artikel';

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

function getCategoryProducts(category: Category) {
    return category.productIds.flatMap((p) => {
        const product = props.webshop.products.find(pp => pp.id === p);
        if (product) {
            return [product];
        }
        return [];
    });
}

function formatDateRange(dateRange: ProductDateRange) {
    return Formatter.capitalizeFirstLetter(dateRange.toString());
}

function selectProduct(product: Product) {
    props.saveHandler(product);
    pop({ force: true })?.catch(console.error);
}
</script>
