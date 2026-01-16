<template>
    <SaveView class="st-view register-item-view" main-class="flex" :loading="saving" :save-text="isInCart ? $t('112de4a4-afa3-4ad7-bbb6-003d435a6426') : (willStartCheckoutFlow ? $t('9639fa42-022e-483f-9969-b893ae79affc') : $t('36ba68cb-2159-4179-8ded-89e73d47cd87'))" :save-icon="isInCart ? 'edit' : (willStartCheckoutFlow ? 'success' : 'basket')" :title="item.group.settings.name" v-on="isInCart ? {delete: deleteMe} : {}" @save="addToCart">
        <p class="style-title-prefix">
            {{ item.organization.name }}
        </p>

        <h1>
            {{ item.group.settings.name }}

            <span v-if="item.group.settings.period && item.group.type === GroupType.Membership" class="title-suffix">
                {{ item.group.settings.period.nameShort }}
            </span>
        </h1>
        <p v-for="{registration} in item.replaceRegistrations" :key="registration.id" class="style-description">
            <template v-if="registration.group.id !== item.group.id">
                {{ $t('ece5e681-db76-4ce3-8e5e-c9dbcc4d8f0e', {group: registration.group.settings.name}) }}
            </template>
            <template v-else>
                {{ $t('5f1406dd-4801-49f5-9906-37e89b393baf') }}
            </template>
        </p>

        <template v-if="item.replaceRegistrations.length === 0">
            <ImageComponent v-if="item.group.settings.coverPhoto" :image="item.group.settings.coverPhoto" :auto-height="true" class="style-cover-photo" />
        </template>

        <p v-if="item.cartError" class="error-box small">
            {{ item.cartError.getHuman() }}
        </p>

        <p v-if="validationWarning" class="warning-box small">
            {{ validationWarning }}
        </p>

        <p v-if="cachedTotalPrice && contextOrganization && checkout.asOrganizationId && !checkout.isAdminFromSameOrganization" class="warning-box">
            {{ $t('4e758459-990f-488d-b457-d2e0f7edd9cc', {organization: contextOrganization.name}) }}
        </p>

        <template v-if="item.replaceRegistrations.length === 0">
            <p v-if="item.group.settings.description.toString()" class="style-description-block" v-text="item.group.settings.description.toString()" />
            <p v-else class="style-description-block" v-text="$t('ea2ad051-2874-42e2-8275-aa6e8d05d66a', {member: item.member.patchedMember.firstName})" />
        </template>

        <STErrorsDefault :error-box="errors.errorBox" />
        <div v-if="admin" class="container">
            <SendConfirmationEmailBox v-if="willStartCheckoutFlow" :checkout="checkout" :group="item.group" :group-organization="item.organization" :validator="errors.validator" />

            <div class="split-inputs">
                <div>
                    <STInputBox :title="$t('a1ae6e8f-dbcd-4a53-a67c-0244d28ccb74')" error-fields="customStartDate" :error-box="errors.errorBox">
                        <DateSelection v-model="customStartDate" :required="false" :placeholder-date="item.defaultStartDate" :min="item.group.settings.startDate" :max="item.group.settings.endDate" />
                    </STInputBox>
                </div>
                <div>
                    <STInputBox :title="$t('aef10d71-39c4-4cdb-8252-5fd31781abd8')" error-fields="customEndDate" :error-box="errors.errorBox">
                        <DateSelection v-model="customEndDate" :required="false" :placeholder-date="item.defaultEndDate" :min="item.group.settings.startDate" :max="item.group.settings.endDate" />
                    </STInputBox>
                </div>
            </div>
            <p v-if="item.group.settings.trialDays > 0" class="style-description-small">
                {{ $t('914a5499-b6db-4495-91dd-be4e412c9d64') }}
            </p>
            <p v-else class="style-description-small">
                {{ $t('4ad9864f-c191-4f00-8321-d3ba67e5adab') }}
            </p>
        </div>

        <div v-if="item.canHaveTrial || trial" class="container">
            <hr><h2>
                <span>{{ $t('4d4c0732-2875-4de8-afae-d8b2687ff279') }}</span>
                <span class="style-tag">{{ Formatter.days(item.group.settings.trialDays) }}</span>
            </h2>
            <p>{{ $t('1b2f2b52-0852-40c3-b1d3-758577b28424', {member: item.member.patchedMember.details.firstName, days: Formatter.days(item.group.settings.trialDays)}) }}</p>

            <STList>
                <CheckboxListItem v-model="trial" :description="$t('c88d1d2c-f336-424f-858a-4c8aa75a068d')" :label="$t(`f40cdbc2-a5b2-4020-bd34-12c181905764`)" />
            </STList>
        </div>

        <div v-if="item.getFilteredPrices().length > 1" class="container">
            <STList>
                <STListItem v-for="price in item.getFilteredPrices()" :key="price.id" :selectable="!price.isSoldOut(item) || admin" :disabled="price.isSoldOut(item) && !admin" element-name="label" class="left-center">
                    <template #left>
                        <Radio v-model="item.groupPrice" :value="price" :name="'groupPrice'" :disabled="price.isSoldOut(item) && !admin" />
                    </template>
                    <h4 class="style-title-list">
                        {{ price.name || 'Naamloos' }}
                    </h4>

                    <p v-if="price.getRemainingStock(item) === 0" class="style-description-small">
                        {{ $t('44ba544c-3db6-4f35-b7d1-b63fdcadd9ab') }}
                    </p>

                    <p v-if="admin && getPeriodString(price)" class="style-description-small">
                        {{ getPeriodString(price) }}
                    </p>

                    <template #right>
                        <span class="style-price-base">{{ formatPrice(price.price.forMember(item.member)) }}</span>
                    </template>
                </STListItem>
            </STList>
        </div>

        <div v-for="menu in item.getFilteredOptionMenus()" :key="menu.id" class="container">
            <hr><h2>{{ menu.name }}</h2>
            <p v-if="menu.description" class="pre-wrap style-description-block">
                {{ menu.description }}
            </p>

            <STList>
                <STListItem v-for="option in item.getFilteredOptions(menu)" :key="option.id" :selectable="!option.isSoldOut(item) || admin" :disabled="option.isSoldOut(item)&& !admin" element-name="label" class="left-center">
                    <template #left>
                        <Radio v-if="!menu.multipleChoice" :model-value="getOptionSelected(menu, option)" :value="true" :disabled="option.isSoldOut(item) && !admin" @update:model-value="setOptionSelected(menu, option, $event)" />
                        <Checkbox v-else :value="option" :disabled="option.isSoldOut(item) && !admin" :model-value="getOptionSelected(menu, option)" @update:model-value="setOptionSelected(menu, option, $event)" />
                    </template>
                    <h4 class="style-title-list">
                        {{ option.name || 'Naamloos' }}
                    </h4>
                    <p v-if="option.allowAmount && option.price.forMember(item.member)" class="style-description-small">
                        {{ $t('2f7604ae-889e-4574-af76-1559ab0e8120', {price: formatPrice(option.price.forMember(item.member))}) }}
                    </p>

                    <p v-if="option.getRemainingStock(item) && (option.maximum === null || option.getRemainingStock(item)! < option.maximum) && option.allowAmount" class="style-description-small">
                        {{ $t('dceceb1c-6d55-4a93-bf8f-85ba041786f4', {stock: Formatter.pluralText(option.getRemainingStock(item)!, $t('86e03c52-25db-45f7-a129-5f165b289324'), $t('7d5de81e-9ae9-4ec6-86e1-844ca6a75fb1'))}) }}
                    </p>

                    <p v-else-if="option.getRemainingStock(item) === 0" class="style-description-small">
                        {{ $t('44ba544c-3db6-4f35-b7d1-b63fdcadd9ab') }}
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

        <div v-for="category in categories.filter(c => c.isEnabled(item))" :key="category.id" class="container">
            <hr><FillRecordCategoryBox :category="category" :value="item" :validator="errors.validator" :level="2" :all-optional="false" :force-mark-reviewed="true" @patch="addRecordAnswersPatch" />
        </div>

        <div v-if="cachedPriceBreakdown" class="pricing-box max">
            <PriceBreakdownBox :price-breakdown="cachedPriceBreakdown" />
        </div>
    </SaveView>
