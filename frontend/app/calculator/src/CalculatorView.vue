<template>
    <div class="calculator-view main-text-container">
        <aside v-copyable class="style-title-prefix large">
            Alles inbegrepen
        </aside>
        <h1 class="style-title-huge">
            Bereken de kostprijs
        </h1>
        <p class="style-description-block-large">
            Op basis van data van duizenden andere organisaties, kunnen we goed inschatten hoeveel alles kost. Vul de velden in en bekijk meteen hoeveel je per ticket, inschrijving of artikel moet betalen.
        </p>

        <div class="split-calculator">
            <div class="main-text-container">
                <STInputBox title="Wat wil je organiseren?" class="max">
                    <div class="style-input-box list-input-box">
                        <STList class="illustration-list">
                            <ModuleListItem v-for="m of allModules" :key="m" v-model="module" :selectable="true" :module="m" @click="module = m;">
                                <template #right>
                                    <span class="icon arrow-right-small gray" />
                                </template>
                            </ModuleListItem>
                        </STList>
                    </div>
                </STInputBox>

                <div v-for="(product, index) of products" :key="index" class="container">
                    <div class="split-inputs">
                        <div>
                            <STInputBox :title="module === ModuleType.Members ? (products.length > 1 ? ('Inschrijvingsgroep/activiteit '+(index+1)) : 'Wat is jouw prijs per inschrijving?') : (module === ModuleType.Webshops ? (products.length > 1 ? ('Stukprijs '+(index+1)) : 'Wat is jouw stukprijs?') : (products.length > 1 ? ('Ticket '+(index+1)) : 'Wat is jouw ticketprijs?'))" error-fields="unitPrice">
                                <PriceInput v-model="product.unitPrice" placeholder="bv. €10" />
                            </STInputBox>
                        </div>

                        <div>
                            <STInputBox title="Aantal" error-fields="persons">
                                <NumberInput v-model="product.amount" :min="1" placeholder="bv. 100" :suffix-singular="module === ModuleType.Members ? 'inschrijving' : (module === ModuleType.Webshops ? 'stuk' : 'ticket')" :suffix="module === ModuleType.Members ? 'inschrijvingen' : (module === ModuleType.Webshops ? 'stuks' : 'tickets')" />

                                <template #right>
                                    <button v-if="products.length > 1" v-tooltip="module === ModuleType.Members ? 'Verwijderen' : 'Dit ticket verwijderen'" type="button" class="button icon small trash" @click="products.splice(index, 1)" />
                                    <button v-if="index === products.length - 1" v-tooltip="module === ModuleType.Members ? 'Nog een activiteit, leeftijdsgroep of onderverdeling toevoegen' : 'Nog een ticket toevoegen'" type="button" class="button icon small add" @click="products.push(new CalculationProduct(product))" />
                                </template>
                            </STInputBox>
                        </div>
                    </div>
                </div>

                <STInputBox v-if="module === ModuleType.Members && products.length > 1" title="Uniek aantal leden" error-fields="persons">
                    <NumberInput v-model="persons" :min="minimumPersons" :max="maximumPersons" :placeholder="suggestedPersons + ' leden'" :suffix-singular="'lid'" :suffix="'leden'" />
                </STInputBox>
                <p v-if="module === ModuleType.Members" class="style-description-small">
                    Een lid kan inschrijven voor zoveel activiteiten als je wilt, dat kost je niets meer. Je kan activiteiten of onderverdelingen toevoegen via de '+'-knop om ook je omzet en transactiekosten te berekenen.
                </p>
            </div>
            <div class="main-text-container">
                <STInputBox title="Kostprijs" class="max">
                    <CalculationOutputBox v-if="result" :output="result.output" :input="input" />

                    <template #right>
                        <button v-tooltip="'Meer instellingen'" type="button" class="button icon settings small" @click="showSettingsView" />
                    </template>
                </STInputBox>

                <p class="info-box icon discount">
                    Je kiest zelf of je de kost doorrekent aan de besteller (via een administratiekost).
                </p>

                <p>
                    <button type="button" class="button text" @click="showDetails = !showDetails">
                        <span>Gedetailleerde berekening</span>
                        <span v-if="!showDetails" class="icon arrow-down-small" />
                        <span v-else class="icon arrow-up-small" />
                    </button>
                </p>

                <DetailedCalculationBox v-if="showDetails && result" :output="result.output" :input="input" />
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { NumberInput, PriceInput } from '@stamhoofd/components';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';
import CalculationOutputBox from './CalculationOutputBox.vue';
import CalculatorSettingsView from './CalculatorSettingsView.vue';
import { CalculationInput, CalculationProduct } from './classes/CalculationInput';
import { Country } from './classes/Country';
import { ModuleType } from './classes/ModuleType';
import { PaymentMethod } from './classes/PaymentMethod';
import { StamhoofdTariffs } from './classes/tariffs/stamhoofd';
import DetailedCalculationBox from './DetailedCalculationBox.vue';
import ModuleListItem from './ModuleListItem.vue';

const present = usePresent();

const showDetails = ref(false);
const allModules = [
    ModuleType.Tickets,
    ModuleType.Members,
    ModuleType.Webshops,
];

// try to get country from domain name
const splitted = window.location.hostname.split('.');
const tld = splitted[splitted.length - 1].toLowerCase();
let country = Country.BE; // Default to Belgium if no match found
switch (tld) {
    case 'be': {
        country = Country.BE;
        break;
    }
    case 'nl': {
        country = Country.NL;
        break;
    }
}

const tariffDef = StamhoofdTariffs;
const input = ref(new CalculationInput({
    module: ModuleType.Tickets,
    products: [
        new CalculationProduct({ unitPrice: 7_0000, amount: 100 }),
    ],
    requestedPaymentMethods: country === Country.BE ? [PaymentMethod.Payconiq, PaymentMethod.Bancontact] : [PaymentMethod.iDEAL],
    options: {
        country,
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
        forceModalDisplay: true,
    });
}

const module = computed({
    get: () => input.value.module,
    set: (module) => {
        if (input.value.module === module) {
            return; // No change, do nothing
        }
        input.value.module = module;
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

    @media (max-width: 1200px) {
        grid-template-columns: 1fr;
        gap: 20px;
    }
}

.calculation-box {
    border-radius: 16px;
    border: 1px solid rgba(0, 0, 0, 0.08);
    background: $color-background-shade;
    box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.05);

    --st-horizontal-padding: 30px;
    padding: 15px 30px;
    margin: 0 0;
}

.list-input-box {
    padding: 0 15px;
    --st-horizontal-padding: 15px;
    overflow: hidden;
}

</style>
