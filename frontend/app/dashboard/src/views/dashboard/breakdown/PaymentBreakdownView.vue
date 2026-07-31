<template>
    <SaveView :loading="exporting" :title="title" :save-text="$t('Exporteren')" save-icon="download" :cancel-text="$t('Sluiten')" :disabled="!breakdown" @save="startExport">
        <template #buttons>
            <button v-if="breakdown" v-tooltip="$t('Toon de betalingen')" class="button icon ul" type="button" data-testid="show-list-button" @click="openTable(breakdown.exportFilter)" />
        </template>

        <h1 class="style-navigation-title">
            {{ title }} <span v-if="breakdown" class="title-suffix">{{ formatPrice(breakdown.price) }}</span>
        </h1>

        <p v-if="pathNames.length > 1" class="style-description-block">
            {{ pathNames.join(' · ') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <Spinner v-if="loading" class="center" />

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

            <p v-if="breakdown.isPartial" class="info-box">
                {{ $t('De bedragen hierboven horen bij volledige betalingen: ze kunnen niet opgesplitst worden over de onderdelen waarvoor betaald werd.') }}
            </p>

            <template v-if="breakdown.graph.points.length > 3">
                <hr>
                <BreakdownGraphView :graph="breakdown.graph" :title="$t('Totaal')" />
            </template>

            <ScrollableSegmentedControl v-if="tabs.length > 1" v-model="tab" :items="tabs" :labels="tabLabels" />

            <p v-if="visibleGroups.length === 0" class="info-box">
                {{ $t('Er zijn geen gegevens voor deze selectie.') }}
            </p>

            <BreakdownList v-else :groups="visibleGroups" :total="breakdown.price" @select="openGroup" />
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
import { BreakdownTab, ExcelExportType, PaymentBreakdown } from '@stamhoofd/structures';
import type { Ref } from 'vue';
import { computed, shallowRef } from 'vue';
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
        path: () => [],
        pathNames: () => [],
    },
);

const show = useShow();
const { breakdown, loading, exporting, errors, startExport, getNarrowedProps, openTable, isTabVisible } = useBreakdownView<PaymentBreakdown>(props, {
    endpoint: '/payments/breakdown',
    decoder: PaymentBreakdown as Decoder<PaymentBreakdown>,
    exportType: ExcelExportType.Payments,
    exportSortKey: 'paidAt',
    tableView: () => import('../payments/PaymentsTableView.vue'),
});

function getGroups(id: BreakdownTab): BreakdownGroup[] {
    if (!breakdown.value) {
        return [];
    }

    switch (id) {
        case BreakdownTab.Account: return breakdown.value.byAccount;
        case BreakdownTab.Category: return breakdown.value.byCategory;
        case BreakdownTab.Article: return breakdown.value.byArticle;
        case BreakdownTab.Settlement: return breakdown.value.bySettlement;
    }
}

const tabs = computed(() => [
    { id: BreakdownTab.Account, name: $t('Ontvangen via') },
    { id: BreakdownTab.Category, name: $t('Categorie') },
    { id: BreakdownTab.Article, name: $t('Artikels') },
    // Without online payments there is nothing to pay out, so the server leaves this one empty
    { id: BreakdownTab.Settlement, name: $t('Uitbetalingen') },
].filter(t => isTabVisible(t.id, getGroups(t.id))));

const tabLabels = computed(() => tabs.value.map(t => t.name));
const selectedTab = shallowRef(BreakdownTab.Account) as Ref<BreakdownTab>;

const tab = computed({
    get: () => tabs.value.find(t => t.id === selectedTab.value) ?? tabs.value[0],
    set: (value: { id: BreakdownTab; name: string }) => {
        selectedTab.value = value.id;
    },
});

const visibleGroups = computed(() => tab.value ? getGroups(tab.value.id) : []);

/**
 * Opening a group breaks it down further. The articles of an order are the deepest level: there we
 * show what they are made of instead.
 */
async function openGroup(group: BreakdownGroup) {
    if (!group.canNarrowDown) {
        if (group.filter) {
            await openTable(group.filter);
        }
        return;
    }

    await show({
        components: [
            AsyncComponent(
                () => import('./PaymentBreakdownView.vue'),
                getNarrowedProps({ id: group.id, name: group.name.toString(), tab: tab.value.id }),
            ),
        ],
    });
}
</script>
