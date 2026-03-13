<template>
    <SaveView :loading="exporting" save-icon="download" @save="startExport">
        <h1>
            {{ $t('%17H') }}
        </h1>

        <ScrollableSegmentedControl v-model="visibleDocument" :items="sheets">
            <template #item="{item}">
                <span>{{ item.name }}</span>

                <span v-if="item.enabledCount === 0" class="icon disabled small" :v-tooltip="$t('%17I')" />
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
import { ErrorBox } from '#errors/ErrorBox.ts';
import ScrollableSegmentedControl from '#inputs/ScrollableSegmentedControl.vue';
import { useAuth } from '#hooks/useAuth.ts';
import { useErrors } from '#errors/useErrors.ts';
import { Storage } from '@stamhoofd/networking/Storage';
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
    name: $t('%17J'),
    description: $t('%17K'),
    items: getAllSelectablePdfDataForMemberDetails({
        platform: props.platform,
        organization: props.organization,
        groups: props.groups,
        auth,
    }),
});

const membersSummarySheet = new SelectablePdfSheet({
    id: 'member-summary',
    name: $t('%17L'),
    description: $t('%17M'),
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

    let documentTitle = $t('%17N');

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
