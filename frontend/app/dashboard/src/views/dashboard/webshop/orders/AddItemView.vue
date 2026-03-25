<template>
    <div class="st-view add-item-view">
        <STNavigationBar :title="$t(`%u9`)" />
        <main>
            <h1>
                {{ $t('%u9') }}
            </h1>

            <CategoryBox v-for="(category, index) in webshop.categories" :key="category.id" :category="category" :webshop="webshop" :checkout="checkout" :save-handler="saveHandler" :is-last="index === webshop.categories.length - 1" :admin="true" />
            <ProductGrid v-if="webshop.categories.length === 0" :products="webshop.products" :webshop="webshop" :checkout="checkout" :save-handler="saveHandler" :admin="true" />
        </main>
    </div>
</template>

<script lang="ts" setup>
import CategoryBox from '@stamhoofd/components/views/CategoryBox.vue';
import ProductGrid from '@stamhoofd/components/views/ProductGrid.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import type { CartItem, Checkout, Webshop } from '@stamhoofd/structures';

defineProps<{
    webshop: Webshop;
    checkout: Checkout;
    saveHandler: (newItem: CartItem, oldItem: CartItem | null, component: any) => void;
}>();
</script>
