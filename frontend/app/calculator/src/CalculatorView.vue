<template>
    <div class="calculator-view">
        <div class="split-calculator">
            <div class="main-text-container">
                <h1 class="style-title-semihuge">
                    Bereken de totale prijs
                </h1>
                <p class="style-description-block">
                    Op basis van data van duizenden andere evenementen, kunnen we goed inschatten hoeveel alles zal kosten voor jou. Vul de velden in en zie meteen hoeveel je per ticket zal betalen.
                </p>

                <STInputBox title="Wat wil je organiseren?" class="max">
                    <div class="style-input-box list-input-box">
                        <STList class="illustration-list">
                            <ModuleListItem :module="module" :selectable="true" @click="chooseModule" />
                        </STList>
                    </div>
                </STInputBox>

                <div v-for="(product, index) of products" :key="index" class="container">
                    <div class="split-inputs">
                        <div>
                            <STInputBox :title="module === ModuleType.Members ? (products.length === 1 ? 'Inschrijvingsbedrag' : ('Inschrijvingsgroep of activiteit ' + (index + 1))) : (products.length === 1 ? 'Ticketprijs' : ('Ticketprijs ' + (index + 1)))" error-fields="unitPrice">
                                <PriceInput v-model="product.unitPrice" placeholder="bv. €10" />
                            </STInputBox>
                        </div>

                        <div>
                            <STInputBox title="Aantal" error-fields="persons">
                                <NumberInput v-model="product.amount" :min="1" placeholder="bv. 100" :suffix="module === ModuleType.Members ? 'inschrijvingen' : 'tickets'" />

                                <template #right>
                                    <button v-if="products.length > 1" v-tooltip="module === ModuleType.Members ? 'Verwijderen' : 'Dit ticket verwijderen'" type="button" class="button icon small trash" @click="products.splice(index, 1)" />
                                    <button v-if="index === products.length - 1" v-tooltip="module === ModuleType.Members ? 'Nog een activiteit, leeftijdsgroep of onderverdeling toevoegen' : 'Nog een ticket toevoegen'" type="button" class="button icon small add" @click="products.push(new CalculationProduct(product))" />
                                </template>
                            </STInputBox>
                        </div>
                    </div>
                </div>
                <p v-if="module === ModuleType.Members && products.length === 1" class="style-description-small">
                    Als je meerdere tarieven hebt, of ook activiteiten organiseert kan je die elk apart toevoegen, samen met het verwachte aantal inschrijvingen. Op die manier kan je de totaalkost goed inschatten.
                </p>

                <div v-if="module === ModuleType.Members && (products.length > 1 || (persons !== null && persons !== suggestedPersons))">
                    <STInputBox title="Uniek aantal leden" error-fields="persons">
                        <NumberInput v-model="persons" suffix="leden" :placeholder="Formatter.integer(suggestedPersons) + ' leden'" :required="false" :min="minimumPersons" :max="maximumPersons" />
                    </STInputBox>
                </div>

                <p class="style-button-bar">
                    <button type="button" class="button primary" @click="showTest">
                        Uitproberen
                    </button>

                    <button type="button" class="button text" @click="showSettingsView">
                        <span class="icon settings" />
                        <span>Meer instellingen</span>
                    </button>
                </p>
            </div>
            <div class="main-text-container">
                <CalculationOutputBox v-if="result" :output="result.output" :input="input" />

                <STList v-if="false">
                    <STListItem :selectable="true" @click="showComparePricesView">
                        <template #left>
                            <IconContainer icon="calculator">
                                <template #aside>
                                    <span class="icon label small stroke" />
                                </template>
                            </IconContainer>
                        </template>

                        <h3 class="style-title-list">
                            Vergelijken
                        </h3>

                        <template #right>
                            <span class="button text selected">
                                <span>Vergelijk</span>
                                <span class="icon arrow-right" />
                            </span>
                        </template>
                    </STListItem>
                </STList>

                <p>
                    <button type="button" class="button text" @click="showDetails = !showDetails">
                        <span>Gedetailleerde berekening</span>
                        <span v-if="!showDetails" class="icon arrow-down-small" />
                        <span v-else class="icon arrow-up-small" />
                    </button>
                </p>

                <DetailedCalculationBox v-if="showDetails && result" :output="result.output" />
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { IconContainer, NumberInput, PriceInput, usePositionableSheet } from '@stamhoofd/components';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref, watch, watchEffect } from 'vue';
import CalculationOutputBox from './CalculationOutputBox.vue';
import { CalculationInput, CalculationProduct } from './classes/CalculationInput';
import { Country } from './classes/Country';
import { ModuleType } from './classes/ModuleType';
import { calculatePaymentMethodUsage, getPaymentMethodDescription, getPaymentMethodName, PaymentMethod } from './classes/PaymentMethod';
import { StamhoofdTariffs } from './classes/tariffs/stamhoofd';
import ComparePricesView from './ComparePricesView.vue';
import DetailedCalculationBox from './DetailedCalculationBox.vue';
import ModuleListItem from './ModuleListItem.vue';
import ModuleSelectionView from './ModuleSelectionView.vue';
import CalculatorSettingsView from './CalculatorSettingsView.vue';

