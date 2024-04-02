<template>
    <div class="pricing-box">
        <STList>
            <STListItem v-for="(item, index) of checkout.priceBreakown" :key="index">
                {{item.name}}

                <template slot="right">
                    {{ item.price | price }}
                </template>
            </STListItem>
        </STList>
    </div>
</template>


<script lang="ts">
import { STList, STListItem } from '@stamhoofd/components';
import { Checkout } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Prop, Vue } from 'vue-property-decorator';

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