</template>

<script setup lang="ts">
import { patchObject } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CheckboxListItem, DateSelection, ErrorBox, ImageComponent, NavigationActions, NumberInput, PriceBreakdownBox, STList, useErrors, useNavigationActions, useOrganization } from '@stamhoofd/components';
import { GroupOption, GroupOptionMenu, GroupPrice, GroupType, PatchAnswers, PriceBreakdown, RegisterItem, RegisterItemOption } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, onMounted, Ref, ref, watch } from 'vue';
import FillRecordCategoryBox from '../records/components/FillRecordCategoryBox.vue';
import SendConfirmationEmailBox from './SendConfirmationEmailBox.vue';

const props = defineProps<{
    item: RegisterItem;
    saveHandler: (newItem: RegisterItem, navigation: NavigationActions) => Promise<void> | void;
    willStartCheckoutFlow?: boolean;
}>();

const checkout = computed(() => props.item.member.family.checkout);
const errors = useErrors();
const saving = ref(false);
const navigationActions = useNavigationActions();
const isInCart = checkout.value.cart.contains(props.item); // only check on mount to avoid rendering change on save
const pop = usePop();
const admin = computed(() => checkout.value.isAdminFromSameOrganization);
const validationWarning = ref(null) as Ref<string | null>;
const contextOrganization = useOrganization();

