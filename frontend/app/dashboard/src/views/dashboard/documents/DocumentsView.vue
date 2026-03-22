<template>
    <ModernTableView
        :table-object-fetcher="tableObjectFetcher"
        :filter-builders="filterBuilders"
        :title="title"
        :column-configuration-id="configurationId"
        :actions="actions"
        :all-columns="allColumns"
        :prefix-column="allColumns[0]"
        :Route="Route"
        :default-sort-column="allColumns.find(c => c.id === 'createdAt')"
        :default-sort-direction="SortItemDirection.DESC"
    >
        <template #empty>
            {{ $t('%7n') }}
        </template>
    </ModernTableView>
</template>

<script lang="ts" setup>
import { Column } from '@stamhoofd/components/tables/classes/Column.ts';
import { getDocumentsUIFilterBuilders } from '@stamhoofd/components/filters/filterBuilders.ts';
import ModernTableView from '@stamhoofd/components/tables/ModernTableView.vue';
import type { UIFilterBuilders } from '@stamhoofd/components/filters/UIFilter.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { useNavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import { useTableObjectFetcher } from '@stamhoofd/components/tables/classes/TableObjectFetcher.ts';
import type { Document, DocumentTemplatePrivate, RecordWarning} from '@stamhoofd/structures';
import { DocumentStatus, DocumentStatusHelper, RecordWarningType, SortItemDirection } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';

import { useDocumentsObjectFetcher } from '@stamhoofd/components/fetchers/useDocumentsObjectFetcher.ts';
import { computed } from 'vue';
import { DocumentActionBuilder } from './DocumentActionBuilder';
import DocumentView from './DocumentView.vue';

const props = defineProps<{
    template: DocumentTemplatePrivate;
}>();

const title = 'Documenten';
const configurationId = 'documents';

const objectFetcher = useDocumentsObjectFetcher({
    requiredFilter: {
        templateId: props.template.id,
    },
});

const tableObjectFetcher = useTableObjectFetcher<Document>(objectFetcher);

const filterBuilders: UIFilterBuilders = getDocumentsUIFilterBuilders();

const allColumns: Column<Document, any>[] = [
    new Column<Document, string>({
        id: 'id',
        enabled: false,
        name: 'Volgnummer',
        getValue: v => v.id,
        compare: (a, b) => Sorter.byStringValue(a, b),
        minimumWidth: 100,
        recommendedWidth: 370,
        grow: false,
    }),

    new Column<Document, number | null>({
        id: 'number',
        name: 'Nummer',
        getValue: v => v.number,
        compare: (a, b) => Sorter.byNumberValue(b ?? 0, a ?? 0),
        format: n => n ? n.toString() : 'Niet toegekend',
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
    }),

    new Column<Document, string>({
        id: 'description',
        name: 'Beschrijving',
        getValue: v => v.data.description,
        compare: (a, b) => Sorter.byStringValue(a, b),
        minimumWidth: 100,
        recommendedWidth: 320,
        grow: true,
    }),

    new Column<Document, DocumentStatus>({
        id: 'status',
        name: 'Status',
        getValue: document => document.status,
        format: status => DocumentStatusHelper.getName(status),
        compare: (a, b) => Sorter.byEnumValue(a, b, DocumentStatus),
        getStyle: (status) => {
            return DocumentStatusHelper.getColor(status);
        },
        minimumWidth: 100,
        recommendedWidth: 120,
    }),

    new Column<Document, RecordWarning[]>({
        name: 'Waarschuwingen',
        allowSorting: false,
        getValue: (document) => {
            return [...document.data.fieldAnswers.values()].flatMap(answer => answer.getWarnings());
        },
        format: (warnings) => {
            if (warnings.length === 1) {
                return 'Waarschuwing';
            }
            if (warnings.length > 1) {
                return `${warnings.length} waarschuwingen`;
            }
            return 'Geen';
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

const Route = {
    Component: DocumentView,
    objectKey: 'document',
    getProperties: () => ({
        template: props.template,
        addDocument: (document: Document) => addDocument(document),
    }),
};

</script>
