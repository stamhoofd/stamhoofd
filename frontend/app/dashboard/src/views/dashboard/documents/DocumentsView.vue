<template>
    <div>
        Work in progress
    </div>
</template>

<script lang="ts" setup>
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, NavigationController, usePresent, useShow } from '@simonbackx/vue-app-navigation';
import { Column, InMemoryTableAction, Toast, useContext, useIsMobile, useRequiredOrganization } from '@stamhoofd/components';
import { Document, DocumentStatus, DocumentStatusHelper, DocumentTemplatePrivate, RecordWarning, RecordWarningType } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';

import { useRequestOwner } from '@stamhoofd/networking';
import { computed, onMounted, Ref, ref } from 'vue';
import { DocumentActionBuilder } from './DocumentActionBuilder';
import DocumentView from './DocumentView.vue';

const props = defineProps<{
    template: DocumentTemplatePrivate;
}>();

const title = 'Documenten';
const allColumns = ref(getColumns());
const defaultSortColumn = computed(() => allColumns.value[1]);

const requestOwner = useRequestOwner();
const context = useContext();
const present = usePresent();
const show = useShow();
const isMobile = useIsMobile();

const loading = ref(true);
const allValues = ref([]) as Ref<Document[]>;
const organization = useRequiredOrganization();

onMounted(() => {
    reload().catch(console.error);
});

const estimatedRows = computed(() => !loading.value ? 0 : 30);
const actions = computed(() => {
    const builder = new DocumentActionBuilder({
        $context: context.value,
        template: props.template,
        component: this,
        addDocument: (document: Document) => {
            allValues.value.push(document);
        },
    });
    return [
        ...builder.getActions(),
        new InMemoryTableAction({
            name: 'Openen',
            icon: 'eye',
            priority: 0,
            groupIndex: 1,
            needsSelection: true,
            singleSelection: true,
            handler: (documents: Document[]) => {
                openDocument(documents[0]);
            },
        }),

    ];
});

function getColumns() {
    const cols: Column<Document, any>[] = [
        new Column<Document, string>({
            enabled: false,
            name: 'Volgnummer',
            getValue: v => v.id,
            compare: (a, b) => Sorter.byStringValue(a, b),
            minimumWidth: 100,
            recommendedWidth: 370,
            grow: false,
        }),

        new Column<Document, number | null>({
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
            name: 'Beschrijving',
            getValue: v => v.data.description,
            compare: (a, b) => Sorter.byStringValue(a, b),
            minimumWidth: 100,
            recommendedWidth: 320,
            grow: true,
        }),

        new Column<Document, DocumentStatus>({
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

    return cols;
}

function openDocument(document: Document) {
    const component = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(DocumentView, {
            document,
            template: props.template,
        }),
    });

    if (isMobile) {
        show(component).catch(console.error);
    }
    else {
        component.modalDisplayStyle = 'popup';
        present(component).catch(console.error);
    }
}

async function reload(visibleReload = true) {
    Request.cancelAll(requestOwner);
    loading.value = visibleReload;

    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/organization/document-templates/' + encodeURIComponent(props.template.id) + '/documents',
            decoder: new ArrayDecoder(Document as Decoder<Document>),
            shouldRetry: false,
            owner: requestOwner,
        });
        allValues.value = response.data;
    }
    catch (e) {
        if (!Request.isNetworkError(e as Error) || visibleReload) {
            Toast.fromError(e).show();
        }
    }
    if (visibleReload) {
        loading.value = false;
    }
}
</script>
