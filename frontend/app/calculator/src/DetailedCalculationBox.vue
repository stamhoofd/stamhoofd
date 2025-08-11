<template>
    <article class="calculation-box">
        <STList>
            <STListItem v-for="(product, index) of input.products" :key="index">
                <h3 v-if="input.module === ModuleType.Tickets" class="style-title-list">
                    Ticketprijs {{ (input.products.length > 1 ? (index + 1) : '') }}
                </h3>
                <h3 v-if="input.module === ModuleType.Webshops" class="style-title-list">
                    Stukprijs {{ (input.products.length > 1 ? (index + 1) : '') }}
                </h3>
                <h3 v-if="input.module === ModuleType.Members" class="style-title-list">
                    Prijs per inschrijving {{ (input.products.length > 1 ? (index + 1) : '') }}
                </h3>
                <p class="style-description-small">
                    x {{ formatInteger(product.amount) }}
                </p>

                <template #right>
                    <span class="style-price-base">
                        {{ formatPrice(product.unitPrice ?? 0) }}
                    </span>
                </template>
            </STListItem>
            <STListItem>
                <h3 class="style-title-list larger">
                    Totale omzet
                </h3>

                <template #right>
                    <span class="style-price-base large">
                        {{ formatPrice(input.volume) }}
                    </span>
                </template>
            </STListItem>
        </STList>

        <STList v-if="output.serviceFees.totalPrice > 0">
            <STListItem v-for="(line, index) in output.serviceFees.lines" :key="index">
                <h3 class="style-title-list">
                    {{ line.title }}
                </h3>
                <p class="style-description-small">
                    {{ line.description }}
                </p>
                <p v-if="line.calculationDescription" class="style-description-small">
                    {{ line.calculationDescription }}
                </p>

                <template #right>
                    <span class="style-price-base">
                        {{ formatPrice(line.totalPrice) }}
                    </span>
                </template>
            </STListItem>
            <STListItem>
                <h3 class="style-title-list larger">
                    Totaal servicekosten
                </h3>

                <template #right>
                    <span class="style-price-base large">
                        {{ formatPrice(output.serviceFees.totalPrice) }}
                    </span>
                </template>
            </STListItem>
        </STList>

        <STList v-if="output.transactionFees.totalPrice > 0">
            <STListItem v-for="(line, index) in output.transactionFees.lines" :key="index">
                <h3 class="style-title-list">
                    {{ line.title }}
                </h3>
                <p class="style-description-small pre-wrap">
                    {{ line.description }}
                </p>
                <p v-if="line.calculationDescription" class="style-description-small pre-wrap">
                    {{ line.calculationDescription }}
                </p>

                <template #right>
                    <span class="style-price-base">
                        {{ formatPrice(line.totalPrice) }}
                    </span>
                </template>
            </STListItem>
            <STListItem>
                <h3 class="style-title-list larger">
                    Totaal transactiekosten
                </h3>

                <template #right>
                    <span class="style-price-base large">
                        {{ formatPrice(output.transactionFees.totalPrice) }}
                    </span>
                </template>
            </STListItem>
        </STList>
    </article>
</template>

<script lang="ts" setup>
import { CalculationInput } from './classes/CalculationInput';
import { CalculationOutput } from './classes/CalculationOutput';
import { ModuleType } from './classes/ModuleType';

defineProps<{
    output: CalculationOutput;
    input: CalculationInput;
}>();

</script>
