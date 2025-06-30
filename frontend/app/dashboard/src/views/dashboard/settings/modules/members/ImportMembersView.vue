<template>
    <div id="import-members-settings-view" class="st-view background">
        <STNavigationBar title="Leden importeren" :dismiss="canDismiss" :pop="canPop" />

        <main>
            <h1>Leden importeren</h1>
            <p>
                Upload een Excel of CSV-bestand met de leden die je wilt importeren. Een Excel-bestand is aan te bevelen aangezien CSV-bestanden soms voor formateringsproblemen zorgen. Zorg dat je alle kolommen een naam geeft en koppel hieronder de kolom met een waarde in Stamhoofd.
            </p>

            <p v-if="!hasMembers" class="warning-box">
                <span>Start je in het begin van jouw werkjaar en moeten leden sowieso allemaal (her)inschrijven? Dan raden we af om eerst alle leden te importeren.
                    <a :href="'https://'+ $t('shared.domains.marketing') +'/docs/waarom-je-leden-beter-niet-importeert/'" class="inline-link" target="_blank">Meer info</a>
                </span>
            </p>
            <STErrorsDefault :error-box="errors.errorBox" />

            <label class="upload-box">
                <span v-if="!file" class="icon upload" />
                <span v-else class="icon file-excel color-excel" />
                <div v-if="!file">
                    <h2 class="style-title-list">
                        Kies een bestand
                    </h2>
                    <p class="style-description">
                        Ondersteunde formaten zijn .xls, .xlsx of .csv
                    </p>
                </div>
                <div v-else>
                    <h2 class="style-title-list">
                        {{ file }}
                    </h2>
                    <p class="style-description">
                        {{ rowCount }} rijen, {{ columnCount }} kolommen
                    </p>
                </div>
                <input type="file" multiple style="display: none;" accept=".xlsx, .xls, .csv, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" @change="changedFile">
                <span v-if="file" class="icon sync gray" />
            </label>

            <template v-if="sheetSelectionList.length > 1">
                <STInputBox title="Werkblad" error-fields="sheet" :error-box="errors.errorBox">
                    <Dropdown v-model="sheetKey">
                        <option :value="null" disabled>
                            Maak een keuze
                        </option>
                        <option v-for="key in sheetSelectionList" :key="key" :value="key">
                            {{ key }}
                        </option>
                    </Dropdown>
                </STInputBox>
                <hr>
            </template>

            <table v-if="file && columns.length > 0" class="data-table">
                <thead>
                    <tr>
                        <th>
                            Kolom uit jouw bestand
                        </th>
                        <th>Koppelen aan</th>
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
                                    Maak een keuze
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
                Het is aan te bevelen om ook de geboortedatum van leden toe te voegen. Op die manier kunnen we met zekerheid detecteren of een lid al bestaat in het systeem, en dan kunnen we de informatie met elkaar combineren i.p.v. een nieuw lid aan te maken.
            </p>

            <STErrorsDefault :error-box="errors.errorBox" />
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="saving">
                    <button class="button primary" :disabled="!file || columns.length == 0 || rowCount === 0" type="button" @click="goNext">
                        Volgende
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, useCanDismiss, useCanPop, useShow } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, Checkbox, Dropdown, ErrorBox, fetchAll, LoadingButton, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, useErrors, useMembersObjectFetcher, usePatch } from '@stamhoofd/components';
import { LimitedFilteredRequest, MemberDetails, RecordType } from '@stamhoofd/structures';
import XLSX from 'xlsx';

import { isSimpleError, isSimpleErrors } from '@simonbackx/simple-errors';
import { useOrganizationManager } from '@stamhoofd/networking';
import { computed, onMounted, Ref, ref } from 'vue';
import { ColumnMatcher } from '../../../../../classes/import/ColumnMatcher';
import { allMatchers } from '../../../../../classes/import/defaultMatchers';
import { ExistingMemberResult } from '../../../../../classes/import/ExistingMemberResult';
import { ImportError } from '../../../../../classes/import/ImportError';
import { ImportMemberAccumulatedResult } from '../../../../../classes/import/ImportMemberAccumulatedResult';
import { ImportResult } from '../../../../../classes/import/ImportResult';
import { MatchedColumn } from '../../../../../classes/import/MatchedColumn';
import { MemberDetailsMatcherCategory } from '../../../../../classes/import/MemberDetailsMatcherCategory';
import ImportMembersErrorsView from './ImportMembersErrorsView.vue';
import ImportMembersQuestionsView from './ImportMembersQuestionsView.vue';
import ImportVerifyProbablyEqualView from './ImportVerifyProbablyEqualView.vue';

// errorBox: ErrorBox | null = null
// validator = new Validator()

// const organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({ id: OrganizationManager.organization.id })

type MatchedMemberDetailsColumn = MatchedColumn<ImportMemberAccumulatedResult>;

