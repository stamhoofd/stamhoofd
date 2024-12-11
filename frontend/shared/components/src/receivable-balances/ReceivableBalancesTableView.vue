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
            {{ $t('0637e394-fbd7-42ea-9a1b-5acdcc86419a') }}
        </template>
    </ModernTableView>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncTableAction, cachedOutstandingBalanceUIFilterBuilders, Column, ComponentExposed, EmailView, GlobalEventBus, ModernTableView, RecipientMultipleChoiceOption, TableAction, TableActionSelection, usePlatform, useReceivableBalancesObjectFetcher, useTableObjectFetcher } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { EmailRecipientFilterType, EmailRecipientSubfilter, getReceivableBalanceTypeName, isEmptyFilter, ReceivableBalance, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, Ref, ref } from 'vue';
import ReceivableBalanceView from './ReceivableBalanceView.vue';
import { useRequestOwner } from '@stamhoofd/networking';

type ObjectType = ReceivableBalance;
const $t = useTranslate();
const present = usePresent();
const owner = useRequestOwner();
const platform = usePlatform();

const title = computed(() => {
    return $t('e09c97db-85d7-40b0-8043-65fa24a09a01');
});

const modernTableView = ref(null) as Ref<null | ComponentExposed<typeof ModernTableView>>;
const configurationId = computed(() => {
    return 'receivable-balances';
});
const filterBuilders = cachedOutstandingBalanceUIFilterBuilders;

function getRequiredFilter(): StamhoofdFilter | null {
    return {
        objectType: 'organization',
    };
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

async function openMail(selection: TableActionSelection<ObjectType>) {
    const filter = selection.filter.filter;
    const search = selection.filter.search;

    const option: RecipientMultipleChoiceOption = {
        type: 'MultipleChoice',
        options: [],
        build: (selectedIds: string[]) => {
            const q = EmailRecipientSubfilter.create({
                type: EmailRecipientFilterType.ReceivableBalances,
                filter,
                search,
                subfilter: {
                    meta: {
                        responsibilityIds: {
                            $in: selectedIds,
                        },
                    },
                },
            });

            return [
                q,
            ];
        },
    };

    for (const responsibility of platform.value.config.responsibilities) {
        if (!responsibility.organizationBased) {
            continue;
        }
        option.options.push(
            {
                id: responsibility.id,
                name: responsibility.name,
            },
        );
    }

    const displayedComponent = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(EmailView, {
            recipientFilterOptions: [option],
        }),
    });
    await present({
        components: [
            displayedComponent,
        ],
        modalDisplayStyle: 'popup',
    });
}

actions.push(new AsyncTableAction({
    name: 'E-mailen',
    icon: 'email',
    priority: 12,
    groupIndex: 3,
    handler: async (selection: TableActionSelection<ObjectType>) => {
        await openMail(selection);
    },
}));

// Listen for patches in payments
GlobalEventBus.addListener(owner, 'paymentPatch', () => {
    tableObjectFetcher.reset(false, false);
    return Promise.resolve();
});

GlobalEventBus.addListener(owner, 'balanceItemPatch', () => {
    tableObjectFetcher.reset(false, false);
    return Promise.resolve();
});

</script>
