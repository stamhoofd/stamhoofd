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
                <StepperInput v-if="editable && !cartItem.cartError && cartItem.seats.length === 0 && (maximumRemaining === null || maximumRemaining > 1) && cartItem.productPrice.uitpasBaseProductPriceId === null" v-model="amount" :min="1" :max="maximumRemaining" @click.stop />
                <button v-if="editable" class="button icon trash" type="button" @click="deleteItem()" />
            </div>
        </footer>

        <p v-if="cartItem.cartError" class="error-box small">
            {{ cartItem.cartError.getHuman() }}

            <span v-if="editable" class="button text">
                <span>{{ $t('%fe') }}</span>
                <span class="icon arrow-right-small" />
            </span>
        </p>

        <template #right>
            <figure v-if="cartItem.product.images[0]">
                <ImageComponent :image="cartItem.product.images[0]" :auto-height="true" />
            </figure>
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import type { Cart, CartItem, Webshop } from '@stamhoofd/structures';
import { computed } from 'vue';

import StepperInput from '../inputs/StepperInput.vue';
import STListItem from '../layout/STListItem.vue';
import ImageComponent from './ImageComponent.vue';

const props = withDefaults(defineProps<{
    cart: Cart;
    webshop: Webshop;
    admin?: boolean;
    cartItem: CartItem;
    editable?: boolean;
}>(), {
    admin: false,
    editable: false,
});

const emit = defineEmits<{
    edit: [];
    amount: [amount: number];
    delete: [];
}>();

function editItem() {
    if (!props.editable) {
        return;
    }
    emit('edit');
}

const amount = computed({
    get: () => props.cartItem.amount,
    set: (amount: number) => {
        if (props.editable) {
            emit('amount', amount);
        }
    },
});

function deleteItem() {
    if (!props.editable) {
        return;
    }
    emit('delete');
}

const labels = computed(() => props.cartItem.discounts.filter(d => !!d.cartLabel));

const maximumRemaining = computed(() => props.cartItem.getMaximumRemaining(props.cartItem, props.cart, props.webshop, props.admin));
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.cart-item-row {
    h3 {
        padding-top: 5px;
        @extend %style-title-2;
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
    }

    .description {
        @extend %style-description-small;
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
