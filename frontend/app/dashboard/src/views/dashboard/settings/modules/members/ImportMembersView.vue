<template>
    <SaveView :title="$t('c67f13a2-08cb-4c30-a39d-d07679430672')" :loading="saving" :disabled="!file || columns.length == 0 || rowCount === 0" :save-text="$t('a3ea7b14-204b-44b9-abb5-8ced5fc847d1')" @save="goNext">
        <h1>{{ $t('c67f13a2-08cb-4c30-a39d-d07679430672') }}</h1>
        <p>
            {{ $t('3fd23349-ffba-4291-be68-2d0c844e5754') }}
        </p>

        <p v-if="!hasMembers && $isStamhoofd" class="warning-box">
            <span>{{ $t('7a7e4a56-9d39-42cf-b4fa-930e43330756') }}
                <a :href="LocalizedDomains.getDocs('waarom-je-leden-beter-niet-importeert')" class="inline-link" target="_blank">{{ $t('5b38f7dc-d818-4298-8ef6-eb7fd6934c63') }}</a>
            </span>
        </p>
        <STErrorsDefault :error-box="errors.errorBox" />

        <label class="upload-members-upload-box">
            <span v-if="!file" class="icon upload" />
            <span v-else class="icon file-excel color-excel" />
            <div v-if="!file">
                <h2 class="style-title-list">
                    {{ $t('83271a7d-c9c1-4424-92cb-cf059d6a63f5') }}
                </h2>
                <p class="style-description">
                    {{ $t('f21f4f50-f541-4be6-9377-b573d641c227') }}
                </p>
            </div>
            <div v-else>
                <h2 class="style-title-list">
                    {{ file }}
                </h2>
                <p class="style-description">
                    {{ rowCount }} rijen, {{ columnCount }} {{ $t('dc2128b0-ec7b-463e-abbc-6039d205ec4b') }}
                </p>
            </div>
            <input type="file" multiple style="display: none;" accept=".xlsx, .xls, .csv, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" @change="changedFile">
            <span v-if="file" class="icon sync gray" />
        </label>

        <template v-if="sheetSelectionList.length > 1">
            <STInputBox error-fields="sheet" :error-box="errors.errorBox" :title="$t(`1716d997-8d09-4a95-8950-d9dff3b91cbb`)">
                <Dropdown v-model="sheetKey">
                    <option :value="null" disabled>
                        {{ $t('e93fa1c0-31bc-4086-b45f-0198b629b207') }}
                    </option>
                    <option v-for="key in sheetSelectionList" :key="key" :value="key">
                        {{ key }}
                    </option>
                </Dropdown>
            </STInputBox>
            <hr>
        </template>

        <template v-if="file && columns.length > 0">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>
                            {{ $t('93043ff4-588f-4a1f-a9de-1142379ec2a3') }}
                        </th>
                        <th>{{ $t('edb1ddbe-37ad-4448-b133-d4578167e780') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="column in columns" :key="column.name">
                        <td>
                            <Checkbox :model-value="column.selected" @update:model-value=" setColumnSelected(column, $event)">
                                <h2 class="style-title-list">
                                    {{ column.name }}
                                </h2>
                                <p v-if="column.examples.length > 0" class="style-description-small">
                                    {{ column.examples.slice(0, 2).join(', ') }}...
                                </p>
                            </Checkbox>
                        </td>
                        <td>
                            <Dropdown v-model="column.matcherCode" @change="didChangeColumn(column)">
                                <option :value="null" disabled>
                                    {{ $t('e93fa1c0-31bc-4086-b45f-0198b629b207') }}
                                </option>
                                <optgroup v-for="cat in matcherCategories" :key="cat.name" :label="cat.name">
                                    <option v-for="(matcher, index) in cat.matchers" :key="index" :value="matcher.id">
                                        {{ matcher.getName() }} ({{ cat.name }})
                                    </option>
                                </optgroup>
                            </Dropdown>
                        </td>
                    </tr>
                </tbody>
            </table>
            <p v-if="file && columns.length > 0" class="warning-box">
                {{ $t('efcf2c9f-68c9-409e-8e0f-b11f73152d6b') }}
            </p>
            <STErrorsDefault :error-box="errors.errorBox" />
            <hr>
            <STInputBox :title="$t('8b70623b-ba97-468f-90aa-b1c149393cea')" error-fields="period" :error-box="errors.errorBox">
                <RegistrationPeriodSelector v-model="period" :should-disable-locked-periods="true" />
            </STInputBox>
        </template>
    </SaveView>
</template>

<script lang="ts" setup>
import { isSimpleError, isSimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, PushOptions, useShow } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, Checkbox, Dropdown, ErrorBox, fetchAll, STErrorsDefault, STInputBox, useErrors, useMembersObjectFetcher, usePlatform, useRequiredOrganization } from '@stamhoofd/components';
import { Address, LimitedFilteredRequest, OrganizationRegistrationPeriod, RecordAddressAnswer, RecordDateAnswer, RecordTextAnswer, RecordType } from '@stamhoofd/structures';
import { computed, Ref, ref, watch } from 'vue';
import XLSX from 'xlsx';
import { AddressColumnMatcher } from '../../../../../classes/import/AddressColumnMatcher';
import { ColumnMatcher } from '../../../../../classes/import/ColumnMatcher';
import { DateColumnMatcher } from '../../../../../classes/import/DateColumnMatcher';
import { getAllMatchers } from '../../../../../classes/import/defaultMatchers';
import { FindExistingMemberResult } from '../../../../../classes/import/FindExistingMemberResult';
import { ImportError } from '../../../../../classes/import/ImportError';
import { ImportMemberBaseResult } from '../../../../../classes/import/ImportMemberBaseResult';
import { ImportMemberResult } from '../../../../../classes/import/ImportMemberResult';
import { ImportMembersBaseResultWithErrors, ImportMembersResultWithErrors } from '../../../../../classes/import/ImportResultWithErrors';
import { MatchedColumn } from '../../../../../classes/import/MatchedColumn';
import { MemberDetailsMatcherCategory } from '../../../../../classes/import/MemberDetailsMatcherCategory';
import { TextColumnMatcher } from '../../../../../classes/import/TextColumnMatcher';
import ImportMembersErrorsView from './ImportMembersErrorsView.vue';
import ImportMembersQuestionsView from './ImportMembersQuestionsView.vue';
import ImportVerifyProbablyEqualView from './ImportVerifyProbablyEqualView.vue';
import RegistrationPeriodSelector from './RegistrationPeriodSelector.vue';
import { LocalizedDomains } from '@stamhoofd/frontend-i18n';

const errors = useErrors();
const saving = ref(false);
const file = ref<null | string>(null);
const organization = useRequiredOrganization();
const rowCount = ref(0);
const columnCount = ref(0);
const columns = ref<MatchedColumn[]>([]);
const sheets = ref<Record<string, XLSX.WorkSheet>>({});
const sheetSelectionList = Object.keys(sheets.value);
const internalSheetKey = ref<string | null>(null);
const platform = usePlatform();
const period: Ref<OrganizationRegistrationPeriod> = ref(organization.value.period) as unknown as Ref<OrganizationRegistrationPeriod>;
const baseMatchers: Ref<ColumnMatcher[]> = ref(getAllMatchers(platform.value, organization.value, () => period.value.groups, () => period.value));

const groupSpecificMatchers = computed(() => {
    const result: ColumnMatcher[] = [];
    const groups = period.value.groups;

    for (const category of groups.flatMap(g => g.settings.recordCategories)) {
        for (const record of category.getAllRecords()) {
            switch (record.type) {
                case RecordType.Textarea:
                case RecordType.Phone:
                case RecordType.Email:
                case RecordType.Text: {
                    result.push(new TextColumnMatcher({
                        name: record.name.toString(),
                        category: category.name.toString(),
                        required: false,
                        save(value: string, importResult: ImportMemberResult) {
                            importResult.importRegistrationResult.recordAnswers.set(record.id, RecordTextAnswer.create({ settings: record, value }));
                        },
                    }));
                    break;
                }
                case RecordType.Address: {
                    result.push(new AddressColumnMatcher({
                        name: record.name.toString(),
                        category: category.name.toString(),
                        required: false,
                        save(address: Address, importResult: ImportMemberResult) {
                            importResult.importRegistrationResult.recordAnswers.set(record.id, RecordAddressAnswer.create({ settings: record, address }));
                        },
                    }));
                    break;
                }
                case RecordType.Date: {
                    result.push(new DateColumnMatcher({
                        name: record.name.toString(),
                        category: category.name.toString(),
                        required: false,
                        save(dateValue: Date, importResult: ImportMemberResult) {
                            importResult.importRegistrationResult.recordAnswers.set(record.id, RecordDateAnswer.create({ settings: record, dateValue }));
                        },
                    }));
                    break;
                }
            }
        }
    }

    return result;
});

watch(groupSpecificMatchers, (_newMatchers, oldMatchers) => {
    // clear group specific matcher if not available anymore
    for (const column of columns.value) {
        if (oldMatchers.find(m => m.id === column.matcher?.id)) {
            column.matcher = null;
            column.selected = false;
        }
    }
});

const allMatchers = computed(() => [...baseMatchers.value, ...groupSpecificMatchers.value]);

const show = useShow();

const sheetKey = computed({
    get: () => internalSheetKey.value,
    set: (key: string | null) => {
        if (key === null) {
            internalSheetKey.value = null;
            columns.value = [];
            rowCount.value = 0;
            columnCount.value = 0;
            return;
        }

        const sheet = sheets.value[key];
        if (!sheet) {
            return;
        }

        if (!sheet['!ref']) {
            throw new Error('Missing ref in sheet');
        }
        const range = XLSX.utils.decode_range(sheet['!ref']); // get the range
        rowCount.value = range.e.r + 1;
        columnCount.value = range.e.c + 1;
        internalSheetKey.value = key;

        columns.value = [];
        columns.value = readColumns(columns.value);
    },
});

const sheet = computed(() => {
    if (!sheetKey.value) {
        return null;
    }
    return sheets.value[sheetKey.value] ?? null;
});

const hasMembers = computed(() => {
    const count = organization.value.adminCategoryTree.getMemberCount({});
    return organization.value.meta.packages.useMembers && !organization.value.meta.packages.isMembersTrial && count !== null && count > 30;
});

const matcherCategories = computed(() => {
    const arr: Partial<Record<MemberDetailsMatcherCategory, { name: string; matchers: ColumnMatcher[] }>> = {};
    for (const matcher of allMatchers.value) {
        const cat = matcher.category.toLowerCase();
        if (arr[cat]) {
            arr[cat].matchers.push(matcher);
        }
        else {
            arr[cat] = {
                name: matcher.category,
                matchers: [matcher],
            };
        }
    }
    return Object.values(arr);
});

function changedFile(event: any) {
    if (!event.target.files || event.target.files.length === 0) {
        return;
    }

    file.value = null;

    const files = event.target.files as FileList;
    const newFile = files[0];

    const reader = new FileReader();
    reader.onload = (e: any) => {
        if (!e.target || !e.target.result) {
            new CenteredMessage($t(`efec4f91-0618-4509-88a4-a8af49f5e04f`)).addCloseButton().show();
            return;
        }

        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', raw: true });

        /* DO SOMETHING WITH workbook HERE */
        const keys = Object.keys(workbook.Sheets);
        if (keys.length === 0) {
            new CenteredMessage($t('152a7321-7b48-448d-9ac2-70c37d3effef')).addCloseButton().show();
            return;
        }
        sheets.value = workbook.Sheets;
        file.value = newFile.name;
        sheetKey.value = keys[0];
    };

    reader.readAsArrayBuffer(newFile);

    // Clear selection
    event.target.value = null;
}

function readColumns(previousColumns: MatchedColumn[]): MatchedColumn[] {
    if (!sheet.value) {
        return [];
    }

    if (!sheet.value['!ref']) {
        throw new Error('Missing ref in sheet');
    }

    const range = XLSX.utils.decode_range(sheet.value['!ref']); // get the range
    const columns: MatchedColumn[] = [];
    let skipAuto = previousColumns.length > 0;

    const availableMatchers = allMatchers.value.slice();

    // Read all the names + some examples and try to match them to columns
    for (let colNum = range.s.c; colNum <= range.e.c; colNum++) {
        const cell = sheet.value[XLSX.utils.encode_cell({ r: range.s.r, c: colNum })] as XLSX.CellObject;
        if (!cell) {
            continue;
        }
        const columnName = (cell.w ?? cell.v ?? '') + '';
        const matched = new MatchedColumn(colNum, columnName, allMatchers.value);

        for (let row = range.s.r + 1; row <= range.e.r && row < 10; row++) {
            const valueCell = sheet.value[XLSX.utils.encode_cell({ r: row, c: colNum })];

            if (!valueCell) {
                continue;
            }
            matched.examples.push((valueCell.w ?? valueCell.v ?? '') + '');
        }

        const previous = previousColumns.find(c => c.name === columnName);
        if (previous) {
            const uptodateMatcher = availableMatchers.find(m => m.id === previous.matcherCode);
            if (uptodateMatcher) {
                skipAuto = true;
                matched.matcher = uptodateMatcher;
                matched.selected = true;
                availableMatchers.splice(availableMatchers.indexOf(uptodateMatcher), 1);
            }
        }

        if (!matched.matcher && !skipAuto) {
            for (const [index, matcher] of availableMatchers.entries()) {
                if (matcher.doesMatch(columnName, matched.examples)) {
                    availableMatchers.splice(index, 1);

                    matched.matcher = matcher;
                    matched.selected = true;
                    break;
                }
            }
        }

        columns.push(matched);
    }

    return columns;
}

function setColumnSelected(column: MatchedColumn, value: boolean) {
    column.selected = value;

    if (value && column.matcher === null) {
        // Find best matching by default
        for (const matcher of allMatchers.value) {
            // Not yet used
            if (columns.value.find(c => c.matcher?.id === matcher.id)) {
                continue;
            }
            if (matcher.doesMatch(column.name, column.examples)) {
                column.matcher = matcher;
                break;
            }
        }
    }

    if (!value) {
        column.matcher = null;
    }
}

function didChangeColumn(column: MatchedColumn) {
    if (column.matcher === null) {
        return;
    }

    column.selected = true;
    // Check if others have the same matcher, then clear those
    for (const col of columns.value) {
        if (col === column) {
            continue;
        }
        if (col.matcherCode === column.matcherCode) {
            col.matcher = null;
            col.selected = false;
        }
    }
}

function importBaseData(sheet: XLSX.WorkSheet, columns: MatchedColumn[]) {
    if (!sheet['!ref']) {
        throw new Error('Missing ref in sheet');
    }

    const range = XLSX.utils.decode_range(sheet['!ref']);
    const result = new ImportMembersBaseResultWithErrors();

    const filteredColumns = columns.filter(c => c.selected && c.isBaseMatcher);

    if (filteredColumns.length) {
        for (let row = range.s.r + 1; row <= range.e.r; row++) {
            const importBase = new ImportMemberBaseResult(row);
            let allEmpty = true;
            const errorStack: ImportError[] = [];

            for (const column of filteredColumns) {
                const valueCell = sheet[XLSX.utils.encode_cell({ r: row, c: column.index })] as XLSX.CellObject;

                if (valueCell) {
                    allEmpty = false;
                }

                try {
                    column.baseMatcher!.setBaseValue(valueCell, importBase);
                }
                catch (e: any) {
                    console.error(e);
                    if (isSimpleError(e) || isSimpleErrors(e)) {
                        errorStack.push(new ImportError(row, column.index, e.getHuman()));
                    }
                    else if (typeof e['message'] === 'string') {
                        errorStack.push(new ImportError(row, column.index, e['message']));
                    }
                }
            }

            if (allEmpty) {
            // ignore empty row
                continue;
            }
            result.errors.push(...errorStack);

            result.data.push(importBase);
        }
    }

    return result;
}

async function importData(sheet: XLSX.WorkSheet, columns: MatchedColumn[], results: ImportMemberResult[]) {
    if (!sheet['!ref']) {
        throw new Error('Missing ref in sheet');
    }

    const importMap = new Map(results.map(r => [r.row, r]));

    const range = XLSX.utils.decode_range(sheet['!ref']);
    const result = new ImportMembersResultWithErrors();

    for (let row = range.s.r + 1; row <= range.e.r; row++) {
        let allEmpty = true;
        const errorStack: ImportError[] = [];
        const importMemberResult = importMap.get(row);
        if (!importMemberResult) {
            continue;
        }
        importMap.delete(row);

        for (const column of columns) {
            if (!column.selected) {
                continue;
            }

            if (!column.matcher) {
                throw new Error($t(`d298a037-1da1-4435-a78b-f56b949e9dad`, { column: column.name }));
            }

            const valueCell = sheet[XLSX.utils.encode_cell({ r: row, c: column.index })] as XLSX.CellObject;

            if (valueCell) {
                allEmpty = false;
            }

            try {
                await column.matcher.setValue(valueCell, importMemberResult);
            }
            catch (e: any) {
                console.error(e);
                if (isSimpleError(e) || isSimpleErrors(e)) {
                    errorStack.push(new ImportError(row, column.index, e.getHuman()));
                }
                else if (typeof e['message'] === 'string') {
                    errorStack.push(new ImportError(row, column.index, e['message']));
                }
            }
        }

        if (allEmpty) {
            // ignore empty row
            continue;
        }
        result.errors.push(...errorStack);

        result.data.push(importMemberResult);
    }

    return result;
}

const memberFetcher = useMembersObjectFetcher();

async function fetchAllMembers() {
    const selectedPeriod = period.value.period;
    // only get members for selected period + previous period
    const periodIds = [selectedPeriod.id, selectedPeriod.previousPeriodId];

    const initialRequest: LimitedFilteredRequest = new LimitedFilteredRequest({
        filter: {
            registrations: {
                $elemMatch: {
                    organizationId: organization.value.id,
                    periodId: {
                        $in: periodIds,
                    },
                },
            },
        },
        // todo: change limit?
        limit: 100,
    });

    return await fetchAll(initialRequest, memberFetcher);
}

async function findExistingMembers(data: ImportMemberBaseResult[]) {
    const allMembers = await fetchAllMembers();
    return data.map(item => new FindExistingMemberResult(item, allMembers, organization.value));
}

async function startImport(sheet: XLSX.WorkSheet, columns: MatchedColumn[], existingMemberResults: FindExistingMemberResult[], showCallback: (options: PushOptions | ComponentWithProperties) => Promise<void> = show) {
    const importResults = existingMemberResults.map(m => m.toImportMemberResult());
    const result = await importData(sheet, columns, importResults);

    if (result.errors.length > 0) {
        showCallback(new ComponentWithProperties(ImportMembersErrorsView, {
            importErrors: result.errors,
        })).catch(console.error);
    }
    else {
        showCallback(new ComponentWithProperties(ImportMembersQuestionsView, {
            importMemberResults: result.data,
            period: period.value,
        })).catch(console.error);
    }
}

async function goNext() {
    if (!sheet.value || saving.value) {
        return;
    }

    saving.value = true;

    try {
        const result = importBaseData(sheet.value, columns.value);

        if (result.errors.length > 0) {
            show(new ComponentWithProperties(ImportMembersErrorsView, {
                importErrors: result.errors,
            })).catch(console.error);
        }
        else {
            // find equal members and possible equal members
            const results = await findExistingMembers(result.data);

            const probablyEqualResults = results.filter(r => r.isProbablyEqual);
            if (probablyEqualResults.length) {
                show(new ComponentWithProperties(ImportVerifyProbablyEqualView, {
                    members: probablyEqualResults,
                    onVerified: (show: (options: PushOptions | ComponentWithProperties) => Promise<void>) => {
                        if (!sheet.value) {
                            console.error('sheet is null');
                            return;
                        }
                        startImport(sheet.value, columns.value, results, show).catch(e => new ErrorBox(e));
                    },
                })).catch(e => new ErrorBox(e));
                saving.value = false;
                return;
            }

            await startImport(sheet.value, columns.value, results, show);
        }
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    saving.value = false;
}

async function shouldNavigateAway() {
    if (!file.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('334d8433-5ba2-443f-84f7-7a88b06f610b'), $t('6f1154ce-274d-476a-b658-f0d7e82cb9b4'));
}

defineExpose({
    shouldNavigateAway,
});
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.upload-members-upload-box {
    max-width: 100%;
    box-sizing: border-box;
    padding: 30px 20px;
    border-radius: $border-radius;
    background: $color-background-shade;
    display: flex;
    width: 100%;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
    user-select: none;
    text-align: left;
    transition: background-color 0.2s;
    margin-bottom: 20px;

    &:active {
        transition: none;
        background-color: $color-background-shade-darker;
    }

    > .icon:first-child {
        padding-right: 20px;
        flex-shrink: 0;
    }

    > .icon:last-child {
        padding-left: 20px;
        flex-shrink: 0;
        margin-left: auto;
    }
}
</style>
