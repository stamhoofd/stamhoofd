<template>
    <SaveView :loading="exporting" :title="title" :save-text="$t('Exporteren')" save-icon="download" :cancel-text="$t('Sluiten')" :disabled="!canExport" @save="startExport">
        <template #buttons>
            <button v-if="breakdown" v-tooltip="$t('Toon de aanrekeningen')" class="button icon ul" type="button" data-testid="show-list-button" @click="openTable(breakdown.selection)" />
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
                        {{ priceLabel }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(breakdown.price) }}
                    </p>
                    <p class="style-description-small">
                        {{ pluralText(breakdown.balanceItemCount, $t('aanrekening'), $t('aanrekeningen')) }}
                    </p>
                </STListItem>

                <STListItem v-if="breakdown.pricePaid">
                    <h3 class="style-definition-label">
                        {{ $t('Betaald') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(breakdown.pricePaid) }}
                    </p>
                </STListItem>

                <STListItem v-if="breakdown.pricePending">
                    <h3 class="style-definition-label">
                        {{ $t('In verwerking') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatPrice(breakdown.pricePending) }}
                    </p>
                </STListItem>

                <STListItem v-if="breakdown.priceOpen">
                    <h3 class="style-definition-label">
                        {{ $t('Openstaand') }}
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
                {{ $t('Er zijn geen gegevens voor deze selectie.') }}
            </p>

            <BreakdownList v-else :groups="visibleGroups" :total="breakdown.price" count-unit="balanceItems" @select="openGroup" />

            <p v-if="hasClosedGroups" class="info-box">
                {{ $t('Rijen zonder pijl kan je niet openen: hun bedrag maakt deel uit van een groter geheel, zoals een webshopbestelling die als één geheel aangerekend wordt.') }}
            </p>
        </template>
    </SaveView>
</template>

<script lang="ts" setup>
import type { Decoder } from '@simonbackx/simple-encoding';
import { useShow } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import ScrollableSegmentedControl from '@stamhoofd/components/inputs/ScrollableSegmentedControl.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import Spinner from '@stamhoofd/components/Spinner.vue';
import type { BreakdownGroup } from '@stamhoofd/structures';
import { BalanceItemBreakdown, BreakdownAmountType, BreakdownTab, ExcelExportType } from '@stamhoofd/structures';
import type { Ref } from 'vue';
import { computed, shallowRef } from 'vue';
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
    },
);

const show = useShow();
const { breakdown, loading, exporting, errors, canExport, canExportWithoutBreakdown, amountMessage, startExport, getNarrowedProps, openTable, isTabVisible } = useBreakdownView<BalanceItemBreakdown>(props, {
    endpoint: '/balance-items/breakdown',
    decoder: BalanceItemBreakdown as Decoder<BalanceItemBreakdown>,
    exportType: ExcelExportType.BalanceItems,
    exportSortKey: 'createdAt',
    tableView: () => import('../balance-items/BalanceItemsTableView.vue'),
    isEmpty: breakdown => breakdown.balanceItemCount === 0,
    partialListMessage: $t('Deze aanrekeningen werden ook elders betaald. De lijst en de export bevatten de volledige aanrekeningen, het bedrag hierboven is enkel het deel dat hier meetelt.'),
    amountTypeMessages: {
        [BreakdownAmountType.Paid]: $t('Dit is wat er van deze aanrekeningen ontvangen werd, niet wat er aangerekend werd.'),
        [BreakdownAmountType.Pending]: $t('Dit is wat er van deze aanrekeningen onderweg is, niet wat er aangerekend werd.'),
        [BreakdownAmountType.Open]: $t('Dit is wat er van deze aanrekeningen openstaat, niet wat er aangerekend werd.'),
    },
});

/**
 * What the amount above is: what was charged, or the part of it this view was narrowed down to.
 */
const priceLabel = computed(() => {
    switch (breakdown.value?.selection.amountType) {
        case BreakdownAmountType.Paid: return $t('Ontvangen');
        case BreakdownAmountType.Pending: return $t('In verwerking');
        case BreakdownAmountType.Open: return $t('Openstaand');
        default: return $t('Aangerekend');
    }
});

function getGroups(id: BreakdownTab): BreakdownGroup[] {
    if (!breakdown.value) {
        return [];
    }

    switch (id) {
        case BreakdownTab.Settlement: return breakdown.value.bySettlement;
        case BreakdownTab.Article: return breakdown.value.byArticle;
        default: return breakdown.value.byCategory;
    }
}

const tabs = computed(() => [
    { id: BreakdownTab.Category, name: $t('Categorie') },
    { id: BreakdownTab.Article, name: $t('Artikels') },
    // Where the money stands: paid out, still on its way, or not paid at all. Without online payments
    // the server leaves this one empty, because then it only repeats what is above.
    { id: BreakdownTab.Settlement, name: $t('Betaalstatus') },
].filter(t => isTabVisible(t.id, getGroups(t.id))));

const tabLabels = computed(() => tabs.value.map(t => t.name));
const selectedTab = shallowRef(BreakdownTab.Category) as Ref<BreakdownTab>;

const tab = computed({
    get: () => tabs.value.find(t => t.id === selectedTab.value) ?? tabs.value[0],
    set: (value: { id: BreakdownTab; name: string }) => {
        selectedTab.value = value.id;
    },
});

const visibleGroups = computed(() => tab.value ? getGroups(tab.value.id) : []);
const hasClosedGroups = computed(() => visibleGroups.value.some(group => !group.canNarrowDown && group.selection === null));

/**
 * Opening a group breaks it down further. The articles of an order are the deepest level: there we
 * show what they are made of instead.
 */
async function openGroup(group: BreakdownGroup) {
    if (!group.canNarrowDown) {
        if (group.selection) {
            await openTable(group.selection);
        }
        return;
    }

    await show({
        components: [
            AsyncComponent(
                () => import('./BalanceItemBreakdownView.vue'),
                getNarrowedProps({ id: group.id, name: group.name.toString(), tab: tab.value.id }),
            ),
        ],
    });
}
</script>
