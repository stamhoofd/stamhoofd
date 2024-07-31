<template>
    <form class="st-view register-item-view" @submit.prevent="addToCart">
        <STNavigationBar :title="item.group.settings.name">
            <template #left>
                <p>
                    <span v-if="item.calculatedPrice" class="style-price">{{ formatPrice(item.calculatedPrice) }}</span>
                </p>
            </template>
        </STNavigationBar>
        <main>
            <h1>{{ item.group.settings.name }}</h1>

            <STErrorsDefault :error-box="errors.errorBox" />

            <div v-if="item.getFilteredPrices({admin}).length > 1" class="container">
                <STList>
                    <STListItem v-for="price in item.getFilteredPrices({admin})" :key="price.id" :selectable="!price.isSoldOut" :disabled="price.isSoldOut" element-name="label">
                        <template #left>
                            <Radio v-model="item.groupPrice" :value="price" :name="'groupPrice'" :disabled="price.isSoldOut" />
                        </template>
                        <h4 class="style-title-list">
                            {{ price.name || 'Naamloos' }}
                        </h4>

                        <p v-if="price.remainingStock === 0" class="style-description-small">
                            Uitverkocht
                        </p>

                        <template #right>
                            <span class="style-price-base">{{ formatPrice(price.price.forMember(item.member)) }}</span>
                        </template>
                    </STListItem>
                </STList>
            </div>

            <div v-for="menu in item.getFilteredOptionMenus({admin})" :key="menu.id" class="container">
                <hr>
                <h2>{{ menu.name }}</h2>
                <p v-if="menu.description" class="pre-wrap style-description-block">
                    {{ menu.description }}
                </p>

                <STList>
                    <STListItem v-for="option in item.getFilteredOptions(menu, {admin})" :key="option.id" :selectable="!option.isSoldOut" :disabled="option.isSoldOut" element-name="label">
                        <template #left>
                            <Radio v-if="!menu.multipleChoice" :model-value="getOptionSelected(menu, option)" :value="true" :disabled="option.isSoldOut" @update:model-value="setOptionSelected(menu, option, $event)" />
                            <Checkbox v-else :value="option" :disabled="option.isSoldOut" :model-value="getOptionSelected(menu, option)" @update:model-value="setOptionSelected(menu, option, $event)" />
                        </template>
                        <h4 class="style-title-list">
                            {{ option.name || 'Naamloos' }}
                        </h4>
                        <p v-if="option.allowAmount && option.price.forMember(item.member)" class="style-description-small">
                            {{ formatPrice(option.price.forMember(item.member)) }} per stuk
                        </p>

                        <p v-if="option.remainingStock !== null && (option.maximum === null || option.remainingStock < option.maximum) && option.allowAmount" class="style-description-small">
                            Nog {{ Formatter.pluralText(option.remainingStock, 'stuk', 'stuks') }} beschikbaar
                        </p>

                        <p v-else-if="option.remainingStock === 0" class="style-description-small">
                            Uitverkocht
                        </p>

                        <template #right>
                            <template v-if="option.allowAmount">
                                <template v-if="getOptionSelected(menu, option)">
                                    <NumberInput :model-value="getOptionAmount(menu, option)" suffix="stuks" suffix-singular="stuk" :max="option.maximumSelection" :min="1" :stepper="true" @update:model-value="setOptionAmount(menu, option, $event)" />
                                </template>
                            </template>
                            <span v-else-if="option.price.forMember(item.member)" class="style-price-base">
                                {{ formatPrice(option.price.forMember(item.member)) }}
                            </span>
                        </template>
                    </STListItem>
                </STList>
            </div>

            <hr>
            <div class="pricing-box max">
                <PriceBreakdownBox :price-breakdown="[{name: 'Totaal', price: item.calculatedPrice}]" />
            </div>
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="saving">
                    <button class="button primary" type="submit">
                        <span class="icon basket" />
                        <span>Toevoegen</span>
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </form>
</template>

<script setup lang="ts">
import { ErrorBox, LoadingButton, NavigationActions, NumberInput, PriceBreakdownBox, useErrors, useNavigationActions } from '@stamhoofd/components';
import { GroupOption, GroupOptionMenu, RegisterItem, RegisterItemOption } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref, watch } from 'vue';

const props = defineProps<{
    item: RegisterItem,
    admin: boolean,
    saveHandler: (newItem: RegisterItem, navigation: NavigationActions) => Promise<void>|void
}>();

const checkout = computed(() => props.item.member.family.checkout)
const errors = useErrors();
const saving = ref(false)
const navigationActions = useNavigationActions()

async function addToCart() {
    if (saving.value) {
        return
    }
    saving.value = true
    errors.errorBox = null
    try {
        await props.saveHandler(props.item, navigationActions)
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    }
    saving.value = false
}

function getOptionSelected(menu: GroupOptionMenu, option: GroupOption) {
    return !!props.item.options.find(o => o.option.id === option.id)
}

function setOptionSelected(menu: GroupOptionMenu, option: GroupOption, selected: boolean) {
    setOptionAmount(menu, option, selected ? Math.max(1, getOptionAmount(menu, option)) : 0)
}

function getOptionAmount(menu: GroupOptionMenu, option: GroupOption) {
    return props.item.options.find(o => o.optionMenu.id === menu.id && o.option.id === option.id)?.amount ?? 0
}

function setOptionAmount(menu: GroupOptionMenu, option: GroupOption, amount: number) {
    if (!option.allowAmount && (amount !== 0 && amount !== 1)) {
        amount = amount !== 0 ? 1 : 0
    }
 
    if (amount === getOptionAmount(menu, option)) {
        return
    }

    console.log('setOptionAmount', menu, option, amount)

    let filteredOptions: RegisterItemOption[]
    
    if (!menu.multipleChoice && amount > 0) {
        // Clear all options from this menu
        filteredOptions = props.item.options.filter(o => o.optionMenu.id !== menu.id)
    } else {
        // Remove self
        filteredOptions = props.item.options.filter(o => o.optionMenu.id !== menu.id || o.option.id !== option.id)
    }

    if (amount > 0) {
        filteredOptions.push(
            RegisterItemOption.create({
                optionMenu: menu,
                option,
                amount
            })
        )
    }

    props.item.options = filteredOptions
}

watch(() => [props.item.groupPrice, props.item.options], () => {
    // We need to do cart level calculation, because discounts might be applied
    const clonedCart = checkout.value.cart.clone()
    clonedCart.remove(props.item)

    const clone = props.item.clone()
    clonedCart.add(clone)

    clonedCart.calculatePrices()

    props.item.calculatedPrice = clone.calculatedPrice
}, {deep: true})

//@Watch('cartItem', {deep: true})
//    onChangeItem() {
//        // Update the cart price on changes
//        const clonedCheckout = this.checkout.clone();
//        if (this.oldItem) {
//            clonedCheckout.cart.removeItem(this.oldItem)
//        }
//        const pricedItem = this.cartItem.clone()
//        clonedCheckout.cart.addItem(pricedItem, false) // No merging (otherwise prices are not updated)
//
//        // Calculate prices
//        clonedCheckout.update(this.webshop)
//        this.pricedCheckout = clonedCheckout
//        this.pricedItem = pricedItem
//    }

</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.register-item-view {
    --st-sheet-width: 500px;
}

</style>
