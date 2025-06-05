<template>
    <SaveView :loading="exporting" save-icon="download" @save="startExport">
        <h1>
            {{ $t('Exporteren naar PDF') }}
        </h1>

        <ScrollableSegmentedControl v-if="documents.size> 1" v-model="visibleDocument" :items="documents.documents">
            <template #item="{item}">
                <span>{{ item.name }}</span>

                <span v-if="item.enabledCount === 0" class="icon disabled small" :v-tooltip="$t('Dit document kan niet worden geëxporteerd')" />
            </template>
        </ScrollableSegmentedControl>

        <p v-if="visibleDocument.description" class="style-description-block">
            {{ visibleDocument.description }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <!-- <STList v-if="visibleSheet.withCategoryRow || visibleSheet.columns.find(c => c.category)">
            <STListItem element-name="label" :selectable="true">
                <template #left>
                    <Checkbox v-model="visibleSheet.withCategoryRow" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('5bb88d15-fd82-4d5d-8efc-43e2443d912d') }}
                </h3>
                <p class="style-description-small">
                    {{ $t('cd511a0e-71cc-44bb-8107-7de1a18dab9d') }}
                </p>
            </STListItem>
        </STList> -->

        <ColumnSelector :name="'pdf'" :columns="visibleDocument.items" />
    </SaveView>
</template>

<script lang="ts" setup generic="T">
import { Decoder, ObjectData, VersionBox, VersionBoxDecoder } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { ErrorBox, ScrollableSegmentedControl, useContext, useErrors } from '@stamhoofd/components';
import { Storage } from '@stamhoofd/networking';
import { PdfDocumentsFilter, Version } from '@stamhoofd/structures';
import { onMounted, ref } from 'vue';
import ColumnSelector from './ColumnSelector.vue';
import { MembersPdfDocument } from './MembersPdfDocument';
import { PdfDocuments } from './PdfDocuments';

const props = defineProps<{
    documentTitle: string;
    documents: PdfDocuments<T>;
    configurationId: string; // How to store the filters for easy reuse
    items: T[];
}>();

const exporting = ref(false);
const errors = useErrors();
const context = useContext();
const pop = usePop();

const STORAGE_FILTER_KEY = 'pdf-filter-' + props.configurationId;

const visibleDocument = ref(props.documents.documents[0]);

onMounted(async () => {
    // Load from storage
    try {
        const savedFilter = await Storage.keyValue.getItem(STORAGE_FILTER_KEY);

        if (savedFilter) {
            const decodedJson = JSON.parse(savedFilter);
            const decoder = new VersionBoxDecoder(PdfDocumentsFilter as Decoder<PdfDocumentsFilter>);
            const filter = decoder.decode(new ObjectData(decodedJson, { version: 0 }));

            if (filter) {
                console.log('Loaded filter', filter);
                props.documents.from(filter.data);
            }
        }
    }
    catch (e) {
        console.error('Failed to load filter', e);
    }
});

async function saveFilter() {
    const filter = props.documents.getFilter();
    const encoded = new VersionBox(filter).encode({ version: Version });

    try {
        await Storage.keyValue.setItem(STORAGE_FILTER_KEY, JSON.stringify(encoded));
    }
    catch (e) {
        console.error('Failed to save filter', e);
    }
}

async function startExport() {
    if (exporting.value) {
        return;
    }
    exporting.value = true;
    errors.errorBox = null;

    try {
        await saveFilter();
        await doExport();
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
        console.error(e);
    }

    exporting.value = false;
}

async function doExport() {
    const document = new MembersPdfDocument(props.items, props.documents, props.documentTitle);

    try {
        await document.download();
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
}

</script>
