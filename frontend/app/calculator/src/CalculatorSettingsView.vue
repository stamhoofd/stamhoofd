<template>
    <div class="st-view">
        <STNavigationBar title="Vergelijken" />
        <main>
            <h1>
                Instellingen
            </h1>

            <STInputBox title="Gemiddeld aantal tickets per bestelling" error-fields="averageAmountPerOrder">
                <NumberInput v-model="averageAmountPerOrder" :min="100" placeholder="bv. 2" :floating-point="true" />
            </STInputBox>
            <p class="style-description-small">
                Mensen kunnen meerdere inschrijven of tickets per bestelling aankopen. Dat drukt bepaalde kosten, zoals bv. transactiekosten. Gemiddeld kan je rekenen op 3 tickets per bestelling. Verkoop je tickets die gemiddeld 30 euro kosten, dan moet je dit verlagen naar 2,6. Vanaf tickets van 80 euro gaat het richting 2 tickets per bestelling.
            </p>

            <STInputBox title="Betaalmethodes" class="max">
                <template #right>
                    <button v-tooltip="'Meer info over prijzen en verschillen'" type="button" class="button icon help small" />
                </template>
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
            </STInputBox>
            <p class="info-box">
                Als je online betaalmethodes gebruikt, moet je nog een transactiekost betalen aan de betaalproviders. Stamhoofd neemt hier nooit een marge op, dit geld gaat volledig naar de betaalprovider. We onderhandelen wel lagere kosten bij de betaalproviders zodat jullie minder betalen.
            </p>

            <STInputBox title="BTW" class="max">
                <STList>
                    <STListItem class="right-stack" :selectable="true" element-name="label">
                        <template #left>
                            <Checkbox />
                        </template>
                        <h3 class="style-title-list">
                            Toon prijzen incl. BTW (= je vereniging is niet BTW-plichtig)
                        </h3>
                        <p class="style-description-small">
                            Sommige verenigingen zijn niet BTW-plichtig en moeten dus ook BTW betalen op hun kosten. Aangezien de meeste andere platformen ook altijd hun prijzen excl. BTW tonen, zijn we helaas genoodzaakt om dit standaard ook zo te tonen om vergelijken eerlijker te doen verlopen. Schakel dit aan als je de prijs wel met BTW wil zien.
                        </p>

                        <template #right>
                            <button v-tooltip="'We tonen het verwachte percentage van betalingen die deze betaalmethode zal gebruiken volgens onze statistieken.'" class="button icon help small" type="button" />
                        </template>
                    </STListItem>
                </STList>
            </STInputBox>
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

const props = defineProps<{
    input: CalculationInput;
}>();

const tariffDef = StamhoofdTariffs;
const selectedPaymentMethods = computed({
    get: () => props.input.requestedPaymentMethods,
    set: (methods) => {
        props.input.requestedPaymentMethods = methods;
    },
});
const averageAmountPerOrder = computed({
    get: () => Math.round(props.input.averageAmountPerOrder * 100),
    set: (averageAmountPerOrder) => {
        props.input.averageAmountPerOrder = averageAmountPerOrder / 100;
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
