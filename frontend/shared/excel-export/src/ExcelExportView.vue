<template>
    <SaveView :loading="exporting" save-icon="download" @save="startExport">
        <h1>
            {{ $t('%Gc') }}
        </h1>

        <ScrollableSegmentedControl v-if="workbook.sheets.length > 1" v-model="visibleSheet" :items="workbook.sheets">
            <template #item="{item}">
                <span>{{ item.name }}</span>

                <span v-if="item.enabledCount === 0" class="icon disabled small" :v-tooltip="$t('%kp')" />
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
                    {{ $t('%kq') }}
                </h3>
                <p class="style-description-small">
                    {{ $t('%kr') }}
                </p>
            </STListItem>
        </STList>

        <DataSelector :name="visibleSheet.name" :selectable-data="visibleSheet.columns" />
    </SaveView>
</template>

<script lang="ts" setup>
import { Decoder, ObjectData, VersionBox, VersionBoxDecoder } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox';
import { useErrors } from '@stamhoofd/components/errors/useErrors';
import DataSelector from '@stamhoofd/components/export/DataSelector.vue';
import { useContext } from '@stamhoofd/components/hooks/useContext';
import ScrollableSegmentedControl from '@stamhoofd/components/inputs/ScrollableSegmentedControl.vue';
import { Toast, ToastButton } from '@stamhoofd/components/overlays/Toast';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import { AppManager, Storage } from '@stamhoofd/networking';
import { ExcelExportRequest, ExcelExportResponse, ExcelExportType, ExcelWorkbookFilter, LimitedFilteredRequest, Version } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { onMounted, ref } from 'vue';
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
            new Toast($t('%1B6'), 'download')
                .setButton(
                    new ToastButton($t('%1B7'), () => {
                        AppManager.shared.downloadFile(url, filename).catch((e) => {
                            Toast.fromError(e).setHide(15_000).show();
                        });
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
