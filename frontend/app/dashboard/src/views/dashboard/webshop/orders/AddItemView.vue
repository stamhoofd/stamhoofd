<template>
    <div class="st-view add-item-view">
        <STNavigationBar :title="$t(`Producten`)" />
        <main>
            <h1>
                {{ $t('41ffb09f-0986-42f4-9b7d-2b9df06324c7') }}
            </h1>

            <CategoryBox v-for="(category, index) in webshop.categories" :key="category.id" :category="category" :webshop="webshop" :checkout="checkout" :save-handler="saveHandler" :is-last="index === webshop.categories.length - 1" :admin="true" />
            <ProductGrid v-if="webshop.categories.length === 0" :products="webshop.products" :webshop="webshop" :checkout="checkout" :save-handler="saveHandler" :admin="true" />
        </main>
    </div>
</template>

<script lang="ts" setup>
import { CategoryBox, ProductGrid, STNavigationBar } from '@stamhoofd/components';
import { CartItem, Checkout, Webshop } from '@stamhoofd/structures';

defineProps<{
    webshop: Webshop;
    checkout: Checkout;
    saveHandler: (newItem: CartItem, oldItem: CartItem | null, component: any) => void;
}>();
</script>
