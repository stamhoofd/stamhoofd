<template>
    <SaveView :loading="exporting" :title="title" :save-text="$t('Exporteren')" save-icon="download" :cancel-text="$t('Sluiten')" :disabled="!canExport" @save="startExport">
        <template #buttons>
            <button v-if="breakdown" v-tooltip="$t('Toon de betalingen')" class="button icon ul" type="button" data-testid="show-list-button" @click="openTable(breakdown.selection)" />
        </template>

        <h1 class="style-navigation-title">
            {{ title }} <span v-if="breakdown" class="title-suffix">{{ formatPrice(breakdown.price) }}</span>
        </h1>

        <p v-if="pathNames.length > 1" class="style-description-block">
            {{ pathNames.join(' · ') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <p v-if="canExportWithoutBreakdown" class="warning-box">
            {{ $t('We konden geen statistieken maken van deze selectie, maar je kan ze wel nog exporteren naar Excel.') }}
        </p>

        <template v-if="loading">
            <Spinner class="center" />

            <p class="style-description-small center">
                {{ $t('Dit kan even duren bij een grote selectie.') }}
            </p>
        </template>

        <template v-else-if="breakdown">
            <STList class="info">
                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('Totaal') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(breakdown.price) }}
                    </p>
                    <p class="style-description-small">
                        {{ pluralText(breakdown.paymentCount, $t('betaling'), $t('betalingen')) }}
                    </p>
                </STListItem>

                <STListItem v-if="breakdown.pricePending">
                    <h3 class="style-definition-label">
                        {{ $t('In verwerking') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(breakdown.pricePending) }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('Deze betalingen zijn nog niet afgerond, dus er werd nog niets ontvangen.') }}
                    </p>
                </STListItem>

                <STListItem v-if="breakdown.priceFailed">
                    <h3 class="style-definition-label">
                        {{ $t('Mislukte betalingen') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(breakdown.priceFailed) }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('Er werd geprobeerd te betalen, maar dat is niet gelukt.') }}
                    </p>
                </STListItem>

                <STListItem v-if="breakdown.transferFee">
                    <h3 class="style-definition-label">
                        {{ $t('Transactiekosten') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(breakdown.transferFee) }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('Ingehouden door de betaalprovider.') }}
                    </p>
                </STListItem>

                <STListItem v-if="breakdown.serviceFeeManual">
                    <h3 class="style-definition-label">
                        {{ $t('Servicekosten') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(breakdown.serviceFeeManual) }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('Dit bedrag wordt maandelijks aangerekend via jouw gekoppelde bankkaart.') }}
                    </p>
                </STListItem>

                <STListItem v-if="breakdown.serviceFeePayout">
                    <h3 class="style-definition-label">
                        {{ $t('Servicekosten via Stripe') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(breakdown.serviceFeePayout) }}
                    </p>
                    <p class="style-description-small">
                        {{ $t('Dit bedrag wordt automatisch ingehouden van je uitbetalingen.') }}
                    </p>
                </STListItem>
            </STList>

            <p v-if="breakdown.pricePending || breakdown.priceFailed" class="warning-box">
                {{ $t('Deze selectie bevat betalingen die (nog) niet ontvangen werden, dus het totaal hierboven is niet wat er op je rekening kwam.') }}
            </p>

            <p v-if="amountMessage" class="info-box">
                {{ amountMessage }}
            </p>

            <template v-if="breakdown.graph.points.length > 3">
                <hr>
                <BreakdownGraphView :graph="breakdown.graph" :title="$t('Totaal')" />
            </template>

            <ScrollableSegmentedControl v-if="tabs.length > 1" v-model="tab" :items="tabs" :labels="tabLabels" />

            <p v-if="visibleGroups.length === 0" class="info-box">
                {{ $t('Er zijn geen gegevens voor deze selectie.') }}
            </p>

            <BreakdownList v-else :groups="visibleGroups" :total="breakdown.price" count-unit="payments" @select="openGroup" />

            <p v-if="hasClosedGroups" class="info-box">
                {{ $t('Rijen zonder pijl kan je niet openen: hun bedrag maakt deel uit van een groter geheel, zoals een webshopbestelling die als één geheel aangerekend wordt.') }}
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
import { BreakdownAmountType, BreakdownTab, ExcelExportType, PaymentBreakdown } from '@stamhoofd/structures';
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
    partialListMessage: $t('Deze betalingen hebben ook voor andere dingen betaald. De lijst bevat de volledige betalingen, het bedrag waarmee je ze opende is enkel het deel dat daar meetelde.'),
    partialAmountMessage: {
        slice: $t('Deze betalingen hebben ook voor andere dingen betaald. Het bedrag hierboven en de export bevatten enkel het deel dat hier meetelt.'),
        whole: $t('Deze betalingen hebben ook voor andere dingen betaald. De lijst en de export bevatten de volledige betalingen, het bedrag hierboven is enkel het deel dat hier meetelt.'),
    },
    amountTypeMessages: {
        [BreakdownAmountType.Rounding]: $t('Dit is wat deze betalingen afgerond hebben, niet wat ermee betaald werd.'),
    },
    tabs: [
        // Not 'received via': a selection can hold payments that never arrived
        { id: BreakdownTab.Account, name: $t('Betaalwijze') },
        // Without online payments there is nothing to pay out, so the server leaves this one empty
        { id: BreakdownTab.Settlement, name: $t('Uitbetalingen') },
        { id: BreakdownTab.Category, name: $t('Categorie') },
        { id: BreakdownTab.Article, name: $t('Artikels') },
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
