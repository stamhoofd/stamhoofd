<template>
    <STGrid>
        <STGridItem v-for="group of groups" :key="group.id" :selectable="canOpen(group)" class="price-grid right-stack breakdown-row" data-testid="breakdown-row" @click="canOpen(group) && $emit('select', group)">
            <template #left>
                <IconContainer :icon="group.icon" class="gray" :aside-icon="group.asideIcon" />
            </template>

            <h3 class="style-title-list">
                {{ group.name }}
            </h3>
            <p v-if="group.description" class="style-description-small pre-wrap" v-text="group.description" />
            <p v-for="[type, relation] of relationsToShow(group)" :key="type" class="style-description-small">
                {{ getBalanceItemRelationTypeName(type) }}: {{ relation.name }}
            </p>
            <p v-if="group.count" class="style-description-small">
                {{ countText(group.count) }}
            </p>
            <div v-if="total && group.price > 0" class="breakdown-share" :style="{ '--share': getShare(group) }" />

            <template #middleRight>
                <p v-if="group.quantity" class="style-price-base" :class="{negative: group.quantity < 0}">
                    {{ formatInteger(group.quantity) }}
                </p>
            </template>

            <template #right>
                <p class="style-price-base" :class="{negative: group.price < 0}">
                    {{ formatPrice(group.price) }}
                </p>
                <span v-if="canOpen(group)" class="icon arrow-right-small gray" />
            </template>
        </STGridItem>
    </STGrid>
</template>

<script lang="ts" setup>
import IconContainer from '@stamhoofd/components/icons/IconContainer.vue';
import STGrid from '@stamhoofd/components/layout/STGrid.vue';
import STGridItem from '@stamhoofd/components/layout/STGridItem.vue';
import type { BalanceItemRelation, BalanceItemRelationType, BreakdownGroup } from '@stamhoofd/structures';
import { getBalanceItemRelationTypeName } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

/**
 * The rows of one tab of a breakdown, shown like the items on a member's balance: an icon, what it is
 * for, and a bar showing how much of the total it is.
 */
const props = defineProps<{
    groups: BreakdownGroup[];
    /**
     * Used to draw the share of each row. Pass 0 to hide the bars.
     */
    total: number;
    /**
     * What the count of a row is a number of, which is the same for every tab of one breakdown.
     */
    countUnit: 'payments' | 'balanceItems';
}>();

defineEmits<{ (e: 'select', group: BreakdownGroup): void }>();

function countText(count: number): string {
    return props.countUnit === 'payments'
        ? Formatter.pluralText(count, $t('betaling'), $t('betalingen'))
        : Formatter.pluralText(count, $t('aanrekening'), $t('aanrekeningen'));
}

/**
 * The name of a group already says what it is, so only the relations that add something are shown.
 */
function relationsToShow(group: BreakdownGroup): [BalanceItemRelationType, BalanceItemRelation][] {
    return [...group.relations.entries()].filter(([_, relation]) => !group.name.toString().includes(relation.name.toString()));
}

/**
 * Whether a row leads somewhere: to a breakdown of what is inside it, or to the list of the objects it
 * is made of.
 */
function canOpen(group: BreakdownGroup): boolean {
    return group.canNarrowDown || group.selection !== null;
}

function getShare(group: BreakdownGroup): number {
    if (!props.total) {
        return 0;
    }

    return Math.min(1, Math.max(0, Math.abs(group.price) / Math.abs(props.total)));
}
</script>

<style lang="scss" scoped>
@use '@stamhoofd/scss/base/variables' as *;

.breakdown-row {
    // The arrow of a row that can be opened sits next to its price
    :deep(> .right) {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: flex-end;
        gap: 5px;
    }

    .breakdown-share {
        margin-top: 11px;
        height: 2px;
        border-radius: 2px;
        background: $color-background-shade;
        overflow: hidden;

        &::after {
            content: '';
            display: block;
            height: 100%;
            width: calc(var(--share, 0) * 100%);
            border-radius: 2px;
            background: $color-primary;
        }
    }
}
</style>
