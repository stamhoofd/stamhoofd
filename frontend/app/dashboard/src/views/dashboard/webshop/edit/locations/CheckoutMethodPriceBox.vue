<template>
    <div class="container">
        <STInputBox error-fields="price" title="Leveringskost" :error-box="errorBox">
            <PriceInput v-model="price" placeholder="Gratis" />
        </STInputBox>

        <Checkbox v-model="useMinimumPrice">
            Andere leveringskost vanaf bestelbedrag
        </Checkbox>

        <div v-if="useMinimumPrice" class="split-inputs">
            <STInputBox error-fields="minimumPrice" title="Vanaf bestelbedrag" :error-box="errorBox">
                <PriceInput v-model="minimumPrice" placeholder="€ 0" />
            </STInputBox>

            <STInputBox error-fields="discountPrice" title="Verminderde leveringskost" :error-box="errorBox">
                <PriceInput v-model="discountPrice" placeholder="Gratis" />
            </STInputBox>
        </div>
    </div>
</template>

<script lang="ts">
import { Checkbox, ErrorBox, PriceInput, STInputBox } from '@stamhoofd/components';
import { CheckoutMethodPrice } from '@stamhoofd/structures';
import { Component, Prop, VueComponent } from '@simonbackx/vue-app-navigation/classes';

@Component({
    components: {
        STInputBox,
        PriceInput,
        Checkbox,
    },
})
export default class CheckoutMethodPriceBox extends VueComponent {
    @Prop({})
    checkoutMethodPrice: CheckoutMethodPrice;

    @Prop({ default: null })
    errorBox: ErrorBox | null;

    get price() {
        return this.checkoutMethodPrice.price;
    }

    set price(price: number) {
        this.$emit('patch', CheckoutMethodPrice.patch({ price }));
    }

    get useMinimumPrice() {
        return this.checkoutMethodPrice.minimumPrice !== null;
    }

    set useMinimumPrice(useMinimumPrice: boolean) {
        if (useMinimumPrice === this.useMinimumPrice) {
            return;
        }

        this.$emit('patch', CheckoutMethodPrice.patch({ minimumPrice: useMinimumPrice ? this.minimumPrice : null }));
    }

    get minimumPrice() {
        return this.checkoutMethodPrice.minimumPrice ?? 0;
    }

    set minimumPrice(minimumPrice: number | null) {
        this.$emit('patch', CheckoutMethodPrice.patch({ minimumPrice }));
    }

    get discountPrice() {
        return this.checkoutMethodPrice.discountPrice;
    }

    set discountPrice(discountPrice: number) {
        this.$emit('patch', CheckoutMethodPrice.patch({ discountPrice }));
    }
}
</script>
