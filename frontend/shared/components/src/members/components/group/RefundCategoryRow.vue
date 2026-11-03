<template>
    <STListItem class="refund-category-row">
        <template #left>
            <IconContainer icon="receive" class="gray" :aside-icon="asideIcon" />
        </template>

        <div class="refund-category-row-header">
            <div>
                <h3 class="style-title-list">
                    {{ pluralText(category.count, $t('inschrijving'), $t('inschrijvingen')) }} {{ statusText }}
                </h3>

                <p class="style-description-small">
                    {{ amountText }}
                </p>
            </div>

            <button type="button" class="button text" @click="showChoiceMenu">
                <span>{{ getChoiceName(choice) }}</span>
                <span class="icon arrow-down-small" />
            </button>
        </div>

        <p class="style-description-small">
            <template v-if="choice !== RefundChoice.CustomFee">{{ getChoiceDescription(choice) }}</template>
            <template v-else-if="category.type === RefundCategoryType.Paid">{{ $t('Je geeft') }} <PermyriadInlineInput v-model="customPercentage" :label="$t('Percentage dat je als tegoed geeft')" /> {{ $t('als tegoed en vraagt een annuleringskost van {percentage}.', { percentage: formatPercentage(category.cancellationFeePercentage) }) }}</template>
            <template v-else-if="category.type === RefundCategoryType.PartiallyPaid">{{ $t('Je vraagt een annuleringskost van') }} <PermyriadInlineInput v-model="customPercentage" :label="$t('Annuleringskost')" />{{ $t(', als er al te veel betaald werd geef je dit als tegoed.') }}</template>
            <template v-else>{{ $t('Je vraagt een annuleringskost van') }} <PermyriadInlineInput v-model="customPercentage" :label="$t('Annuleringskost')" />{{ $t(', de rest hoeft niet meer betaald te worden.') }}</template>
        </p>
    </STListItem>
</template>

<script setup lang="ts">
import IconContainer from '#icons/IconContainer.vue';
import STListItem from '#layout/STListItem.vue';
import { ContextMenu, ContextMenuItem } from '#overlays/ContextMenu.ts';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref, watch } from 'vue';
import PermyriadInlineInput from '#inputs/PermyriadInlineInput.vue';
import type { RefundCategory } from './refundCategories.ts';
import { RefundCategoryType, RefundChoice } from './refundCategories.ts';

const props = defineProps<{
    category: RefundCategory;
}>();

/**
 * The fees alone cannot tell a custom fee apart from a fee that happens to match another choice,
 * so the choice of the user is kept here.
 */
const choice = ref(props.category.choice);

// Registrations that are added to this category later follow the choice that is visible
watch(() => props.category.count, () => props.category.select(choice.value));

const asideIcon = computed(() => {
    switch (props.category.type) {
        case RefundCategoryType.Paid: return 'success green';
        case RefundCategoryType.PartiallyPaid: return 'clock yellow';
        case RefundCategoryType.NotPaid: return 'error red';
    }
});

const statusText = computed(() => {
    switch (props.category.type) {
        case RefundCategoryType.Paid: return $t('betaald');
        case RefundCategoryType.PartiallyPaid: return $t('gedeeltelijk betaald');
        case RefundCategoryType.NotPaid: return $t('nog niet betaald');
    }
});

const amountText = computed(() => {
    const received = $t('{amount} ontvangen', { amount: Formatter.price(props.category.amountPaid) });
    const open = $t('{amount} openstaand', { amount: Formatter.price(props.category.amountOpen) });

    switch (props.category.type) {
        case RefundCategoryType.Paid: return received;
        case RefundCategoryType.PartiallyPaid: return received + ' • ' + open;
        case RefundCategoryType.NotPaid: return open;
    }
});

/**
 * For registrations that were paid, the user edits the part that is given back instead of the fee:
 * that is the number the sentence is about.
 */
const customPercentage = computed({
    get: () => props.category.type === RefundCategoryType.Paid ? 100_00 - props.category.cancellationFeePercentage : props.category.cancellationFeePercentage,
    set: (value: number) => {
        props.category.cancellationFeePercentage = props.category.type === RefundCategoryType.Paid ? 100_00 - value : value;
    },
});

function getChoiceName(value: RefundChoice) {
    switch (props.category.type) {
        case RefundCategoryType.Paid:
            switch (value) {
                case RefundChoice.NoFee: return $t('Terugbetalen');
                case RefundChoice.FullFee: return $t('Niet terugbetalen');
                default: return $t('Gedeeltelijk terugbetalen');
            }
        case RefundCategoryType.PartiallyPaid:
            switch (value) {
                case RefundChoice.KeepPaid: return $t('Openstaand bedrag schrappen');
                case RefundChoice.FullFee: return $t('Openstaand bedrag behouden');
                default: return $t('Openstaand bedrag aanpassen');
            }
        case RefundCategoryType.NotPaid:
            switch (value) {
                case RefundChoice.NoFee: return $t('Schrappen');
                case RefundChoice.FullFee: return $t('Behouden');
                default: return $t('Gedeeltelijk schrappen');
            }
    }
}

function getChoiceDescription(value: RefundChoice) {
    switch (props.category.type) {
        case RefundCategoryType.Paid:
            switch (value) {
                case RefundChoice.NoFee: return $t('Je geeft het volledige bedrag als tegoed.');
                case RefundChoice.FullFee: return $t('Je betaalt niets terug.');
                default: return $t('Je vraagt een annuleringskost & de rest geef je als tegoed.');
            }
        case RefundCategoryType.PartiallyPaid:
            switch (value) {
                case RefundChoice.KeepPaid: return $t('Het ontvangen bedrag betaal je niet terug, de rest hoeft niet meer betaald te worden.');
                case RefundChoice.FullFee: return $t('Het volledige bedrag moet nog steeds betaald worden.');
                default: return $t('Kies zelf een annuleringskost die men uiteindelijk betaald moet hebben. Wat te veel betaald werd, geef je als tegoed.');
            }
        case RefundCategoryType.NotPaid:
            switch (value) {
                case RefundChoice.NoFee: return $t('De inschrijvingen hoeven niet meer betaald te worden.');
                case RefundChoice.FullFee: return $t('De inschrijvingen moeten nog steeds betaald worden.');
                default: return $t('Kies een bedrag dat nog betaald moet worden.');
            }
    }
}

function showChoiceMenu(event: MouseEvent) {
    const menu = new ContextMenu([
        props.category.choices.map(value => new ContextMenuItem({
            name: getChoiceName(value),
            description: getChoiceDescription(value),
            selected: choice.value === value,
            action: () => {
                choice.value = value;
                props.category.select(value);
            },
        })),
    ]);
    menu.show({ clickEvent: event }).catch(console.error);
}
</script>

<style lang="scss" scoped>
.refund-category-row {
    :deep(> .left) {
        padding-right: 12px;
    }

    .refund-category-row-header {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: 15px;

        @media (max-width: 550px) {
            flex-direction: column;
            align-items: flex-start;
            gap: 7px;
        }
    }
}
</style>
