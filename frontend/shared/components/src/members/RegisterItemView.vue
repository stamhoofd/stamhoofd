<template>
    <SaveView class="st-view register-item-view" main-class="flex" :loading="saving" :save-text="isInCart ? 'Aanpassen' : 'Toevoegen'" :save-icon="isInCart ? 'edit' : 'basket'" :disabled="!!validationError" :title="item.group.settings.name" v-on="isInCart ? {delete: deleteMe} : {}" @save="addToCart">
        <p class="style-title-prefix">
            {{ item.member.patchedMember.name }}
        </p>

        <h1>{{ item.group.settings.name }}</h1>
        <p v-for="registration in item.replaceRegistrations" :key="registration.id" class="style-description">
            <template v-if="registration.group.id !== item.group.id">
                Verplaatsen vanaf {{ registration.group.settings.name }}
            </template>
            <template v-else>
                Bestaande inschrijving aanpassen
            </template>
        </p>

        <ImageComponent v-if="item.group.settings.coverPhoto" :image="item.group.settings.coverPhoto" :auto-height="true" class="style-cover-photo" />

        <button v-if="suggestWaitingList" class="info-box icon clock selectable" type="button" @click="openWaitingList">
            <span>{{ validationError }}</span>
            <span class="button text">
                <span>Inschrijven</span>
                <span class="icon arrow-right-small" />
            </span>
        </button>
        <p v-else-if="validationError" class="error-box">
            {{ validationError }}
        </p>
        <p v-else-if="item.cartError" class="error-box small">
            {{ item.cartError.getHuman() }}
        </p>

        <p v-if="item.group.settings.description" class="style-description-block" v-text="item.group.settings.description" />

        <STErrorsDefault :error-box="errors.errorBox" />

        <template v-if="!suggestWaitingList">
            <div v-if="item.getFilteredPrices().length > 1" class="container">
                <STList>
                    <STListItem v-for="price in item.getFilteredPrices()" :key="price.id" :selectable="!price.isSoldOut(item) || admin" :disabled="price.isSoldOut(item) && !admin" element-name="label">
                        <template #left>
                            <Radio v-model="item.groupPrice" :value="price" :name="'groupPrice'" :disabled="price.isSoldOut(item) && !admin" />
                        </template>
                        <h4 class="style-title-list">
                            {{ price.name || 'Naamloos' }}
                        </h4>

                        <p v-if="price.getRemainingStock(item) === 0" class="style-description-small">
                            Uitverkocht
                        </p>

                        <template #right>
                            <span class="style-price-base">{{ formatPrice(price.price.forMember(item.member)) }}</span>
                        </template>
                    </STListItem>
                </STList>
            </div>

            <div v-for="menu in item.getFilteredOptionMenus()" :key="menu.id" class="container">
                <hr>
                <h2>{{ menu.name }}</h2>
                <p v-if="menu.description" class="pre-wrap style-description-block">
                    {{ menu.description }}
                </p>

                <STList>
                    <STListItem v-for="option in item.getFilteredOptions(menu)" :key="option.id" :selectable="!option.isSoldOut(item) || admin" :disabled="option.isSoldOut(item)&& !admin" element-name="label">
                        <template #left>
                            <Radio v-if="!menu.multipleChoice" :model-value="getOptionSelected(menu, option)" :value="true" :disabled="option.isSoldOut(item) && !admin" @update:model-value="setOptionSelected(menu, option, $event)" />
                            <Checkbox v-else :value="option" :disabled="option.isSoldOut(item) && !admin" :model-value="getOptionSelected(menu, option)" @update:model-value="setOptionSelected(menu, option, $event)" />
                        </template>
                        <h4 class="style-title-list">
                            {{ option.name || 'Naamloos' }}
                        </h4>
                        <p v-if="option.allowAmount && option.price.forMember(item.member)" class="style-description-small">
                            {{ formatPrice(option.price.forMember(item.member)) }} per stuk
                        </p>

                        <p v-if="option.getRemainingStock(item) && (option.maximum === null || option.getRemainingStock(item)! < option.maximum) && option.allowAmount" class="style-description-small">
                            Nog {{ Formatter.pluralText(option.getRemainingStock(item)!, 'stuk', 'stuks') }} beschikbaar
                        </p>

                        <p v-else-if="option.getRemainingStock(item) === 0" class="style-description-small">
                            Uitverkocht
                        </p>

                        <template #right>
                            <template v-if="option.allowAmount">
                                <template v-if="getOptionSelected(menu, option)">
                                    <NumberInput :model-value="getOptionAmount(menu, option)" suffix="stuks" suffix-singular="stuk" :max="option.getMaximumSelection(item)" :min="1" :stepper="true" @update:model-value="setOptionAmount(menu, option, $event)" />
                                </template>
                            </template>
                            <span v-else-if="option.price.forMember(item.member)" class="style-price-base">
                                {{ formatPrice(option.price.forMember(item.member)) }}
                            </span>
                        </template>
                    </STListItem>
                </STList>
            </div>

            <template v-if="!validationError">
                <div class="pricing-box max">
                    <PriceBreakdownBox :price-breakdown="item.priceBreakown" />
                </div>
            </template>
        </template>
    </SaveView>
</template>

<script setup lang="ts">
import { ComponentWithProperties, usePop, useShow } from '@simonbackx/vue-app-navigation';
import { ErrorBox, ImageComponent, NavigationActions, NumberInput, PriceBreakdownBox, RegisterItemView, useErrors, useNavigationActions } from '@stamhoofd/components';
import { GroupOption, GroupOptionMenu, RegisterItem, RegisterItemOption } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref, watch } from 'vue';

const props = defineProps<{
    item: RegisterItem,
    saveHandler: (newItem: RegisterItem, navigation: NavigationActions) => Promise<void>|void,
    showGroupInformation: boolean
}>();

const checkout = computed(() => props.item.member.family.checkout)
const errors = useErrors();
const saving = ref(false)
const navigationActions = useNavigationActions()
const isInCart = computed(() => checkout.value.cart.contains(props.item))
const pop = usePop()
const show = useShow()
const validationError = computed(() => props.item.validationError)
const validationErrorForWaitingList = computed(() => props.item.validationErrorForWaitingList)
const suggestWaitingList = computed(() => !!validationError.value && !validationErrorForWaitingList.value)
const admin = computed(() => checkout.value.isAdminFromSameOrganization)

async function openWaitingList() {
    if (saving.value || !props.item.group.waitingList) {
        return
    }
    const item = RegisterItem.defaultFor(props.item.member, props.item.group.waitingList, props.item.organization)
    await show({
        components: [
            new ComponentWithProperties(RegisterItemView, {
                ...props,
                item
            })
        ]
    })
}

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

async function deleteMe() {
    props.item.checkout.cart.remove(props.item)
    await pop({force: true})
}

watch(() => [props.item.groupPrice, props.item.options], () => {
    // We need to do cart level calculation, because discounts might be applied
    const clonedCart = checkout.value.cart.clone()
    clonedCart.remove(props.item)

    const clone = props.item.clone()
    clonedCart.add(clone)

    clonedCart.calculatePrices()

    props.item.calculatedPrice = clone.calculatedPrice
    props.item.calculatedRefund = clone.calculatedRefund
}, {deep: true})

</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.register-item-view {
    --st-sheet-width: 500px;
}

</style>
