<template>
    <ModernTableView
        :table-object-fetcher="tableObjectFetcher"
        :filter-builders="filterBuilders"
        :default-sort-column="allColumns.find(c => c.id === 'createdAt')"
        :default-sort-direction="SortItemDirection.DESC"
        :title="$t('Kortingscodes')"
        :column-configuration-id="configurationId"
        :actions="actions"
        :all-columns="allColumns"
        :prefix-column="allColumns[0]"
        @click="openDiscountCode"
    >
        <template #empty>
            {{ $t('Er zijn nog geen kortingscodes.') }}
        </template>
    </ModernTableView>
</template>

<script lang="ts" setup>
import { useDiscountCodesObjectFetcher } from '@stamhoofd/components/fetchers/useDiscountCodesObjectFetcher.ts';
import { getDiscountCodesUIFilterBuilders } from '@stamhoofd/components/filters/filterBuilders.ts';
import type { UIFilterBuilders } from '@stamhoofd/components/filters/UIFilter.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import ModernTableView from '@stamhoofd/components/tables/ModernTableView.vue';
import { Column } from '@stamhoofd/components/tables/classes/Column.ts';
import { useTableObjectFetcher } from '@stamhoofd/components/tables/classes/TableObjectFetcher.ts';
import { useNavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import type { DiscountCode, PrivateWebshop } from '@stamhoofd/structures';
import { SortItemDirection } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { computed } from 'vue';
import { DiscountCodeActionBuilder } from './DiscountCodeActionBuilder';

const props = defineProps<{
    webshop: PrivateWebshop;
}>();

type ObjectType = DiscountCode;

const context = useContext();
const navigationActions = useNavigationActions();
const configurationId = 'webshop-discount-codes-' + props.webshop.id;
const objectFetcher = useDiscountCodesObjectFetcher(props.webshop.id);
const tableObjectFetcher = useTableObjectFetcher<ObjectType>(objectFetcher);
const filterBuilders: UIFilterBuilders = getDiscountCodesUIFilterBuilders();

function refreshTable(discountCodes: DiscountCode[] = []) {
    for (const discountCode of discountCodes) {
        tableObjectFetcher.cacheBeforeReset(discountCode);
    }
    tableObjectFetcher.reset(true, true);
}

const actionBuilder = computed(() => new DiscountCodeActionBuilder({
    $context: context.value,
    webshop: props.webshop,
    navigationActions,
    afterPatch: refreshTable,
}));

const actions = computed(() => actionBuilder.value.getActions());

function openDiscountCode(discountCode: DiscountCode) {
    actionBuilder.value.editDiscountCode(discountCode);
}

const allColumns: Column<ObjectType, any>[] = [
    new Column<ObjectType, string>({
        id: 'code',
        name: $t('Code'),
        getValue: object => object.code,
        compare: (a, b) => Sorter.byStringValue(a, b),
        getStyle: () => 'code',
        minimumWidth: 120,
        recommendedWidth: 190,
        grow: false,
    }),
    new Column<ObjectType, string | null>({
        id: 'email',
        name: $t('E-mailadres'),
        getValue: object => object.email,
        format: value => value || $t('Geen e-mailadres'),
        compare: (a, b) => Sorter.byStringValue(a ?? '', b ?? ''),
        getStyle: value => value ? '' : 'gray',
        minimumWidth: 160,
        recommendedWidth: 260,
        grow: true,
    }),
    new Column<ObjectType, string>({
        id: 'description',
        name: $t('%6o'),
        getValue: object => object.description,
        format: value => value || $t('%Gr'),
        compare: (a, b) => Sorter.byStringValue(a, b),
        getStyle: value => value ? '' : 'gray',
        minimumWidth: 150,
        recommendedWidth: 300,
        allowSorting: false,
    }),
    new Column<ObjectType, number>({
        id: 'usageCount',
        name: $t('Gebruikt'),
        getValue: object => object.usageCount,
        format: value => Formatter.integer(value),
        compare: (a, b) => Sorter.byNumberValue(a, b),
        minimumWidth: 90,
        recommendedWidth: 110,
    }),
    new Column<ObjectType, number | null>({
        id: 'maximumUsage',
        name: $t('Maximum'),
        getValue: object => object.maximumUsage,
        format: value => value === null ? $t('Onbeperkt') : Formatter.integer(value),
        compare: (a, b) => Sorter.byNumberValue(a ?? Number.MAX_SAFE_INTEGER, b ?? Number.MAX_SAFE_INTEGER),
        getStyle: value => value === null ? 'gray' : '',
        minimumWidth: 100,
        recommendedWidth: 120,
        allowSorting: false,
        enabled: false,
    }),
    new Column<ObjectType, Date>({
        id: 'createdAt',
        name: $t('%1Jc'),
        getValue: object => object.createdAt,
        format: date => Formatter.date(date, true),
        minimumWidth: 120,
        recommendedWidth: 140,
    }),
];
</script>
