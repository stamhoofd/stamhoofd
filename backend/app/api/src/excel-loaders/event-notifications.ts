import { XlsxBuiltInNumberFormat, XlsxTransformerSheet } from '@stamhoofd/excel-writer';
import { EventNotification, EventNotificationStatus, EventNotificationStatusHelper, ExcelExportType, LimitedFilteredRequest, Platform as PlatformStruct } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { GetEventNotificationsEndpoint } from '../endpoints/global/events/GetEventNotificationsEndpoint.js';
import { ExportToExcelEndpoint } from '../endpoints/global/files/ExportToExcelEndpoint.js';
import { XlsxTransformerColumnHelper } from '../helpers/XlsxTransformerColumnHelper.js';

// Assign to a typed variable to assure we have correct type checking in place
const sheet: XlsxTransformerSheet<EventNotification, EventNotification> = {
    id: 'event-notifications',
    name: $t(`1eafb06a-5385-42fd-8f1a-2bbaaf735e53`),
    columns: [
        {
            id: 'id',
            name: $t(`29360811-3663-496c-8d8f-c9fdf9467a74`),
            width: 40,
            getValue: (notification: EventNotification) => ({
                value: notification.id,
            }),
        },
        {
            id: 'name',
            name: $t(`394aafa1-811b-4ed4-bfc6-c12ae59ff9b6`),
            width: 40,
            getValue: (notification: EventNotification) => ({
                value: notification.events.map(e => e.name).join(', '),
            }),
        },
        {
            id: 'organization.name',
            name: $t(`afd7843d-f355-445b-a158-ddacf469a5b1`),
            width: 40,
            getValue: (notification: EventNotification) => ({
                value: notification.organization.name,
            }),
        },
        {
            id: 'organization.uri',
            name: $t(`05723781-9357-41b2-9fb8-cb4f80dde7f9`),
            width: 30,
            getValue: (notification: EventNotification) => ({
                value: notification.organization.uri,
            }),
        },
        {
            id: 'status',
            name: $t(`6b4b9fb3-ca24-43cd-9f7b-a5f597b943d8`),
            width: 30,
            getValue: (notification: EventNotification) => ({
                value: Formatter.capitalizeFirstLetter(EventNotificationStatusHelper.getName(notification.status)),
            }),
        },
        {
            id: 'feedbackText',
            name: $t(`12b2ce84-6297-49a2-a9c4-d5619b764313`),
            width: 80,
            getValue: (notification: EventNotification) => ({
                value: notification.status !== EventNotificationStatus.Accepted ? notification.feedbackText : null,
                style: {
                    alignment: {
                        wrapText: true,
                    },
                },
            }),
        },
        {
            id: 'startDate',
            name: $t(`300d2935-b578-48cc-b58e-1c0446a68d59`),
            width: 20,
            getValue: (notification: EventNotification) => ({
                value: notification.startDate,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.DateSlash,
                    },
                },
            }),
        },
        {
            id: 'endDate',
            name: $t(`3c90169c-9776-4d40-bda0-dba27a5bad69`),
            width: 20,
            getValue: (notification: EventNotification) => ({
                value: notification.endDate,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.DateSlash,
                    },
                },
            }),
        },
        {
            id: 'submittedAt',
            name: $t(`16c87ee7-27b1-4b87-93e3-221d35038e6a`),
            width: 20,
            getValue: (notification: EventNotification) => ({
                value: notification.submittedAt,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.DateSlash,
                    },
                },
            }),
        },
        {
            id: 'submittedBy',
            name: $t(`aaa24b94-c733-40e1-9a25-76d1c65d3737`),
            width: 40,
            getValue: (notification: EventNotification) => ({
                value: notification.submittedBy?.name ?? '',
            }),
        },

        // Dynamic records
        XlsxTransformerColumnHelper.createRecordAnswersColumns({
            matchId: 'recordAnswers',
            getRecordAnswers: (notification: EventNotification) => notification.recordAnswers,
            getRecordCategories: () => {
                const platform = PlatformStruct.shared;
                return platform.config.eventNotificationTypes.flatMap(r => r.recordCategories);
            },
        }),
    ],
};

ExportToExcelEndpoint.loaders.set(ExcelExportType.EventNotifications, {
    fetch: async (query: LimitedFilteredRequest) => {
        return await GetEventNotificationsEndpoint.buildData(query);
    },
    sheets: [
        sheet,
    ],
});