function addRecordAnswersPatch(patch: PatchAnswers) {
    props.item.recordAnswers = patchObject(props.item.recordAnswers, patch);
}

const categories = computed(() => {
    return props.item.group.settings.recordCategories;
});

function validate() {
    props.item.validate();
    validationWarning.value = props.item.cartError ? null : props.item.validationWarning;
}

const customStartDate = computed({
    get: () => props.item.customStartDate,
    set: (value: Date | null) => props.item.customStartDate = value,
});

const customEndDate = computed({
    get: () => props.item.customEndDate,
    set: (value: Date | null) => props.item.customEndDate = value,
});

watch(() => [props.item.groupPrice, customStartDate.value, customEndDate.value], () => {
    updateErrorAndWarning();
});

function updateErrorAndWarning() {
    errors.errorBox = null;
    try {
        validate();
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
}

onMounted(() => {
    updateErrorAndWarning();
});

const trial = computed({
    get: () => props.item.trial,
    set: (value: boolean) => props.item.trial = value,
});

async function addToCart() {
    if (saving.value) {
        return;
    }
    saving.value = true;
    errors.errorBox = null;
    try {
        if (!await errors.validator.validate()) {
            saving.value = false;
            return;
        }
        props.item.validate({ final: true });
        await props.saveHandler(props.item, navigationActions);
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    saving.value = false;
}

function getOptionSelected(menu: GroupOptionMenu, option: GroupOption) {
    return !!props.item.options.find(o => o.option.id === option.id);
}

function setOptionSelected(menu: GroupOptionMenu, option: GroupOption, selected: boolean) {
    setOptionAmount(menu, option, selected ? Math.max(1, getOptionAmount(menu, option)) : 0);
}

function getOptionAmount(menu: GroupOptionMenu, option: GroupOption) {
    return props.item.options.find(o => o.optionMenu.id === menu.id && o.option.id === option.id)?.amount ?? 0;
}

function setOptionAmount(menu: GroupOptionMenu, option: GroupOption, amount: number) {
    if (!option.allowAmount && (amount !== 0 && amount !== 1)) {
        amount = amount !== 0 ? 1 : 0;
    }

    if (amount === getOptionAmount(menu, option)) {
        return;
    }

    let filteredOptions: RegisterItemOption[];

    if (!menu.multipleChoice && amount > 0) {
        // Clear all options from this menu
        filteredOptions = props.item.options.filter(o => o.optionMenu.id !== menu.id);
    }
    else {
        // Remove self
        filteredOptions = props.item.options.filter(o => o.optionMenu.id !== menu.id || o.option.id !== option.id);
    }

    if (amount > 0) {
        filteredOptions.push(
            RegisterItemOption.create({
                optionMenu: menu,
                option,
                amount,
            }),
        );
    }

    props.item.options = filteredOptions;
}

async function deleteMe() {
    props.item.checkout.cart.remove(props.item);
    await pop({ force: true });
}

const cachedPriceBreakdown = ref<PriceBreakdown | null>(null);
const cachedTotalPrice = ref<number | null>(null);
watch(() => [props.item.groupPrice, props.item.options, props.item.trial], () => {
    // We need to do cart level calculation, because discounts might be applied
    const clonedCheckout = checkout.value.clone();

    const clone = props.item.clone();
    clonedCheckout.add(clone);

    if (props.willStartCheckoutFlow) {
        // Show the cart breakdown instead of only the item breakdown
        cachedPriceBreakdown.value = clonedCheckout.priceBreakown;
    }
    else {
        cachedPriceBreakdown.value = clone.getPriceBreakown(clonedCheckout.cart);
    }
    cachedTotalPrice.value = clone.totalPrice;
}, { deep: true });

function getPeriodString(groupPrice: GroupPrice): string | null {
    const startDate = groupPrice.startDate;
    const endDate = groupPrice.endDate;

    if (startDate && endDate) {
        return $t(`25d1906f-b5b8-441c-8ff7-2e41a75d13e4`, { range: Formatter.dateRange(startDate, endDate) });
    }

    if (startDate) {
        return $t(`761ba5a0-8f9b-4c87-b3d0-559e3f6e8d92`, { date: Formatter.startDate(startDate) });
    }

    if (endDate) {
        return $t(`543f5147-f7a5-430b-9b20-b974e809627d`, { date: Formatter.endDate(endDate) });
    }

    return null;
}

</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.register-item-view {
    --st-sheet-width: 500px;
}

</style>
