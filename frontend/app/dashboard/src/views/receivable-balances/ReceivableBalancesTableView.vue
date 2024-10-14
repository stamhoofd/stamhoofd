<template>
    <ModernTableView
        ref="modernTableView"
        :table-object-fetcher="tableObjectFetcher"
        :filter-builders="filterBuilders"
        :title="title"
        :column-configuration-id="configurationId"
        :actions="actions"
        :all-columns="allColumns"
        :prefix-column="allColumns[0]"
        @click="showBalance"
    >
        <template #empty>
            {{ $t('Er zijn geen openstaande bedragen') }}
        </template>
    </ModernTableView>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { cachedOutstandingBalanceUIFilterBuilders, Column, ComponentExposed, ModernTableView, TableAction, useReceivableBalancesObjectFetcher, useTableObjectFetcher } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { ReceivableBalance, getReceivableBalanceTypeName, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, Ref, ref } from 'vue';
import ReceivableBalanceView from './ReceivableBalanceView.vue';

type ObjectType = ReceivableBalance;
const $t = useTranslate();
const present = usePresent();

const title = computed(() => {
    return $t('Te ontvangen bedragen');
});

const modernTableView = ref(null) as Ref<null | ComponentExposed<typeof ModernTableView>>;
const configurationId = computed(() => {
    return 'receivable-balances';
});
const filterBuilders = cachedOutstandingBalanceUIFilterBuilders;

function getRequiredFilter(): StamhoofdFilter | null {
    return null;
}

const objectFetcher = useReceivableBalancesObjectFetcher({
    requiredFilter: getRequiredFilter(),
});

const tableObjectFetcher = useTableObjectFetcher<ObjectType>(objectFetcher);

const allColumns: Column<ObjectType, any>[] = [
    new Column<ObjectType, string>({
        id: 'id',
        name: 'ID',
        getValue: object => object.id.substring(0, 8),
        getStyle: () => 'code',
        minimumWidth: 50,
        recommendedWidth: 50,
    }),

    new Column<ObjectType, string>({
        id: 'objectType',
        name: 'Type',
        getValue: object => Formatter.capitalizeFirstLetter(getReceivableBalanceTypeName(object.objectType, $t)),
        minimumWidth: 100,
        recommendedWidth: 200,
        allowSorting: false,
    }),

    new Column<ObjectType, string>({
        id: 'name',
        name: 'Naam',
        getValue: object => object.object.name,
        minimumWidth: 100,
        recommendedWidth: 200,
        allowSorting: false,
    }),

    new Column<ObjectType, number>({
        id: 'amount',
        name: 'Bedrag',
        getValue: object => object.amount,
        format: value => Formatter.price(value),
        getStyle: value => value === 0 ? 'gray' : '',
        minimumWidth: 100,
        recommendedWidth: 200,
        allowSorting: true,
    }),

    new Column<ObjectType, number>({
        id: 'amountPending',
        name: 'In verwerking',
        getValue: object => object.amountPending,
        format: value => Formatter.price(value),
        getStyle: value => value === 0 ? 'gray' : '',
        minimumWidth: 100,
        recommendedWidth: 200,
        allowSorting: true,
    }),

    new Column<ObjectType, number>({
        id: 'amountOpen',
        name: 'Openstaand bedrag',
        getValue: object => object.amount - object.amountPending,
        format: value => Formatter.price(value),
        getStyle: value => value === 0 ? 'gray' : '',
        minimumWidth: 100,
        recommendedWidth: 200,
        allowSorting: false,
    }),

];

const actions: TableAction<ObjectType>[] = [];

async function showBalance(item: ReceivableBalance) {
    if (!modernTableView.value) {
        return;
    }

    // todo
    const table = modernTableView.value;
    const component = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(ReceivableBalanceView, {
            item,
            getNext: table.getNext,
            getPrevious: table.getPrevious,
        }),
    });

    await present({
        components: [component],
        modalDisplayStyle: 'popup',
    });
}

</script>
