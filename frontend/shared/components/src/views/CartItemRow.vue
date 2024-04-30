<template>
    <STListItem class="cart-item-row" :selectable="editable" @click="editItem()">
        <h3>
            <span>{{ cartItem.product.name }}</span>
            <span v-if="editable" class="icon arrow-right-small gray" />
        </h3>
        <p v-if="cartItem.description" class="description" v-text="cartItem.description" />

        <p v-if="labels.length > 0" class="discount-tags">
            <span v-for="discount of labels" :key="discount.id" class="style-tag discount">
                {{ discount.cartLabel }}
            </span>
        </p>

        <footer>
            <p v-if="!cartItem.getFormattedPriceWithDiscount()" class="price">
                {{ cartItem.getFormattedPriceWithoutDiscount() }}
            </p>
            <p v-else class="price">
                <span class="style-discount-old-price">{{ cartItem.getFormattedPriceWithoutDiscount() }}</span>
                <span class="style-discount-price">{{ cartItem.getFormattedPriceWithDiscount() }}</span>
            </p>
            <div @click.stop>
                <span v-if="cartItem.formattedAmount" class="amount">{{ cartItem.formattedAmount }}</span>
                <StepperInput v-if="editable && !cartItem.cartError && cartItem.seats.length == 0 && (maximumRemaining === null || maximumRemaining > 1)" v-model="amount" :min="1" :max="maximumRemaining" @click.native.stop />
                <button v-if="editable" class="button icon trash" type="button" @click="deleteItem()" />
            </div>
        </footer>

        <p v-if="cartItem.cartError" class="error-box small">
            {{ cartItem.cartError.getHuman() }}

            <span v-if="editable" class="button text">
                <span>Corrigeren</span>
                <span class="icon arrow-right-small" />
            </span>
        </p>

        <figure v-if="cartItem.product.images[0]" slot="right">
            <ImageComponent :image="cartItem.product.images[0]" :auto-height="true" />
        </figure>
    </STListItem>
</template>


<script lang="ts">
import { Cart, CartItem, Webshop } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Prop, VueComponent } from '@simonbackx/vue-app-navigation/classes';

import StepperInput from '../inputs/StepperInput.vue';
import STList from '../layout/STList.vue';
import STListItem from '../layout/STListItem.vue';
import ImageComponent from './ImageComponent.vue';

@Component({
    components: {
        STList,
        STListItem,
        StepperInput,
        ImageComponent
    },
    filters: {
        price: Formatter.price.bind(Formatter),
    },
    emits: ['edit', 'amount', 'delete']
})
export default class CartItemRow extends VueComponent {
    @Prop({required: true })
        cart!: Cart

    @Prop({required: true })
        webshop!: Webshop

    @Prop({default: false })
        admin!: boolean

    @Prop({required: true })
        cartItem!: CartItem

    @Prop({required: false, default: false })
        editable!: boolean

    editItem() {
        if (!this.editable) {
            return;
        }
        this.$emit('edit')
    }

    get amount() {
        return this.cartItem.amount
    }

    set amount(amount: number) {
        if (!this.editable) {
            return;
        }
        this.$emit('amount', amount)
    }

    deleteItem() {
        if (!this.editable) {
            return;
        }
        this.$emit('delete');
    }

    get labels() {
        return this.cartItem.discounts.filter(d => !!d.cartLabel)
    }

    get maximumRemaining() {
        const remaining = this.cartItem.getMaximumRemaining(this.cartItem, this.cart, this.webshop, this.admin);
        return remaining
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.cart-item-row {
    h3 {
        padding-top: 5px;
        @extend .style-title-3;
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
    }

    .description {
        @extend .style-description-small;
        padding-top: 5px;
        white-space: pre-wrap;
    }

    .price {
        font-size: 14px;
        line-height: 1.4;
        font-weight: 600;
        color: $color-primary;
    }

    .amount {
        font-size: 14px;
        line-height: 1.4;
        font-weight: 600;
        margin-right: 15px;
    }

    .discount-tags {
        padding-top: 5px;

        > .style-tag {
            margin-left: 5px;

            &:first-child {
                margin-left: 0;
            }
        }
    }

    .style-discount-old-price {
        text-decoration: line-through;
        color: $color-gray-4;
    }

    .style-discount-price {
        color: $color-discount;
        margin-left: 5px;
    }

    footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    figure {
        width: 70px;

        @media (min-width: 340px) {
            width: 80px;
        }

        @media (min-width: 801px) {
            width: 100px;
        }

        img {
            border-radius: $border-radius;
        }
    }
}

</style>