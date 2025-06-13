<template>
    <SaveView :loading="exporting" save-icon="download" @save="startExport">
        <h1>
            {{ $t('Exporteren naar PDF') }}
        </h1>

        <ScrollableSegmentedControl v-if="selectableDocument.size> 1" v-model="visibleDocument" :items="selectableDocument.sheets">
            <template #item="{item}">
                <span>{{ item.name }}</span>

                <span v-if="item.enabledCount === 0" class="icon disabled small" :v-tooltip="$t('Dit document kan niet worden geëxporteerd')" />
            </template>
        </ScrollableSegmentedControl>

        <p v-if="visibleDocument.description" class="style-description-block">
            {{ visibleDocument.description }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <DataSelector :name="'pdf'" :selectable-data="visibleDocument.items" />
    </SaveView>
</template>

<script lang="ts" setup>
import { Decoder, ObjectData, VersionBox, VersionBoxDecoder } from '@simonbackx/simple-encoding';
import { ErrorBox, ScrollableSegmentedControl, useErrors } from '@stamhoofd/components';
import { Storage } from '@stamhoofd/networking';
import { PdfDocumentsFilter, PlatformMember, Version } from '@stamhoofd/structures';
import { onMounted, ref } from 'vue';
import DataSelector from './DataSelector.vue';
import { MembersPdfDocument } from './members/MembersPdfDocument';
import { SelectablePdfDocument } from './SelectablePdfDocument';

const props = defineProps<{
    documentTitle: string;
    selectableDocument: SelectablePdfDocument<PlatformMember>;
    configurationId: string; // How to store the filters for easy reuse
    items: PlatformMember[];
}>();

const exporting = ref(false);
const errors = useErrors();

const STORAGE_FILTER_KEY = 'pdf-filter-' + props.configurationId;

const visibleDocument = ref(props.selectableDocument.sheets[0]);

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
                props.selectableDocument.from(filter.data);
            }
        }
    }
    catch (e) {
        console.error('Failed to load filter', e);
    }
});

async function saveFilter() {
    const filter = props.selectableDocument.getFilter();
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
    // todo: refactor
    // todo: maybe make generic?
    const memberDetailsDocument = props.selectableDocument.sheets[0];
    if (!memberDetailsDocument) {
        return;
    }

    const membersSummaryDocument = props.selectableDocument.sheets[1];
    if (!membersSummaryDocument) {
        return;
    }

    const document = new MembersPdfDocument(props.items,
        memberDetailsDocument,
        membersSummaryDocument,
        props.documentTitle);

    try {
        await document.download();
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
        console.error(e);
    }
}

</script>
