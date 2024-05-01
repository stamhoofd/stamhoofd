<template>
    <div class="container">
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

                <template v-if="option.price != 0" slot="right">
                    {{ formatPriceChange(option.price) }}
                </template>
            </STListItem>
        </STList>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, Radio, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { Cart, CartItem, CartItemOption, CartStockHelper,Option, OptionMenu, Webshop } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Radio,
        Checkbox
    },
    filters: {
        price: Formatter.price.bind(Formatter),
        priceChange: Formatter.priceChange.bind(Formatter)
    }
})
export default class OptionMenuBox extends Mixins(NavigationMixin){
    @Prop({ required: true })
        webshop: Webshop

    @Prop({ required: true })
        cart: Cart

    @Prop({ required: true })
        cartItem: CartItem

    @Prop({ required: true })
        optionMenu: OptionMenu

    @Prop({ default: null })
        oldItem: CartItem | null
    
    @Prop({ default: false })
        admin: boolean
        
    isOptionSelected(option: Option) {
        return !!this.cartItem.options.find(o => o.optionMenu.id == this.optionMenu.id && o.option.id == option.id)
    }

    selectOption(option: Option, selected: boolean) {
        const filtered = this.cartItem.options.filter(o => o.optionMenu.id != this.optionMenu.id || o.option.id != option.id)
        if (selected) {
            filtered.push(CartItemOption.create({ optionMenu: this.optionMenu, option }))
        }
        this.cartItem.options = filtered
    }

    get selectedOption() {
        return this.cartItem.options.find(o => o.optionMenu.id == this.optionMenu.id)?.option?.id ?? ""
    }

    set selectedOption(id: string) {
        const option = this.optionMenu.options.find(o => o.id === id)
        if (!option) {
            return
        }
        const filtered = this.cartItem.options.filter(o => o.optionMenu.id != this.optionMenu.id)
        filtered.push(CartItemOption.create({ optionMenu: this.optionMenu, option }))
        this.cartItem.options = filtered
    }

    get product() {
        return this.cartItem.product
    }

    get maximumRemainingAcrossOptions() {
        return CartStockHelper.getRemainingAcrossOptions({
            product: this.product,
            oldItem: this.oldItem,
            cart: this.cart,
            webshop: this.webshop,
            admin: this.admin,
            amount: this.cartItem.amount
        }, {inMultipleCartItems: false})
    }

    getOptionStock(option: Option) {
        const optionStock = CartStockHelper.getOptionStock({product: this.product, oldItem: this.oldItem, cart: this.cart, option, webshop: this.webshop, admin: this.admin, amount: this.cartItem.amount})
        if (!optionStock) {
            return null
        }

        if (optionStock.remaining !== null && this.maximumRemainingAcrossOptions !== null && optionStock.remaining > this.maximumRemainingAcrossOptions) {
            // Doesn't matter to show this
            return null;
        }
        return optionStock
    }

    getOptionStockText(option: Option) {
        // Don't show text if all options are sold out
        if (this.maximumRemainingAcrossOptions === 0) {
            return null
        }

        return this.getOptionStock(option)?.shortText
    }

    canSelectOption(option: Option) {
        if (this.maximumRemainingAcrossOptions === 0) {
            return false
        }

        return this.getOptionStock(option)?.remaining !== 0
    }
}
</script>