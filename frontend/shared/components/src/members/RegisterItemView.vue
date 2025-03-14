<template>
    <SaveView class="st-view register-item-view" main-class="flex" :loading="saving" :save-text="isInCart ? 'Aanpassen' : 'Toevoegen'" :save-icon="isInCart ? 'edit' : 'basket'" :title="item.group.settings.name" v-on="isInCart ? {delete: deleteMe} : {}" @save="addToCart">
        <p class="style-title-prefix">
            {{ item.organization.name }}
        </p>

        <h1>
            {{ item.group.settings.name }}

            <span v-if="item.group.settings.period && item.group.type === GroupType.Membership" class="title-suffix">
                {{ item.group.settings.period.nameShort }}
            </span>
        </h1>
        <p v-for="registration in item.replaceRegistrations" :key="registration.id" class="style-description">
            <template v-if="registration.group.id !== item.group.id">
                Verplaatsen vanaf {{ registration.group.settings.name }}
            </template>
            <template v-else>
                Bestaande inschrijving aanpassen
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

        <p v-if="item.totalPrice && contextOrganization && checkout.asOrganizationId && !checkout.isAdminFromSameOrganization" class="warning-box">
            Je betaalt deze inschrijving in naam van {{ contextOrganization.name }}. Je moet zelf de kosten aan je leden doorrekenen indien gewenst.
        </p>

        <template v-if="item.replaceRegistrations.length === 0">
            <p v-if="item.group.settings.description" class="style-description-block" v-text="item.group.settings.description" />
            <p v-else class="style-description-block" v-text="'Schrijf ' +item.member.patchedMember.firstName+ ' hier in. Voeg de inschrijving toe aan je winkelmandje en reken daarna alle inschrijvingen in één keer af.' " />
        </template>

        <STErrorsDefault :error-box="errors.errorBox" />
        <div v-if="admin" class="container">
            <STInputBox :title="$t('a1ae6e8f-dbcd-4a53-a67c-0244d28ccb74')" error-fields="customStartDate" :error-box="errors.errorBox">
                <DateSelection v-model="customStartDate" :required="false" :placeholder="formatDate(item.defaultStartDate, true)" :min="item.group.settings.startDate" :max="item.group.settings.endDate" />
            </STInputBox>
            <p v-if="item.group.settings.trialDays > 0" class="style-description-small">
                Als beheerder kan je zelf een andere startdatum kiezen voor deze inschrijving. Bijvoorbeeld om een proefperiode later te laten beginnen, of een late inschrijving vroeger te laten starten.
            </p>
            <p v-else class="style-description-small">
                Als beheerder kan je zelf een andere startdatum kiezen voor deze inschrijving. Bijvoorbeeld om een late inschrijving vroeger te laten starten.
            </p>
        </div>

        <div v-if="item.canHaveTrial || trial" class="container">
            <hr>
            <h2>
                <span>Proefperiode</span>
                <span class="style-tag">{{ Formatter.days(item.group.settings.trialDays) }}</span>
            </h2>
            <p>{{ item.member.patchedMember.details.firstName }} komt in aanmerking voor een proefperiode van {{ Formatter.days(item.group.settings.trialDays) }}. Je moet dan pas betalen tegen het einde van de proefperiode (via het ledenportaal). Als je de inschrijving stopzet voor afloop van de proefperiode, hoef je niets te betalen. Als je geen proefperiode wilt, kan je ook onmiddelijk inschrijven als volwaardig lid.</p>

            <STList>
                <CheckboxListItem v-model="trial" label="Ik wil gebruik maken van de proefperiode" description="Als je dit aanvinkt zal je nog niet meteen moeten betalen voor de inschrijving, maar pas bij afloop van de proefperiode." />
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
                <STListItem v-for="option in item.getFilteredOptions(menu)" :key="option.id" :selectable="!option.isSoldOut(item) || admin" :disabled="option.isSoldOut(item)&& !admin" element-name="label" class="left-center">
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

        <div v-for="category in categories.filter(c => c.isEnabled(item))" :key="category.id" class="container">
            <hr>
            <FillRecordCategoryBox :category="category" :value="item" :validator="errors.validator" :level="2" :all-optional="false" :force-mark-reviewed="true" @patch="addRecordAnswersPatch" />
        </div>

        <div class="pricing-box max">
            <PriceBreakdownBox :price-breakdown="item.priceBreakown" />
        </div>
    </SaveView>
</template>

<script setup lang="ts">
import { patchObject } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CheckboxListItem, DateSelection, ErrorBox, ImageComponent, NavigationActions, NumberInput, PriceBreakdownBox, STList, useErrors, useNavigationActions, useOrganization } from '@stamhoofd/components';
import { GroupOption, GroupOptionMenu, GroupType, PatchAnswers, RegisterItem, RegisterItemOption } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, onMounted, Ref, ref, watch } from 'vue';
import FillRecordCategoryBox from '../records/components/FillRecordCategoryBox.vue';

const props = defineProps<{
    item: RegisterItem;
    saveHandler: (newItem: RegisterItem, navigation: NavigationActions) => Promise<void> | void;
    showGroupInformation: boolean;
}>();

const checkout = computed(() => props.item.member.family.checkout);
const errors = useErrors();
const saving = ref(false);
const navigationActions = useNavigationActions();
const isInCart = computed(() => checkout.value.cart.contains(props.item));
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

onMounted(() => {
    errors.errorBox = null;
    try {
        validate();
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
});

const trial = computed({
    get: () => props.item.trial,
    set: (value: boolean) => props.item.trial = value,
});

const customStartDate = computed({
    get: () => props.item.customStartDate,
    set: (value: Date | null) => props.item.customStartDate = value,
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
        validate();
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

watch(() => [props.item.groupPrice, props.item.options, props.item.trial], () => {
    // We need to do cart level calculation, because discounts might be applied
    const clonedCart = checkout.value.cart.clone();
    clonedCart.remove(props.item);

    const clone = props.item.clone();
    clonedCart.add(clone);

    clonedCart.calculatePrices();

    props.item.calculatedPrice = clone.calculatedPrice;
    props.item.calculatedRefund = clone.calculatedRefund;
    props.item.calculatedPriceDueLater = clone.calculatedPriceDueLater;
}, { deep: true });

</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.register-item-view {
    --st-sheet-width: 500px;
}

</style>
