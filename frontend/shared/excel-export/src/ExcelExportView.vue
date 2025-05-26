<template>
    <SaveView :loading="exporting" save-icon="download" @save="startExport">
        <h1>
            {{ $t('0302eaa0-ce2a-4ef0-b652-88b26b9c53e9') }}
        </h1>

        <ScrollableSegmentedControl v-if="workbook.sheets.length > 1" v-model="visibleSheet" :items="workbook.sheets">
            <template #item="{item}">
                <span>{{ item.name }}</span>

                <span v-if="item.enabledCount === 0" class="icon disabled small" :v-tooltip="$t('7501399f-4ff3-421b-b27a-2b56ca5f6ce9')" />
            </template>
        </ScrollableSegmentedControl>

        <p v-if="visibleSheet.description" class="style-description-block">
            {{ visibleSheet.description }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STList v-if="visibleSheet.withCategoryRow || visibleSheet.columns.find(c => c.category)">
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
        </STList>

        <ColumnSelector :name="visibleSheet.name" :columns="visibleSheet.columns" />
    </SaveView>
</template>

<script lang="ts" setup>
import { Decoder, ObjectData, VersionBox, VersionBoxDecoder } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { ErrorBox, ScrollableSegmentedControl, Toast, ToastButton, useContext, useErrors } from '@stamhoofd/components';
import { AppManager, Storage } from '@stamhoofd/networking';
import { ExcelExportRequest, ExcelExportResponse, ExcelExportType, ExcelWorkbookFilter, LimitedFilteredRequest, Version } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { onMounted, ref } from 'vue';
import ColumnSelector from './ColumnSelector.vue';
import { SelectableWorkbook } from './SelectableWorkbook';

const props = defineProps<{
    type: ExcelExportType;
    filter: LimitedFilteredRequest;
    workbook: SelectableWorkbook;
    configurationId: string; // How to store the filters for easy reuse
}>();

const visibleSheet = ref(props.workbook.sheets[0]);
const exporting = ref(false);
const errors = useErrors();
const context = useContext();
const pop = usePop();

onMounted(async () => {
    // Load from storage
    try {
        const savedFilter = await Storage.keyValue.getItem('excel-filter-' + props.configurationId);

        if (savedFilter) {
            const decodedJson = JSON.parse(savedFilter);
            const decoder = new VersionBoxDecoder(ExcelWorkbookFilter as Decoder<ExcelWorkbookFilter>);
            const filter = decoder.decode(new ObjectData(decodedJson, { version: 0 }));

            if (filter) {
                console.log('Loaded filter', filter);
                props.workbook.from(filter.data);
            }
        }
    }
    catch (e) {
        console.error('Failed to load filter', e);
    }
});

async function saveFilter() {
    const filter = props.workbook.getFilter();
    const encoded = new VersionBox(filter).encode({ version: Version });

    try {
        await Storage.keyValue.setItem('excel-filter-' + props.configurationId, JSON.stringify(encoded));
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
    }

    exporting.value = false;
}

async function doExport() {
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'POST',
            path: `/export/excel/${props.type}`,
            body: ExcelExportRequest.create({
                filter: props.filter,
                workbookFilter: props.workbook.getFilter(),
            }),
            decoder: ExcelExportResponse as Decoder<ExcelExportResponse>,
            shouldRetry: false,
        });

        if (response.data.url) {
            const url = new URL(response.data.url);
            const filename = Formatter.fileSlug(props.type) + '.xlsx';
            new Toast('Jouw bestand is klaar, download het hier', 'download')
                .setButton(
                    new ToastButton('Downloaden', () => {
                        void AppManager.shared.downloadFile(url, filename);
                    }),
                )
                .setHide(null)
                .setForceButtonClick()
                .show();
        }
        else {
            Toast.success('Je ontvang een e-mail met het bestand als jouw Excel export klaar is').setHide(15000).show();
        }

        await pop();
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
}

</script>
