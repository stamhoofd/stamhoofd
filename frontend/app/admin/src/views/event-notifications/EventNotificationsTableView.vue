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
        :estimated-rows="estimatedRows"
        :Route="Route"
        :default-filter="defaultFilter"
    >
        <template #empty>
            {{ $t('%39') }}
        </template>
    </ModernTableView>
</template>

<script lang="ts" setup>
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import EmailView from '@stamhoofd/components/email/EmailView.vue';
import { EventNotificationViewModel } from '@stamhoofd/components/event-notifications/classes/EventNotificationViewModel.ts';
import EventNotificationView from '@stamhoofd/components/event-notifications/EventNotificationView.vue';
import { useEventNotificationsObjectFetcher } from '@stamhoofd/components/fetchers/useEventNotificationsObjectFetcher.ts';
import { useEventNotificationBackendFilterBuilders } from '@stamhoofd/components/filters/filterBuilders.ts';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform.ts';
import { Column } from '@stamhoofd/components/tables/classes/Column.ts';
import type { TableAction, TableActionSelection } from '@stamhoofd/components/tables/classes/TableAction.ts';
import { AsyncTableAction } from '@stamhoofd/components/tables/classes/TableAction.ts';
import { useTableObjectFetcher } from '@stamhoofd/components/tables/classes/TableObjectFetcher.ts';
import ModernTableView from '@stamhoofd/components/tables/ModernTableView.vue';
import type { ComponentExposed } from '@stamhoofd/components/VueGlobalHelper.ts';
import { ExcelExportView } from '@stamhoofd/frontend-excel-export';
import type { EventNotification, EventNotificationType, StamhoofdFilter } from '@stamhoofd/structures';
import { EventNotificationStatus, EventNotificationStatusHelper, ExcelExportType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import type { Ref} from 'vue';
import { computed, ref } from 'vue';
import { getSelectableWorkbook } from './getSelectableWorkbook';

type ObjectType = EventNotification;

const props = withDefaults(
    defineProps<{
        type?: EventNotificationType | null;
    }>(),
    {
        type: null,
    },
);

const title = computed(() => {
    if (props.type) {
        return props.type.title;
    }
    return $t('%AX');
});

const estimatedRows = computed(() => {
    return 30;
});

const present = usePresent();
const platform = usePlatform();
const getFilterBuilders = useEventNotificationBackendFilterBuilders();

const modernTableView = ref(null) as Ref<null | ComponentExposed<typeof ModernTableView>>;
const configurationId = computed(() => {
    return 'event-notifications';
});
const filterBuilders = computed(() => getFilterBuilders());

function getRequiredFilter(): StamhoofdFilter | null {
    if (props.type) {
        return {
            typeId: props.type.id,
        };
    }

    return null;
}

const defaultFilter = {
    $not: {
        status: {
            $in: [EventNotificationStatus.Draft, EventNotificationStatus.Accepted],
        },
    },
};

const objectFetcher = useEventNotificationsObjectFetcher({
    requiredFilter: getRequiredFilter(),
});

const tableObjectFetcher = useTableObjectFetcher<EventNotification>(objectFetcher);

const allColumns: Column<ObjectType, any>[] = [
    new Column<ObjectType, Date | null>({
        id: 'submittedAt',
        name: $t('%Aw'),
        getValue: e => e.submittedAt,
        format: d => d ? Formatter.date(d, true) : $t('%1Io'),
        minimumWidth: 60,
        recommendedWidth: 100,
        index: 0,
    }),

    new Column<ObjectType, Date>({
        id: 'startDate',
        name: $t('%1Of'),
        getValue: e => e.startDate,
        format: d => Formatter.date(d, true),
        minimumWidth: 60,
        recommendedWidth: 100,
        index: 0,
    }),

    new Column<ObjectType, Date>({
        id: 'endDate',
        name: $t('%1P8'),
        getValue: e => e.endDate,
        format: d => Formatter.date(d, true),
        minimumWidth: 60,
        recommendedWidth: 100,
        index: 0,
    }),

    new Column<ObjectType, string>({
        id: 'event.name',
        name: $t('%w9'),
        getValue: e => e.events.map(e => e.name).join(', '),
        minimumWidth: 200,
        recommendedWidth: 100,
        index: 0,
        allowSorting: false,
        grow: true,
    }),

    new Column<ObjectType, EventNotificationStatus>({
        id: 'status',
        name: $t('%1A'),
        getValue: organization => organization.status,
        format: status => Formatter.capitalizeFirstLetter(EventNotificationStatusHelper.getName(status)),
        getStyle: (status) => {
            if (status === EventNotificationStatus.Draft) {
                return 'gray';
            }
            if (status === EventNotificationStatus.Accepted) {
                return 'success';
            }
            if (status === EventNotificationStatus.Rejected) {
                return 'error';
            }
            return '';
        },
        minimumWidth: 100,
        recommendedWidth: 200,
        allowSorting: true,
    }),

    new Column<ObjectType, string>({
        id: 'organization.name',
        name: $t('%1PI'),
        getValue: notification => notification.organization.name,
        minimumWidth: 100,
        recommendedWidth: 200,
    }),

    new Column<ObjectType, string>({
        id: 'organization.uriPadded',
        name: $t('%1O1'),
        getValue: notification => notification.organization.uri,
        minimumWidth: 100,
        recommendedWidth: 200,
    }),
];

const Route = {
    Component: EventNotificationView,
    objectKey: 'event-notification',
    getProperties: (object: ObjectType) => {
        return {
            viewModel: EventNotificationViewModel.edit({
                eventNotification: object,
                platform: platform.value,
            }),
        };
    },
};

const actions: TableAction<EventNotification>[] = [];

async function openMail(selection: TableActionSelection<EventNotification>) {
    if ((true as any)) {
        throw new SimpleError({
            code: 'not_implemented',
            message: 'Not implemented',
            human: $t(`%Ga`),
        });
    }

    const displayedComponent = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(EmailView, {
            recipientFilterOptions: [],
        }),
    });
    await present({
        components: [
            displayedComponent,
        ],
        modalDisplayStyle: 'popup',
    });
}

async function exportToExcel(selection: TableActionSelection<ObjectType>) {
    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(ExcelExportView, {
                    type: ExcelExportType.EventNotifications,
                    filter: selection.filter,
                    workbook: getSelectableWorkbook(platform.value),
                    configurationId: configurationId.value,
                }),
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

actions.push(new AsyncTableAction({
    name: $t(`%Gb`),
    icon: 'email',
    priority: 12,
    groupIndex: 3,
    handler: async (selection: TableActionSelection<EventNotification>) => {
        await openMail(selection);
    },
}));

actions.push(
    new AsyncTableAction({
        name: $t(`%Gc`),
        icon: 'download',
        priority: 11,
        groupIndex: 3,
        handler: async (selection) => {
            await exportToExcel(selection);
        },
    }),
);
</script>
