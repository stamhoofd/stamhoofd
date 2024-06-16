<template>
    <div class="pricing-box">
        <STList>
            <STListItem v-for="(item, index) of priceBreakdown" :key="index">
                {{ item.name }}

                <template #right>
                    {{ formatPrice(item.price) }}
                </template>
            </STListItem>
        </STList>
    </div>
</template>


<script lang="ts" setup>
import { PriceBreakdown } from '@stamhoofd/structures';

defineProps<{
    priceBreakdown: PriceBreakdown
}>();
</script>
