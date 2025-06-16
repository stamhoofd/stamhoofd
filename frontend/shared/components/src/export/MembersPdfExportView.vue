<template>
    <SaveView :loading="exporting" save-icon="download" @save="startExport">
        <h1>
            {{ $t('9a647173-e10c-43b2-95c3-df882abb0c64') }}
        </h1>

        <ScrollableSegmentedControl v-model="visibleDocument" :items="sheets">
            <template #item="{item}">
                <span>{{ item.name }}</span>

                <span v-if="item.enabledCount === 0" class="icon disabled small" :v-tooltip="$t('a34d3022-7f12-4524-b68f-b484dc9201ae')" />
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
import { ErrorBox, ScrollableSegmentedControl, useAuth, useErrors } from '@stamhoofd/components';
import { Storage } from '@stamhoofd/networking';
import { Group, Organization, Platform, PlatformMember, SelectablePdfDocumentFilter, Version } from '@stamhoofd/structures';
import { onMounted, ref } from 'vue';
import { getAllSelectablePdfDataForMemberDetails, getAllSelectablePdfDataForSummary } from '../members/classes/getSelectablePdfData';
import DataSelector from './DataSelector.vue';
import { MembersPdfDocument } from './members/MembersPdfDocument';
import { SelectablePdfDocument } from './SelectablePdfDocument';
import { SelectablePdfSheet } from './SelectablePdfSheet';

const props = defineProps<{
    platform: Platform;
    organization: Organization | null;
    groups: Group[];
    configurationId: string; // How to store the filters for easy reuse
    items: PlatformMember[];
}>();

const exporting = ref(false);
const errors = useErrors();
const auth = useAuth();

const STORAGE_FILTER_KEY = 'pdf-filter-' + props.configurationId;

const memberDetailsSheet = new SelectablePdfSheet({
    id: 'member-details',
    name: $t('afea127c-30ec-4df7-8842-90aca44f9fbf'),
    description: $t('f287ceb4-a4d4-4c1a-8cfb-eecc8801b7aa'),
    items: getAllSelectablePdfDataForMemberDetails({
        platform: props.platform,
        organization: props.organization,
        groups: props.groups,
        auth,
    }),
});

const membersSummarySheet = new SelectablePdfSheet({
    id: 'member-summary',
    name: $t('8cb4ddeb-fddc-42d7-9947-e9689ff2e8a3'),
    description: $t('332e65fb-28b4-4bde-a391-a7b1d3492fe2'),
    items: getAllSelectablePdfDataForSummary({
        platform: props.platform,
        organization: props.organization,
        groups: props.groups,
        auth,
    }),
});

const sheets = ref([memberDetailsSheet, membersSummarySheet]);

const selectableDocument = new SelectablePdfDocument({
    sheets: sheets.value,
});

const visibleDocument = ref(memberDetailsSheet);

onMounted(async () => {
    // Load from storage
    try {
        const savedFilter = await Storage.keyValue.getItem(STORAGE_FILTER_KEY);

        if (savedFilter) {
            const decodedJson = JSON.parse(savedFilter);
            const decoder = new VersionBoxDecoder(SelectablePdfDocumentFilter as Decoder<SelectablePdfDocumentFilter>);
            const filter = decoder.decode(new ObjectData(decodedJson, { version: 0 }));

            if (filter) {
                console.log('Loaded filter', filter);
                selectableDocument.from(filter.data);
            }
        }
    }
    catch (e) {
        console.error('Failed to load filter', e);
    }
});

async function saveFilter() {
    const filter = selectableDocument.getFilter();
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
    const group = props.groups.length === 1 ? props.groups[0] : undefined;

    let documentTitle = $t('31fdca2d-cec9-4771-b57d-51ba6829f595');

    if (group) {
        documentTitle += ' ' + group.settings.name;
    }

    const logoImage = props.platform.config.logoDocuments ?? props.platform.config.squareLogo ?? props.platform.config.horizontalLogo;

    const document = new MembersPdfDocument(props.items,
        memberDetailsSheet,
        membersSummarySheet,
        documentTitle, logoImage);

    try {
        await document.download();
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
        console.error(e);
    }
}

</script>
