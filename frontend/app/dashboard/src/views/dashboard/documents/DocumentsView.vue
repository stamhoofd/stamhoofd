<template>
    <ModernTableView
        :table-object-fetcher="tableObjectFetcher"
        :filter-builders="filterBuilders"
        :title="title"
        :column-configuration-id="configurationId"
        :default-filter="defaultFilter"
        :actions="actions"
        :all-columns="allColumns"
        :prefix-column="allColumns[0]"
        :route
        :default-sort-column="allColumns.find(c => c.id === 'createdAt')"
        :default-sort-direction="SortItemDirection.DESC"
    >
        <template #empty>
            {{ $t('%7n') }}
        </template>
    </ModernTableView>
</template>

<script lang="ts" setup>
import { getDocumentsUIFilterBuilders } from '@stamhoofd/components/filters/filterBuilders.ts';
import type { UIFilterBuilders } from '@stamhoofd/components/filters/UIFilter.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { Column } from '@stamhoofd/components/tables/classes/Column.ts';
import { useTableObjectFetcher } from '@stamhoofd/components/tables/classes/TableObjectFetcher.ts';
import ModernTableView from '@stamhoofd/components/tables/ModernTableView.vue';
import { useNavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import type { Document, DocumentTemplatePrivate, RecordWarning, StamhoofdFilter } from '@stamhoofd/structures';
import { DocumentStatus, DocumentStatusHelper, RecordWarningType, SortItemDirection } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';

import { useDocumentsObjectFetcher } from '@stamhoofd/components/fetchers/useDocumentsObjectFetcher.ts';
import { useFeatureFlagComputed } from '@stamhoofd/components/hooks/useFeatureFlag.ts';
import { BelcotaxFeatureFlag } from '@stamhoofd/structures/belcotax/BelcotaxConnection.js';
import type { BelcotaxDocumentStatus } from '@stamhoofd/structures/belcotax/BelcotaxSubmission.js';
import { BelcotaxDocumentStatusHelper } from '@stamhoofd/structures/belcotax/BelcotaxSubmission.js';
import { computed } from 'vue';
import { DocumentActionBuilder } from './DocumentActionBuilder';
import { getBelcotaxKey, hasDocumentNumbers } from './hasDocumentNumbers';

const props = defineProps<{
    template: DocumentTemplatePrivate;
}>();

const title = $t('%tw');
const configurationId = 'documents';

const objectFetcher = useDocumentsObjectFetcher({
    requiredFilter: {
        templateId: props.template.id,
    },
});

const tableObjectFetcher = useTableObjectFetcher<Document>(objectFetcher);

const belcotaxFeature = useFeatureFlagComputed(BelcotaxFeatureFlag);
// The documents of a fiscal template from 2026 can be sent to the Belcotax API
const showBelcotax = belcotaxFeature.value && !hasDocumentNumbers(props.template);
const filterBuilders: UIFilterBuilders = getDocumentsUIFilterBuilders({ belcotax: showBelcotax });

// A removed document is kept for its deletion in Belcotax, it is no longer a document of the organization
const defaultFilter: StamhoofdFilter = {
    status: {
        $in: Object.values(DocumentStatus).filter(status => status !== DocumentStatus.Deleted),
    },
};

const numberColumn = new Column<Document, number | null>({
    id: 'number',
    name: $t('%cH'),
    getValue: v => v.number,
    compare: (a, b) => Sorter.byNumberValue(b ?? 0, a ?? 0),
    format: n => n ? n.toString() : $t('%1SV'),
    getStyle: (status) => {
        if (status === null) {
            return 'gray';
        }
        return '';
    },
    minimumWidth: 100,
    recommendedWidth: 200,
    grow: false,
    enabled: false,
});

const allColumns: Column<Document, any>[] = [
    new Column<Document, string>({
        id: 'id',
        enabled: false,
        name: hasDocumentNumbers(props.template) ? $t('%Kq') : $t('Sleutel voor Belcotax'),
        getValue: v => hasDocumentNumbers(props.template) ? v.id : getBelcotaxKey(props.template, v),
        compare: (a, b) => Sorter.byStringValue(a, b),
        minimumWidth: 100,
        recommendedWidth: 370,
        grow: false,
    }),

    ...(hasDocumentNumbers(props.template) ? [numberColumn] : []),

    new Column<Document, string>({
        id: 'description',
        name: $t('%6o'),
        getValue: v => v.data.description,
        compare: (a, b) => Sorter.byStringValue(a, b),
        minimumWidth: 100,
        recommendedWidth: 320,
        grow: true,
    }),

    new Column<Document, DocumentStatus>({
        id: 'status',
        name: $t('%1JM'),
        getValue: document => document.status,
        format: status => DocumentStatusHelper.getName(status),
        compare: (a, b) => Sorter.byEnumValue(a, b, DocumentStatus),
        getStyle: (status) => {
            return DocumentStatusHelper.getColor(status);
        },
        minimumWidth: 100,
        recommendedWidth: 120,
    }),

    ...(showBelcotax
        ? [new Column<Document, BelcotaxDocumentStatus | null>({
                id: 'belcotaxStatus',
                name: $t('Belcotax'),
                allowSorting: false,
                getValue: document => document.belcotaxStatus,
                format: status => BelcotaxDocumentStatusHelper.getName(status),
                getStyle: status => BelcotaxDocumentStatusHelper.getColor(status),
                minimumWidth: 100,
                recommendedWidth: 140,
            })]
        : []),
    new Column<Document, RecordWarning[]>({
        name: $t('%1UL'),
        allowSorting: false,
        getValue: (document) => {
            return [...document.data.fieldAnswers.values()].flatMap(answer => answer.getWarnings());
        },
        format: (warnings) => {
            if (warnings.length === 1) {
                return $t('%zJ');
            }
            if (warnings.length > 1) {
                return $t('%1RQ', { count: warnings.length });
            }
            return $t('%1FW');
        },
        compare: (a, b) => -Sorter.byNumberValue(a.length, b.length),
        getStyle: (warnings) => {
            if (warnings.length > 0) {
                if (warnings.find(w => w.type === RecordWarningType.Error)) {
                    return 'error';
                }
                return 'warn';
            }
            return 'gray';
        },
        minimumWidth: 100,
        recommendedWidth: 150,
    }),

    new Column<Document, Date>({
        id: 'createdAt',
        name: $t('%1Jc'),
        getValue: document => document.createdAt,
        format: date => Formatter.dateTime(date),
        minimumWidth: 100,
        recommendedWidth: 200,
    }),

    new Column<Document, Date>({
        id: 'updatedAt',
        name: $t('%1Ks'),
        getValue: document => document.updatedAt,
        format: date => Formatter.dateTime(date),
        minimumWidth: 100,
        recommendedWidth: 200,
        enabled: false,
    }),
];

const context = useContext();
const navigationActions = useNavigationActions();

function addDocument(_document: Document) {
    // Make sure that we deepSet the document after the table had been reloaded, so possible edits appear in the table
    tableObjectFetcher.cacheBeforeReset(_document);

    // reset the table
    tableObjectFetcher.reset(true, true);
}

const actions = computed(() => {
    const builder = new DocumentActionBuilder({
        $context: context.value,
        template: props.template,
        navigationActions,
        addDocument: (document: Document) => addDocument(document),
    });
    return builder.getActions();
});

const route = {
    component: async () => (await import('./DocumentView.vue')).default,
    objectKey: 'document',
    getProperties: () => ({
        template: props.template,
        addDocument: (document: Document) => addDocument(document),
    }),
};

</script>
