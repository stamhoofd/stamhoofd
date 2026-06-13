<template>
    <STErrorsInput :error-fields="'optionMenus.' + optionMenu.id" :error-box="errorBox" class="container">
        <hr>
        <h2>
            {{ optionMenu.name || 'Maak een keuze' }}
        </h2>

        <STList>
            <STListItem v-for="option in optionMenu.options" :key="option.id" class="no-border right-price" :selectable="canSelectOption(option)" :disabled="!canSelectOption(option)" element-name="label">
                <template #left>
                    <Radio v-if="!optionMenu.multipleChoice" v-model="selectedOption" :value="option.id" :name="optionMenu.id+'-optionmenu'" :disabled="!canSelectOption(option)" />
                    <Checkbox v-else :model-value="isOptionSelected(option)" :disabled="!canSelectOption(option)" @update:model-value="selectOption(option, $event)" />
                </template>

                <h4 class="style-title-list">
                    {{ option.name || 'Naamloos' }}
                </h4>

                <p v-if="getOptionStockText(option)" class="style-description-small">
                    {{ getOptionStockText(option) }}
                </p>

                <template v-if="option.price !== 0" #right>
                    {{ formatPriceChange(option.price) }}
                </template>
            </STListItem>
        </STList>
    </STErrorsInput>
</template>

<script lang="ts" setup>
import Checkbox from '#inputs/Checkbox.vue';
import type { ErrorBox } from '#errors/ErrorBox.ts';
import Radio from '#inputs/Radio.vue';
import STList from '#layout/STList.vue';
import STListItem from '#layout/STListItem.vue';
import STErrorsInput from '#errors/STErrorsInput.vue';
import type { Cart, CartItem, Option, OptionMenu, Webshop } from '@stamhoofd/structures';
import { CartItemOption, CartStockHelper } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';

const props = withDefaults(defineProps<{
    webshop: Webshop;
    cart: Cart;
    cartItem: CartItem;
    optionMenu: OptionMenu;
    oldItem?: CartItem | null;
    admin?: boolean;
    errorBox?: ErrorBox | null;
}>(), {
    oldItem: null,
    admin: false,
    errorBox: null,
});

const formatPriceChange = Formatter.priceChange.bind(Formatter);
const product = computed(() => props.cartItem.product);

function isOptionSelected(option: Option) {
    return !!props.cartItem.options.find(o => o.optionMenu.id === props.optionMenu.id && o.option.id === option.id);
}

function selectOption(option: Option, selected: boolean) {
    const filtered = props.cartItem.options.filter(o => o.optionMenu.id !== props.optionMenu.id || o.option.id !== option.id);
    if (selected) {
        filtered.push(CartItemOption.create({ optionMenu: props.optionMenu, option }));
    }
    props.cartItem.options = filtered;
}

const selectedOption = computed({
    get: () => props.cartItem.options.find(o => o.optionMenu.id === props.optionMenu.id)?.option?.id ?? '',
    set: (id: string) => {
        const option = props.optionMenu.options.find(o => o.id === id);
        if (!option) {
            return;
        }
        const filtered = props.cartItem.options.filter(o => o.optionMenu.id !== props.optionMenu.id);
        filtered.push(CartItemOption.create({ optionMenu: props.optionMenu, option }));
        props.cartItem.options = filtered;
    },
});

const maximumRemainingAcrossOptions = computed(() => CartStockHelper.getRemainingAcrossOptions({
    product: product.value,
    oldItem: props.oldItem,
    cart: props.cart,
    webshop: props.webshop,
    admin: props.admin,
    amount: props.cartItem.amount,
}, { inMultipleCartItems: false }));

function getOptionStock(option: Option) {
    const optionStock = CartStockHelper.getOptionStock({
        product: product.value,
        oldItem: props.oldItem,
        cart: props.cart,
        option,
        webshop: props.webshop,
        admin: props.admin,
        amount: props.cartItem.amount,
    });
    if (!optionStock) {
        return null;
    }

    if (optionStock.remaining !== null && maximumRemainingAcrossOptions.value !== null && optionStock.remaining > maximumRemainingAcrossOptions.value) {
        return null;
    }
    return optionStock;
}

function getOptionStockText(option: Option) {
    if (maximumRemainingAcrossOptions.value === 0) {
        return null;
    }
    return getOptionStock(option)?.shortText;
}

function canSelectOption(option: Option) {
    if (maximumRemainingAcrossOptions.value === 0) {
        return false;
    }
    return getOptionStock(option)?.remaining !== 0;
}
</script>
