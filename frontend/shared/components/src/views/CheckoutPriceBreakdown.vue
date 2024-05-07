<template>
    <div class="pricing-box">
        <STList>
            <STListItem v-for="(item, index) of checkout.priceBreakown" :key="index">
                {{ item.name }}

                <template #right>
                    {{ formatPrice(item.price) }}
                </template>
            </STListItem>
        </STList>
    </div>
</template>


<script lang="ts">
import { Checkout } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Prop, Vue } from '@simonbackx/vue-app-navigation/classes';

import STList from "../layout/STList.vue";
import STListItem from "../layout/STListItem.vue";

@Component({
    components: {
        STList,
        STListItem,
    },
    filters: {
        price: Formatter.price.bind(Formatter),
    }
})
export default class CheckoutPriceBreakdown extends Vue {
    @Prop({required: true })
        checkout: Checkout
}
</script>