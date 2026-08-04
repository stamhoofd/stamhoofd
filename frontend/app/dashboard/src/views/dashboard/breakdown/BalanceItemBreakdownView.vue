<template>
    <SaveView :loading="exporting" :title="title" :save-text="$t('%Oy')" save-icon="download" :cancel-text="$t('%9b')" :disabled="!canExport" @save="startExport">
        <template #buttons>
            <button v-if="breakdown" v-tooltip="$t('%Zic')" class="button icon ul" type="button" data-testid="show-list-button" @click="openTable(breakdown.selection)" />
        </template>

        <h1 class="style-navigation-title">
            {{ title }} <span v-if="breakdown" class="title-suffix">{{ formatPrice(breakdown.price) }}</span>
        </h1>

        <p v-if="pathNames.length > 1" class="style-description-block">
            {{ pathNames.join(' · ') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <p v-if="canExportWithoutBreakdown" class="warning-box">
            {{ $t('%ZiT') }}
        </p>

        <template v-if="loading">
            <Spinner class="center" />

            <p class="style-description-small center">
                {{ $t('%ZiZ') }}
            </p>
        </template>

        <template v-else-if="breakdown">
            <STList class="info">
                <STListItem>
                    <h3 class="style-definition-label">
                        {{ priceLabel }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(breakdown.price) }}
                    </p>
                    <p class="style-description-small">
                        {{ pluralText(breakdown.balanceItemCount, $t('%Zj5'), $t('%Zjf')) }}
                    </p>
                </STListItem>

                <STListItem v-if="breakdown.pricePaid">
                    <h3 class="style-definition-label">
                        {{ $t('%1OD') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(breakdown.pricePaid) }}
                    </p>
                </STListItem>

                <STListItem v-if="breakdown.pricePending">
                    <h3 class="style-definition-label">
                        {{ $t('%1OL') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(breakdown.pricePending) }}
                    </p>
                </STListItem>

                <STListItem v-if="breakdown.priceOpen">
                    <h3 class="style-definition-label">
                        {{ $t('%1Ni') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(breakdown.priceOpen) }}
                    </p>
                </STListItem>
            </STList>

            <p v-if="amountMessage" class="info-box">
                {{ amountMessage }}
            </p>

            <template v-if="breakdown.graph.points.length > 3">
                <hr>
                <BreakdownGraphView :graph="breakdown.graph" :title="priceLabel" />
            </template>

            <ScrollableSegmentedControl v-if="tabs.length > 1" v-model="tab" :items="tabs" :labels="tabLabels" />

            <p v-if="visibleGroups.length === 0" class="info-box">
                {{ $t('%ZiQ') }}
            </p>

            <BreakdownList v-else :groups="visibleGroups" :total="breakdown.price" count-unit="balanceItems" @select="openGroup" />

            <p v-if="hasClosedGroups" class="info-box">
                {{ $t('%ZiW') }}
            </p>
        </template>
    </SaveView>
</template>

<script lang="ts" setup>
import type { Decoder } from '@simonbackx/simple-encoding';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import ScrollableSegmentedControl from '@stamhoofd/components/inputs/ScrollableSegmentedControl.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import Spinner from '@stamhoofd/components/Spinner.vue';
import { ExcelExportType } from '@stamhoofd/structures';
import { BalanceItemBreakdown, BreakdownAmountType, BreakdownTab } from '@stamhoofd/structures/PaymentBreakdown.js';
import { computed } from 'vue';
import { getBalanceItemPaymentSelectableWorkbook } from '../payments/getSelectableWorkbook';
import BreakdownGraphView from './BreakdownGraphView.vue';
import BreakdownList from './BreakdownList.vue';
import type { BreakdownViewProps } from './useBreakdownView';
import { useBreakdownView } from './useBreakdownView';

/**
 * What a selection of balance items adds up to, split over what they are for and which articles were
 * charged. Opening a row shows the same view for only that row.
 */
const props = withDefaults(
    defineProps<BreakdownViewProps>(), {
        search: null,
        rootTitle: null,
        path: () => [],
        pathNames: () => [],
        narrowFilter: null,
    },
);

const { breakdown, loading, exporting, errors, canExport, canExportWithoutBreakdown, amountMessage, startExport, openTable, tabs, tab, visibleGroups, hasClosedGroups, openGroup } = useBreakdownView<BalanceItemBreakdown>(props, {
    endpoint: '/balance-items/breakdown',
    decoder: BalanceItemBreakdown as Decoder<BalanceItemBreakdown>,
    exportType: ExcelExportType.BalanceItems,
    exportSortKey: 'createdAt',
    tableView: () => import('../balance-items/BalanceItemsTableView.vue'),
    isEmpty: breakdown => breakdown.balanceItemCount === 0,
    sliceExport: {
        type: ExcelExportType.BalanceItemPayments,
        sortKey: 'createdAt',
        getSelectableWorkbook: getBalanceItemPaymentSelectableWorkbook,
        configurationId: 'balance-item-payments',
    },
    partialListMessage: $t('%Zjs'),
    partialAmountMessage: {
        slice: $t('%Zj8'),
        whole: $t('%Zil'),
    },
    amountTypeMessages: {
        [BreakdownAmountType.Paid]: $t('%Zir'),
        [BreakdownAmountType.Pending]: $t('%Zid'),
        [BreakdownAmountType.Open]: $t('%Zjg'),
    },
    tabs: [
        { id: BreakdownTab.Category, name: $t('%M2') },
        { id: BreakdownTab.Article, name: $t('%Rv') },
        // Where the money stands: paid out, still on its way, or not paid at all. Without online
        // payments the server leaves this one empty, because then it only repeats what is above.
        { id: BreakdownTab.Settlement, name: $t('%M6') },
    ],
    getGroups: (breakdown, tab) => {
        switch (tab) {
            case BreakdownTab.Category: return breakdown.byCategory;
            case BreakdownTab.Article: return breakdown.byArticle;
            case BreakdownTab.Settlement: return breakdown.bySettlement;
            // A balance item isn't paid via one account: it can be paid by several payments
            case BreakdownTab.Account: return [];
        }
    },
    view: () => import('./BalanceItemBreakdownView.vue'),
});

/**
 * What the amount above is: what was charged, or the part of it this view was narrowed down to.
 */
const priceLabel = computed(() => {
    switch (breakdown.value?.selection.amountType) {
        case BreakdownAmountType.Paid: return $t('%ZjM');
        case BreakdownAmountType.Pending: return $t('%1OL');
        case BreakdownAmountType.Open: return $t('%1Ni');
        default: return $t('%BO');
    }
});

const tabLabels = computed(() => tabs.value.map(t => t.name));
</script>
