<template>
    <div class="st-view">
        <STNavigationBar title="Vergelijken" />
        <main>
            <h1>
                Instellingen
            </h1>

            <STInputBox :title="module === ModuleType.Members ? 'Gemiddeld aantal inschrijvingen per bestelling' : (module === ModuleType.Webshops ? 'Gemiddeld aantal stuks per bestelling' : 'Gemiddeld aantal tickets per bestelling')" error-fields="averageAmountPerOrder">
                <NumberInput v-model="averageAmountPerOrder" :min="100" :placeholder="Formatter.float(input.suggestedAverageAmountPerOrder)" :floating-point="true" :required="false" />
            </STInputBox>
            <p v-if="module === ModuleType.Members" class="style-description-small">
                Mensen kunnen meerdere inschrijven per bestelling uitvoeren (bv. broers en zussen, meerdere kampen...). Dat drukt bepaalde kosten, zoals bv. transactiekosten. Gemiddeld kan je rekenen op 1,3 inschrijvingen per bestelling.
            </p>
            <p v-else-if="module === ModuleType.Tickets" class="style-description-small">
                Mensen kunnen meerdere tickets per bestelling aankopen. Dat drukt bepaalde kosten, zoals bv. transactiekosten. Gemiddeld kan je rekenen op 3 tickets per bestelling. Verkoop je tickets die gemiddeld 30 euro kosten, dan moet je dit verlagen naar 2,6. Vanaf tickets van 80 euro gaat het richting 2 tickets per bestelling.
            </p>
            <p v-else class="style-description-small">
                Mensen kunnen meerdere items per bestelling aankopen (bv. 2 pakjes wafels). Dat drukt bepaalde kosten, zoals bv. transactiekosten. Gemiddeld kan je rekenen op 3 stuks per bestelling. Verkoop je artikels die gemiddeld 30 euro kosten, dan moet je dit verlagen naar 2,6. Vanaf artikels van 80 euro gaat het richting 2 stuks per bestelling.
            </p>

            <STList>
                <STListItem class="right-stack" :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox v-model="withVAT" />
                    </template>
                    <h3 class="style-title-list">
                        Toon prijzen incl. BTW (= je vereniging is niet BTW-plichtig)
                    </h3>
                    <p class="style-description-small">
                        Sommige verenigingen zijn niet BTW-plichtig en moeten dus ook BTW betalen op hun kosten. Aangezien de meeste andere platformen ook altijd hun prijzen excl. BTW tonen, zijn we helaas genoodzaakt om dit standaard ook zo te tonen om vergelijken eerlijker te doen verlopen. Schakel dit aan als je de prijs wel met BTW wil zien.
                    </p>
                </STListItem>
                <STListItem class="right-stack" :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox v-model="unregisteredBusiness" />
                    </template>
                    <h3 class="style-title-list">
                        Onze organisatie is georganiseerd als feitelijke vereniging
                    </h3>
                    <p class="style-description-small">
                        Als feitelijke vereniging (= je hebt geen VZW of andere rechtspersoonlijkheid) kan je niet aansluiten bij Mollie, en laten we dat bij die betaalprovider in de berekeningen buiten beschouwing. Enkel voor hogere bedragen kan Mollie iets voordeliger zijn.
                    </p>
                </STListItem>
            </STList>

            <hr>
            <h2>
                Betaalmethodes
                <a v-tooltip="'Meer info over prijzen en verschillen'" href="https://www.stamhoofd.be/docs/transactiekosten/" target="_blank" class="button icon help small" />
            </h2>

            <p>
                Als je online betaalmethodes gebruikt, moet je nog een transactiekost betalen aan de betaalproviders. Stamhoofd neemt hier nooit een marge op, dit geld gaat volledig naar de betaalprovider. We onderhandelen wel lagere kosten bij de betaalproviders zodat jullie minder betalen.
            </p>

            <STList>
                <STListItem v-for="([method, fees]) of tariffDef.modules.get(input.module)?.getTier(input)?.transactionFees" :key="method" class="right-stack" :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox :model-value="getPaymentSelected(method)" @update:model-value="setPaymentSelected(method, $event)" />
                    </template>
                    <h3 class="style-title-list">
                        {{ getPaymentMethodName(method) }}
                    </h3>

                    <p class="style-description-small">
                        {{ getPaymentMethodDescription(method) }}
                    </p>

                    <p v-for="(fee, index) in fees" :key="index" class="style-description-small">
                        {{ (fees.length > 1 ? ('Optie ' + (index + 1) + ': ') : '') }}{{ fee.getDescription(method) }}
                    </p>

                    <template v-if="getPaymentSelected(method)" #right>
                        <span class="style-description-small">
                            {{ Formatter.percentage(getPercentageForPaymentMethod(method)) }}
                        </span>
                    </template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { NumberInput } from '@stamhoofd/components';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';
import { CalculationInput } from './classes/CalculationInput';
import { calculatePaymentMethodUsage, getPaymentMethodDescription, getPaymentMethodName, PaymentMethod } from './classes/PaymentMethod';
import { StamhoofdTariffs } from './classes/tariffs/stamhoofd';
import { ModuleType } from './classes/ModuleType';

const props = defineProps<{
    input: CalculationInput;
}>();

const module = computed(() => props.input.module);

const tariffDef = StamhoofdTariffs;
const selectedPaymentMethods = computed({
    get: () => props.input.requestedPaymentMethods,
    set: (methods) => {
        props.input.requestedPaymentMethods = methods;
    },
});
const averageAmountPerOrder = computed({
    get: () => props.input.customAverageAmountPerOrder ? Math.round(props.input.customAverageAmountPerOrder * 100) : null,
    set: (customAverageAmountPerOrder) => {
        if (customAverageAmountPerOrder === null) {
            props.input.customAverageAmountPerOrder = null;
            return;
        }

        props.input.customAverageAmountPerOrder = customAverageAmountPerOrder / 100;
    },
});
const withVAT = computed({
    get: () => props.input.withVAT,
    set: (withVAT) => {
        props.input.withVAT = withVAT;
    },
});
const registeredBusiness = computed({
    get: () => props.input.registeredBusiness,
    set: (registeredBusiness) => {
        props.input.registeredBusiness = registeredBusiness;
    },
});
const unregisteredBusiness = computed({
    get: () => !registeredBusiness.value,
    set: (unregisteredBusiness) => {
        registeredBusiness.value = !unregisteredBusiness;
    },
});
function getPercentageForPaymentMethod(method: PaymentMethod): number {
    return calculatePaymentMethodUsage(selectedPaymentMethods.value, props.input.options).get(method) ?? 0;
}

function getPaymentSelected(method: PaymentMethod): boolean {
    return selectedPaymentMethods.value.includes(method);
}
function setPaymentSelected(method: PaymentMethod, selected: boolean) {
    if (selected) {
        if (!getPaymentSelected(method)) {
            selectedPaymentMethods.value.push(method);
        }
    }
    else {
        selectedPaymentMethods.value = selectedPaymentMethods.value.filter(m => m !== method);
    }
}

</script>
