<template>
    <div class="single-product-list">
        <div v-for="(group, groupIndex) of groups" :key="group.id" class="container">
            <hr v-if="groupIndex > 0">
            <h2 v-if="group.name" class="larger">
                {{ group.name }}
            </h2>
            <p v-if="group.description" class="style-description-small" v-text="group.description" />

            <div class="boxed">
                <STList>
                    <STListItem v-for="product of group.products" :key="product.id" data-testid="single-product-row" :selectable="canOrderProduct(product)" element-name="label" class="left-center">
                        <template #left>
                            <Radio v-model="model" :value="product.id" name="single-product" :disabled="!canOrderProduct(product)" />
                        </template>

                        <h3 class="style-title-list bolder">
                            {{ product.name }}
                            <button v-if="product.description || product.images.length > 0" class="button icon info-circle gray inline" type="button" data-testid="single-product-info" @click.stop.prevent="showProductInfo(product)" />
                        </h3>
                        <p v-if="getDescription(product)" class="style-description-small">
                            {{ getDescription(product) }}
                        </p>

                        <div v-if="getStockTag(product)" class="tags-without-background">
                            <p class="style-tag small" :class="getStockTag(product)!.style">
                                <span v-if="getStockTag(product)!.style === 'warn'" class="icon lightning text-size" />
                                <span>{{ getStockTag(product)!.text }}</span>
                            </p>
                        </div>
                    </STListItem>
                </STList>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import Radio from '@stamhoofd/components/inputs/Radio.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import { getProductPriceText } from '@stamhoofd/components/helpers/productPriceText.ts';
import { getProductStockTag } from '@stamhoofd/components/views/productStockTag.ts';
import type { Cart, Product, Webshop } from '@stamhoofd/structures';
import { computed } from 'vue';
import { canOrderProduct, getProductListDescription, getProductListGroups, useShowProductInfo } from './productList';

/**
 * One at a time with several products: the visitor picks one product, which then opens as the first checkout step
 */
const props = defineProps<{
    webshop: Webshop;
    cart: Cart;
    // Above products without a category (empty: no title)
    title?: string;
}>();

/** The id of the chosen product */
const model = defineModel<string | null>({ required: true });

const groups = computed(() => getProductListGroups(props.webshop, { title: props.title }));
const showProductInfo = useShowProductInfo();

// The price is chosen in the next step: show the range of prices of the product
function getDescription(product: Product) {
    return getProductListDescription(product, getProductPriceText(product, props.webshop, { admin: false }));
}

function getStockTag(product: Product) {
    return getProductStockTag({ product, webshop: props.webshop, cart: props.cart, admin: false, editExisting: true });
}
</script>

<style lang="scss">
@use "./product-list.mixin.scss" as *;

.single-product-list {
    @include product-list;
}
</style>