const present = usePresent();
const { presentPositionableSheet } = usePositionableSheet();

async function showTest() {
    // todo
}

async function showComparePricesView() {
    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(ComparePricesView, {
                    input: input.value,
                }),
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

const showDetails = ref(false);

const tariffDef = StamhoofdTariffs;
const input = ref(new CalculationInput({
    module: ModuleType.Tickets,
    products: [
        new CalculationProduct({ unitPrice: 10_00, amount: 1000 }),
    ],
    averageAmountPerOrder: 3,
    requestedPaymentMethods: [PaymentMethod.Payconiq, PaymentMethod.Bancontact],
    options: {
        country: Country.BE,
    },
}));

async function showSettingsView(event: MouseEvent) {
    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(CalculatorSettingsView, {
                    input: input.value,
                }),
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

const module = computed({
    get: () => input.value.module,
    set: (module) => {
        input.value.module = module;

        if (module === ModuleType.Members) {
            for (const product of input.value.products) {
                if (product.amount > 100) {
                    product.amount = 100;
                }
            }
        }
    },
});

const persons = computed({
    get: () => input.value.customPersons,
    set: (persons) => {
        input.value.customPersons = persons;
    },
});
const products = computed({
    get: () => input.value.products,
    set: (products) => {
        input.value.products = products;
    },
});

async function chooseModule(event: MouseEvent) {
    const width = (event.currentTarget as HTMLElement)?.offsetWidth ?? 800;
    console.log('Choosing module with width:', width);
    await presentPositionableSheet(event, {
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(ModuleSelectionView, {
                    selected: module.value,
                    onSelect: (m: ModuleType) => {
                        module.value = m;
                    },
                }),
            }),
        ],
    }, {
        width: (event.currentTarget as HTMLElement)?.offsetWidth ?? 800,
        innerPadding: 0,
        padding: 5,
    });
}

const suggestedPersons = computed(() => {
    return input.value.suggestedPersons;
});

const maximumPersons = computed(() => {
    return input.value.maximumPersons;
});

const minimumPersons = computed(() => {
    return input.value.minimumPersons;
});

const result = computed(() => {
    try {
        return tariffDef.calculate(input.value);
    }
    catch (error) {
        console.error('Error calculating tariff:', error);
        return null;
    }
});

</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.split-calculator {
    display: grid;
    grid-template-columns: 1fr minmax(auto, 400px);
    gap: 40px;
}

.calculation-box {
    border-radius: 16px;
    border: 1px solid rgba(0, 0, 0, 0.08);
    background: $color-background-shade;
    box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.05);

    --st-horizontal-padding: 30px;
    padding: 15px 30px;
    margin: 15px 0;
}

.list-input-box {
    padding: 0 15px;
    --st-horizontal-padding: 15px;
    overflow: hidden;
}

</style>
