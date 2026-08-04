<template>
    <SaveView :loading="exporting" :title="title" :save-text="$t('%Oy')" save-icon="download" :cancel-text="$t('%9b')" :disabled="!canExport" @save="startExport">
        <template #buttons>
            <button v-if="breakdown" v-tooltip="$t('%Ziy')" class="button icon ul" type="button" data-testid="show-list-button" @click="openTable(breakdown.selection)" />
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
                        {{ $t('%xL') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(breakdown.price) }}
                    </p>
                    <p class="style-description-small">
                        {{ pluralText(breakdown.paymentCount, $t('%14a'), $t('%Zj2')) }}
                    </p>
                </STListItem>

                <STListItem v-if="breakdown.pricePending">
                    <h3 class="style-definition-label">
                        {{ $t('%1OL') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(breakdown.pricePending) }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('%Ziv') }}
                    </p>
                </STListItem>

                <STListItem v-if="breakdown.priceFailed">
                    <h3 class="style-definition-label">
                        {{ $t('%Zig') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(breakdown.priceFailed) }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('%ZjU') }}
                    </p>
                </STListItem>

                <STListItem v-if="breakdown.transferFee">
                    <h3 class="style-definition-label">
                        {{ $t('%wZ') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(breakdown.transferFee) }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('%ZiP') }}
                    </p>
                </STListItem>

                <STListItem v-if="breakdown.serviceFeeManual">
                    <h3 class="style-definition-label">
                        {{ $t('%1UX') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(breakdown.serviceFeeManual) }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('%Zif') }}
                    </p>
                </STListItem>

                <STListItem v-if="breakdown.serviceFeePayout">
                    <h3 class="style-definition-label">
                        {{ $t('%Zjl') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(breakdown.serviceFeePayout) }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('%Zim') }}
                    </p>
                </STListItem>
            </STList>

            <p v-if="breakdown.pricePending || breakdown.priceFailed" class="warning-box">
                {{ $t('%ZjL') }}
            </p>

            <p v-if="amountMessage" class="info-box">
                {{ amountMessage }}
            </p>

            <template v-if="breakdown.graph.points.length > 3">
                <hr>
                <BreakdownGraphView :graph="breakdown.graph" :title="$t('%xL')" />
            </template>

            <ScrollableSegmentedControl v-if="tabs.length > 1" v-model="tab" :items="tabs" :labels="tabLabels" />

            <p v-if="visibleGroups.length === 0" class="info-box">
                {{ $t('%ZiQ') }}
            </p>

            <BreakdownList v-else :groups="visibleGroups" :total="breakdown.price" count-unit="payments" @select="openGroup" />

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
import { BreakdownAmountType, BreakdownTab, PaymentBreakdown } from '@stamhoofd/structures/PaymentBreakdown.js';
import { computed } from 'vue';
import { getBalanceItemPaymentSelectableWorkbook } from '../payments/getSelectableWorkbook';
import BreakdownGraphView from './BreakdownGraphView.vue';
import BreakdownList from './BreakdownList.vue';
import type { BreakdownViewProps } from './useBreakdownView';
import { useBreakdownView } from './useBreakdownView';

/**
 * What a selection of payments adds up to, split over where the money arrived, what it was for and
 * which articles were paid. Opening a row shows the same view for only that row, so you can keep
 * narrowing down before exporting.
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

const { breakdown, loading, exporting, errors, canExport, canExportWithoutBreakdown, amountMessage, startExport, openTable, tabs, tab, visibleGroups, hasClosedGroups, openGroup } = useBreakdownView<PaymentBreakdown>(props, {
    endpoint: '/payments/breakdown',
    decoder: PaymentBreakdown as Decoder<PaymentBreakdown>,
    exportType: ExcelExportType.Payments,
    exportSortKey: 'paidAt',
    tableView: () => import('../payments/PaymentsTableView.vue'),
    isEmpty: breakdown => breakdown.paymentCount === 0,
    sliceExport: {
        type: ExcelExportType.BalanceItemPayments,
        sortKey: 'createdAt',
        getSelectableWorkbook: getBalanceItemPaymentSelectableWorkbook,
        configurationId: 'balance-item-payments',
    },
    partialListMessage: $t('%Zij'),
    partialAmountMessage: {
        slice: $t('%Zjt'),
        whole: $t('%ZjD'),
    },
    amountTypeMessages: {
        [BreakdownAmountType.Rounding]: $t('%Zj1'),
    },
    tabs: [
        // Not 'received via': a selection can hold payments that never arrived
        { id: BreakdownTab.Account, name: $t('%Zji') },
        // Without online payments there is nothing to pay out, so the server leaves this one empty
        { id: BreakdownTab.Settlement, name: $t('%Zj6') },
        { id: BreakdownTab.Category, name: $t('%M2') },
        { id: BreakdownTab.Article, name: $t('%Rv') },
    ],
    getGroups: (breakdown, tab) => {
        switch (tab) {
            case BreakdownTab.Account: return breakdown.byAccount;
            case BreakdownTab.Category: return breakdown.byCategory;
            case BreakdownTab.Article: return breakdown.byArticle;
            case BreakdownTab.Settlement: return breakdown.bySettlement;
        }
    },
    view: () => import('./PaymentBreakdownView.vue'),
});

const tabLabels = computed(() => tabs.value.map(t => t.name));
</script>
