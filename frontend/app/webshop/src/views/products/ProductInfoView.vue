<template>
    <div class="st-view product-info-view">
        <STNavigationBar :title="product.name" />
        <main>
            <h1>{{ product.name }}</h1>
            <ImageGallery :images="product.images" />
            <p v-if="product.description" class="description" v-text="product.description" />

            <STList v-if="product.location || product.dateRange" class="info">
                <STListItem v-if="product.location">
                    <h3 class="style-definition-label">
                        {{ $t('%8a') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ product.location.name }}
                    </p>
                    <p v-if="product.location.address" class="style-description-small">
                        {{ product.location.address }}
                    </p>
                </STListItem>

                <STListItem v-if="product.dateRange">
                    <h3 class="style-definition-label">
                        {{ $t('%Vc') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatDateRange(product.dateRange) }}
                    </p>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts" setup>
import ImageGallery from '@stamhoofd/components/images/ImageGallery.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import type { Product, ProductDateRange } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

defineProps<{
    product: Product;
}>();

function formatDateRange(dateRange: ProductDateRange) {
    return Formatter.capitalizeFirstLetter(dateRange.toString());
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.product-info-view {
    .description {
        @extend %style-description;
        padding-top: 15px;
        white-space: pre-wrap;
    }

    .info {
        padding-top: 15px;
    }
}
</style>
