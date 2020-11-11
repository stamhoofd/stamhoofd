<template>
    <div class="container">
        <h2>{{ optionMenu.name }}</h2>
        <STList>
            <STListItem v-for="option in optionMenu.options" :key="option.id" class="no-border right-description" :selectable="true" element-name="label">
                <Radio v-if="!optionMenu.multipleChoice" slot="left" v-model="selectedOption" :value="option.id" :name="optionMenu.id+'-optionmenu'" />
                <Checkbox v-else slot="left" :checked="isOptionSelected(option)" @change="selectOption(option, $event)" />

                {{ option.name }}

                <template v-if="option.price != 0" slot="right">
                    {{ option.price | priceChange }}
                </template>
            </STListItem>
        </STList>
        <hr>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Checkbox, Radio, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { CartItem, CartItemOption, Option, OptionMenu, Product, Version } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

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
    cartItem: CartItem

    @Prop({ required: true })
    optionMenu: OptionMenu

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

   

}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;


</style>