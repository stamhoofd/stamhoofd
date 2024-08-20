<template>
    <SaveView :loading="exporting" save-icon="download" @save="startExport">
        <h1>Exporteren naar Excel</h1>

        <ScrollableSegmentedControl v-if="workbook.sheets.length" v-model="visibleSheet" :items="workbook.sheets">
            <template #item="{item}">
                <span>{{ item.name }}</span>

                <div class="style-bubble current-color" v-if="item.enabledCount > 0">
                    <span>{{ item.enabledCount }}</span>
                </div>
            </template>
        </ScrollableSegmentedControl>

        <p v-if="visibleSheet.description" class="style-description-block">
            {{ visibleSheet.description }}
        </p> 

        <STErrorsDefault :error-box="errors.errorBox" />

        <div v-for="({categoryName, columns}, index) in groupedColumns" :key="visibleSheet.name + '-' + categoryName" class="container">
            <hr v-if="index > 0">

            <STList>
                <STListItem element-name="label" :selectable="true">
                    <template #left>
                        <Checkbox :model-value="getAllSelected(columns)" @update:model-value="setAllSelected($event, columns)" />
                    </template>

                    <div class="style-title-2">
                        {{ categoryName || (groupedColumns.length > 1 ? 'Algemeen' : 'Alles selecteren') }}
                    </div>
                </STListItem>

                <STListItem v-for="column of columns" :key="column.id" element-name="label" :selectable="true">
                    <template #left>
                        <Checkbox v-model="column.enabled" />
                    </template>

                    <h3 class="style-title-list">
                        {{ column.name }}
                    </h3>
                    <p v-if="column.description" class="style-description-small">
                        {{ column.description }}
                    </p>
                </STListItem>
            </STList>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import { Decoder, ObjectData, VersionBox, VersionBoxDecoder } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { ErrorBox, ScrollableSegmentedControl, Toast, useContext, useErrors } from '@stamhoofd/components';
import { Storage } from '@stamhoofd/networking';
import { ExcelExportRequest, ExcelExportResponse, ExcelExportType, ExcelWorkbookFilter, LimitedFilteredRequest, Version } from '@stamhoofd/structures';
import { computed, onMounted, ref } from 'vue';
import { SelectableColumn } from './SelectableColumn';
import { SelectableWorkbook } from './SelectableWorkbook';

const props = defineProps<{
    type: ExcelExportType,
    filter: LimitedFilteredRequest,
    workbook: SelectableWorkbook,
    configurationId: string // How to store the filters for easy reuse
}>();

const visibleSheet = ref(props.workbook.sheets[0]);
const exporting = ref(false);
const errors = useErrors()
const context = useContext()
const pop = usePop()

const groupedColumns = computed(() => {
    const categories: Map<string, {columns: SelectableColumn[], categoryName: string}> = new Map();

    for (const column of visibleSheet.value.columns) {
        const category = column.category || '';

        if (!categories.has(category)) {
            categories.set(category, {
                columns: [],
                categoryName: category
            });
        }
        categories.get(category)!.columns.push(column);
    }

    return Array.from(categories.values());
});

function getAllSelected(columns: SelectableColumn[]) {
    return columns.every(c => c.enabled);
}

function setAllSelected(selected: boolean, columns: SelectableColumn[]) {
    for (const column of columns) {
        column.enabled = selected;
    }
}

onMounted(async () => {
    // Load from storage
    try {
        const savedFilter = await Storage.keyValue.getItem('excel-filter-' + props.configurationId);

        if (savedFilter) {
            const decodedJson = JSON.parse(savedFilter);
            const decoder = new VersionBoxDecoder(ExcelWorkbookFilter as Decoder<ExcelWorkbookFilter>);
            const filter = decoder.decode(new ObjectData(decodedJson, {version: 0}));

            if (filter) {
                console.log('Loaded filter', filter);
                props.workbook.from(filter.data);
            }
        }

    } catch (e) {
        console.error('Failed to load filter', e);
    }
})

async function saveFilter() {
    const filter = props.workbook.getFilter();
    const encoded = new VersionBox(filter).encode({version: Version})

    try {
        await Storage.keyValue.setItem('excel-filter-' + props.configurationId, JSON.stringify(encoded));
    } catch (e) {
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
        await doExport()
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    }

    exporting.value = false;
}

function downloadURL(url: string, name: string) {
    const link = document.createElement("a");
    link.download = name;
    link.href = url;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function doExport() {
    try {
        const response = await context.value.authenticatedServer.request({
            method: "POST",
            path: `/export/excel/${props.type}`,
            body: ExcelExportRequest.create({
                filter: props.filter,
                workbookFilter: props.workbook.getFilter()
            }),
            decoder: ExcelExportResponse as Decoder<ExcelExportResponse>,
            shouldRetry: false
        })

        if (response.data.url) {
            Toast.success('Excel bestand wordt gedownload').show()
            downloadURL(response.data.url, 'leden.xlsx')
        } else {
            Toast.success('Je ontvang een e-mail met het bestand als jouw Excel export klaar is').setHide(15000).show()
        }

        await pop()
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    }
}

</script>
