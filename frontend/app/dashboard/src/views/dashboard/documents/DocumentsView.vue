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
    >
        <template #empty>
            {{ $t('d3903009-28d5-48d6-b109-c89b88a9f36e') }}
        </template>
    </ModernTableView>
</template>

<script lang="ts" setup>
import { Column, getDocumentsUIFilterBuilders, ModernTableView, UIFilterBuilders, useContext, useNavigationActions, useTableObjectFetcher } from '@stamhoofd/components';
import { Document, DocumentStatus, DocumentStatusHelper, DocumentTemplatePrivate, RecordWarning, RecordWarningType } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';

import { useDocumentsObjectFetcher } from '@stamhoofd/components/src/fetchers/useDocumentsObjectFetcher';
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
];

const context = useContext();
const navigationActions = useNavigationActions();

function addDocument(_document: Document) {
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