const errors = useErrors();
const saving = ref(false);
const file = ref<null | string>(null);
const organizationManager = useOrganizationManager();
const { patched, patch, hasChanges, addPatch } = usePatch(organizationManager.value.organization);
const rowCount = ref(0);
const columnCount = ref(0);
const matchers: Ref<ColumnMatcher<ImportMemberAccumulatedResult>[]> = ref(allMatchers.slice());
const columns = ref<MatchedMemberDetailsColumn[]>([]);
const sheets = ref<Record<string, XLSX.WorkSheet>>({});
const sheetSelectionList = Object.keys(sheets.value);
const internalSheetKey = ref<string | null>(null);

const show = useShow();
const canDismiss = useCanDismiss();
const canPop = useCanPop();

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
        // todo
        readColumns();
    },
});

onMounted(() => {
    matchers.value = allMatchers.slice();

    // If parents are disabled, remove all parent categories
    if (organizationManager.value.organization.meta.recordsConfiguration.parents === null) {
        matchers.value = matchers.value.filter(m => m.category !== MemberDetailsMatcherCategory.Parent1 as string && m.category !== MemberDetailsMatcherCategory.Parent2 as string);
    }

    // Include all custom fields
    for (const category of organizationManager.value.organization.meta.recordsConfiguration.recordCategories) {
        for (const record of category.getAllRecords()) {
            switch (record.type) {
                case RecordType.Textarea:
                case RecordType.Phone:
                case RecordType.Email:
                case RecordType.Text: {
                    // todo
                    // matchers.push(new TextColumnMatcher({
                    //     name: record.name,
                    //     category: category.name,
                    //     required: false,
                    //     save(value: string, member: ImportingMember) {
                    //         if (!value) {
                    //             return;
                    //         }

                    //         const index = member.details.recordAnswers.findIndex(a => a.settings.id === record.id)
                    //         if (index !== -1) {
                    //             member.details.recordAnswers.splice(index, 1)
                    //         }

                    //         const answer = RecordTextAnswer.create({
                    //             settings: record
                    //         })
                    //         answer.value = value
                    //         member.details.recordAnswers.push(answer);
                    //     }
                    // }));
                    break;
                }
                case RecordType.Address: {
                    // todo
                    // matchers.push(new AddressColumnMatcher({
                    //     name: record.name,
                    //     category: category.name,
                    //     required: false,
                    //     save(value: Address, member: ImportingMember) {
                    //         if (!value) {
                    //             return;
                    //         }

                    //         const index = member.details.recordAnswers.findIndex(a => a.settings.id === record.id)
                    //         if (index !== -1) {
                    //             member.details.recordAnswers.splice(index, 1)
                    //         }

                    //         const answer = RecordAddressAnswer.create({
                    //             settings: record
                    //         })
                    //         answer.address = value
                    //         member.details.recordAnswers.push(answer);
                    //     }
                    // }));
                    break;
                }
                case RecordType.Date: {
                    // todo
                    // matchers.value.push(new DateColumnMatcher({
                    //     name: record.name,
                    //     category: category.name,
                    //     required: false,
                    //     save(value: Date, member: ImportingMember) {
                    //         if (!value) {
                    //             return;
                    //         }
                    //         console.log(value)

                    //         const index = member.details.recordAnswers.findIndex(a => a.settings.id === record.id)
                    //         if (index !== -1) {
                    //             member.details.recordAnswers.splice(index, 1)
                    //         }

                    //         const answer = RecordDateAnswer.create({
                    //             settings: record
                    //         })
                    //         answer.dateValue = value
                    //         member.details.recordAnswers.push(answer);
                    //     }
                    // }));
                    break;
                }
            }
        }
    }
});

const sheet = computed(() => {
    if (!sheetKey.value) {
        return null;
    }
    return sheets.value[sheetKey.value] ?? null;
});

const hasMembers = computed(() => {
    const count = patched.value.adminCategoryTree.getMemberCount({});
    return patched.value.meta.packages.useMembers && !patched.value.meta.packages.isMembersTrial && count !== null && count > 30;
});

const matcherCategories = computed(() => {
    const arr: Partial<Record<MemberDetailsMatcherCategory, { name: string; matchers: ColumnMatcher<MemberDetails>[] }>> = {};
    for (const matcher of matchers.value) {
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
            new CenteredMessage($t(`Inlezen mislukt, kijk na of dit wel een geldig bestand is`)).addCloseButton().show();
            return;
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', raw: true });

        /* DO SOMETHING WITH workbook HERE */
        const keys = Object.keys(workbook.Sheets);
        if (keys.length === 0) {
            new CenteredMessage($t('Dit bestand heeft geen werkbladen')).addCloseButton().show();
            return;
        }
        sheets.value = workbook.Sheets;
        // Vue.set(this, 'sheets', workbook.Sheets);
        file.value = newFile.name;
        sheetKey.value = keys[0];
    };

    reader.readAsArrayBuffer(newFile);

    // Clear selection
    event.target.value = null;
}

function readColumns() {
    if (!sheet.value) {
        return;
    }

    if (!sheet.value['!ref']) {
        throw new Error('Missing ref in sheet');
    }

    const range = XLSX.utils.decode_range(sheet.value['!ref']); // get the range
    const previousColumns = columns.value;
    columns.value = [];
    let skipAuto = previousColumns.length > 0;

    const availableMatchers = matchers.value.slice();

    // Read all the names + some examples and try to match them to columns
    for (let colNum = range.s.c; colNum <= range.e.c; colNum++) {
        const cell = sheet.value[XLSX.utils.encode_cell({ r: range.s.r, c: colNum })] as XLSX.CellObject;
        const columnName = (cell.w ?? cell.v ?? '') + '';
        const matched = new MatchedColumn(colNum, columnName, matchers.value);

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

        columns.value.push(matched);
    }
}

// function getColumnSelected(column: MatchedMemberDetailsColumn) {
//     return column.selected;
// }

function setColumnSelected(column: MatchedMemberDetailsColumn, value: boolean) {
    column.selected = value;

    if (value && column.matcher === null) {
        // Find best matching by default
        for (const matcher of matchers.value) {
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

function didChangeColumn(column: MatchedMemberDetailsColumn) {
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

function importData(sheet: XLSX.WorkSheet, columns: MatchedMemberDetailsColumn[]) {
    if (!sheet['!ref']) {
        throw new Error('Missing ref in sheet');
    }

    // Start! :D
    // const allMembers = await MemberManager.loadMembers([], null, null);

    const range = XLSX.utils.decode_range(sheet['!ref']); // get the range
    const result = new ImportResult<ImportMemberAccumulatedResult>();

    for (let row = range.s.r + 1; row <= range.e.r; row++) {
        // const member = new ImportingMember(row, organization);
        const accumulatedResult = new ImportMemberAccumulatedResult(patched.value);
        // const partialMemberDetails: PartialWithoutMethods<AutoEncoderPatchType<MemberDetails>> = {};
        let allEmpty = true;
        const errorStack: ImportError[] = [];

        for (const column of columns) {
            if (!column.selected) {
                continue;
            }

            if (!column.matcher) {
                throw new Error("Koppel de kolom '" + column.name + "' eerst aan een bijhorende waarde");
            }

            const valueCell = sheet[XLSX.utils.encode_cell({ r: row, c: column.index })] as XLSX.CellObject;

            if (valueCell) {
                allEmpty = false;
            }

            try {
                column.matcher.setValue(valueCell, accumulatedResult);
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

        // Clean data
        // member.details.cleanData();

        // Check if we find the same member
        // if (member.details.firstName.length > 0 && member.details.lastName.length > 0) {
        //     for (const m of allMembers) {
        //         if (member.isEqual(m)) {
        //             member.equal = m;
        //             break;
        //         }
        //     }

        //     if (!member.equal) {
        //         for (const m of allMembers) {
        //             if (member.isProbablyEqual(m)) {
        //                 member.probablyEqual = m;
        //                 break;
        //             }
        //         }
        //     }
        // }

        result.data.push(accumulatedResult);
    }

    return result;
}

const memberFetcher = useMembersObjectFetcher();

async function fetchAllMembers() {
    const initialRequest: LimitedFilteredRequest = new LimitedFilteredRequest({
        // todo: change filter?
        filter: {
            registrations: {
                $elemMatch: {
                    organizationId: organizationManager.value.organization.id,
                    // periodId: {
                    //     $in: Formatter.uniqueArray(periodIds),
                    // },
                },
            },
        },
        // todo: change limit?
        limit: 100,
    });

    return await fetchAll(initialRequest, memberFetcher);
}

async function findExistingMembers(data: ImportMemberAccumulatedResult[]) {
    const allMembers = await fetchAllMembers();
    return data.map(item => new ExistingMemberResult(item, allMembers, organizationManager.value.organization));
}

async function goNext() {
    if (!sheet.value || saving.value) {
        return;
    }

    saving.value = true;

    try {
        // todo
        const result = importData(sheet.value, columns.value);

        console.error(JSON.stringify(result));

        if (result.errors.length > 0) {
            show(new ComponentWithProperties(ImportMembersErrorsView, {
                errors: result.errors,
            })).catch(console.error);
        }
        else {
            // find equal members and possible equal members
            const results = await findExistingMembers(result.data);
            const probablyEqualResults = results.filter(r => r.isProbablyEqual);

            console.error('go next');

            if (probablyEqualResults.length) {
                show(new ComponentWithProperties(ImportVerifyProbablyEqualView, {
                    members: probablyEqualResults,
                    onVerified: (show) => {
                        show(new ComponentWithProperties(ImportMembersQuestionsView, {
                            members: results.map(m => m.toImportMemberResult()),
                        })).catch(console.error);
                    },
                })).catch(console.error);
                saving.value = false;
                return;
            }

            show(new ComponentWithProperties(ImportMembersQuestionsView, {
                members: results.map(m => m.toImportMemberResult()),
            })).catch(console.error);
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
    return await CenteredMessage.confirm($t('Ben je zeker dat je wilt sluiten zonder op te slaan?'), $t('Niet opslaan'));
}

defineExpose({
    shouldNavigateAway,
});
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

#import-members-settings-view {
    .upload-box {
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
}

</style>
