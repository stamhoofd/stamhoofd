<template>
    <div id="import-members-settings-view" class="st-view background">
        <STNavigationBar title="Leden importeren" />

        <main>
            <h1>Leden importeren</h1>
            <p>
                Upload een Excel of CSV-bestand met de leden die je wilt importeren. Een Excel-bestand is aan te bevelen
                aangezien CSV-bestanden soms voor formateringsproblemen zorgen. Zorg dat je alle kolommen een naam geeft
                en koppel hieronder de kolom met een waarde in Stamhoofd.
            </p>

            <p v-if="!hasMembers" class="warning-box">
                <span>Start je in het begin van jouw werkjaar en moeten leden sowieso allemaal (her)inschrijven? Dan
                    raden we af om eerst alle leden te importeren.
                    <a
                        :href="'https://' + $t('shared.domains.marketing') + '/docs/waarom-je-leden-beter-niet-importeert/'"
                        class="inline-link" target="_blank"
                    >Meer info</a>
                </span>
            </p>
            <STErrorsDefault :error-box="errorBox" />

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
                <input
                    type="file" multiple style="display: none;"
                    accept=".xlsx, .xls, .csv, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    @change="changedFile"
                >
                <span v-if="file" class="icon sync gray" />
            </label>

            <template v-if="sheetSelectionList.length > 1">
                <STInputBox title="Werkblad" error-fields="sheet" :error-box="errorBox">
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
                            <Checkbox
                                :model-value="getColumnSelected(column)"
                                @update:model-value="setColumnSelected(column, $event)"
                            >
                                <h2 class="style-title-list">
                                    {{ column.name }}
                                </h2>
                                <p v-if="column.examples.length > 0" class="style-description-small">
                                    {{ column.examples.slice(0, 2).join(', ') }}...
                                </p>
                            </Checkbox>
                        </td>
                        <td>
                            <Dropdown v-model="column.matcherCode" @update:model-value="didChangeColumn(column)">
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
                Het is aan te bevelen om ook de geboortedatum van leden toe te voegen. Op die manier kunnen we met
                zekerheid
                detecteren of een lid al bestaat in het systeem, en dan kunnen we de informatie met elkaar combineren
                i.p.v. een
                nieuw lid aan te maken.
            </p>

            <STErrorsDefault :error-box="errorBox" />
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="saving">
                    <button
                        class="button primary" :disabled="!file || columns.length == 0 || rowCount === 0"
                        type="button" @click="goNext"
                    >
                        Volgende
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import { AutoEncoder, AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin, useShow } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, Dropdown, ErrorBox, LoadingButton, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, useOrganization } from "@stamhoofd/components";
import { Address, Organization, OrganizationPatch, RecordAddressAnswer, RecordDateAnswer, RecordSettings, RecordTextAnswer, RecordType } from "@stamhoofd/structures";
import XLSX from "xlsx";
import { allMatchers } from "../../../../../classes/import/defaultMatchers";
import { ImportingMember } from "../../../../../classes/import/ImportingMember";
import { MatchedColumn } from "../../../../../classes/import/MatchedColumn";
import { MatcherCategory } from '../../../../../classes/import/MatcherCategory';
import { AddressColumnMatcher, DateColumnMatcher, TextColumnMatcher } from "../../../../../classes/import/matchers";
import ImportMembersErrorsView from './ImportMembersErrorsView.vue';
import ImportMembersQuestionsView from './ImportMembersQuestionsView.vue';
import ImportVerifyProbablyEqualView from './ImportVerifyProbablyEqualView.vue';
import { onMounted, ref, computed, Ref } from 'vue'
import { useLegacyMemberManager } from '@stamhoofd/registration';

const organization = useOrganization();
const memberManager = useLegacyMemberManager();
const show = useShow();
const errorBox: Ref<ErrorBox | null> = ref(null);
const saving = ref(false);
const file = ref<string | null>(null);
const organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({})

let rowCount = 0
let columnCount = 0

const sheets = ref<Record<string, XLSX.WorkSheet>>({});
const internalSheetKey = ref<string | null>(null);

const matchers = ref<typeof allMatchers>(allMatchers.slice());
const columns = ref<MatchedColumn[]>([]);

//#region created
/**
* Because setup is run around the beforeCreate and created lifecycle hooks, you do not need to explicitly define them
*/
if (organization.value !== null)
    organizationPatch.id = organization.value.id;
//#endregion

const sheetKey = computed<string | null>(() => internalSheetKey.value);

const sheet = computed(() => {
    const key = sheetKey.value;
    if (!key) {
        return null
    }
    return sheets.value[key] ?? null;
});

function setSheetKey(key: string | null) {
    if (key === null) {
        internalSheetKey.value = null
        columns.value = []
        rowCount = 0
        columnCount = 0
        return
    }

    const sheet = sheets.value[key]
    if (!sheet) {
        return
    }

    if (!sheet['!ref']) {
        throw new Error("Missing ref in sheet")
    }
    const range = XLSX.utils.decode_range(sheet['!ref']); // get the range
    rowCount = range.e.r + 1
    columnCount = range.e.c + 1
    internalSheetKey.value = key
    readColumns()
}

const sheetSelectionList = computed(() => Object.keys(sheets.value));
const hasMembers = computed(() => {
    const organizationValue = organization.value;
    if (organizationValue === null) return false;
    const packages = organizationValue.meta.packages;
    const count = organizationValue.adminCategoryTree.getMemberCount({})
    return packages.useMembers && packages.isMembersTrial && count !== null && count > 30
});

const matcherCategories = computed(() => {
    const arr: Record<string, { name: string, matchers: (typeof allMatchers) }> = {}
    for (const m of matchers.value) {
        const matcher = m as typeof allMatchers[0];
        const cat = matcher.category.toLowerCase()
        if (arr[cat]) {
            arr[cat].matchers.push(matcher)
        } else {
            arr[cat] = {
                name: matcher.category,
                matchers: [matcher]
            }
        }
    }
    return Object.values(arr)
});


type RecordAnswerType<R> = R extends RecordAddressAnswer ? typeof RecordAddressAnswer : R extends RecordTextAnswer ? typeof RecordTextAnswer : R extends RecordDateAnswer ? typeof RecordDateAnswer : never;
type RecordAnswerChild = RecordAddressAnswer | RecordTextAnswer | RecordDateAnswer;

function saveRecordAnswerValue<R extends RecordAnswerChild, P extends keyof R>(
    recordAnswer: RecordAnswerType<R>,
    member: ImportingMember,
    record: RecordSettings,
    property: P,
    value: R[P] | null | undefined) {
    if (value === null || value === undefined) {
        console.error(`Update failed: value is ${typeof value}.`);
        return;
    }

    const answer = recordAnswer.create({
        settings: record
    }) as R;

    answer[property] = value;
    member.details.recordAnswers.set(answer.id, answer);
}

onMounted(() => {
    matchers.value = allMatchers.slice()

    // If parents are disabled, remove all parent categories
    if (organization.value === null) {
        console.error('Organization is null.')
        return;
    }

    if (organization.value.meta.recordsConfiguration.parents === null) {
        matchers.value = matchers.value.filter(m => m.category !== MatcherCategory.Parent1 && m.category !== MatcherCategory.Parent2)
    }

    // Include all custom fields
    for (const category of organization.value.meta.recordsConfiguration.recordCategories) {
        for (const record of category.getAllRecords()) {
            switch (record.type) {
                case RecordType.Textarea:
                case RecordType.Phone:
                case RecordType.Email:
                case RecordType.Text: {
                    matchers.value.push(new TextColumnMatcher({
                        name: record.name,
                        category: category.name,
                        required: false,
                        save(value: string, member: ImportingMember) {
                            saveRecordAnswerValue<RecordTextAnswer, 'value'>(RecordTextAnswer, member, record, 'value', value);
                        }
                    }));
                    break;
                }
                case RecordType.Address: {
                    matchers.value.push(new AddressColumnMatcher({
                        name: record.name,
                        category: category.name,
                        required: false,
                        save(value: Address, member: ImportingMember) {
                            saveRecordAnswerValue<RecordAddressAnswer, 'address'>(RecordAddressAnswer, member, record, 'address', value);
                        }
                    }));
                    break;
                }
                case RecordType.Date: {
                    matchers.value.push(new DateColumnMatcher({
                        name: record.name,
                        category: category.name,
                        required: false,
                        save(value: Date, member: ImportingMember) {
                            saveRecordAnswerValue<RecordDateAnswer, 'dateValue'>(RecordDateAnswer, member, record, 'dateValue', value);
                        }
                    }));
                    break;
                }
            }
        }
    }
});

function changedFile(event: Event) {
    function isFileEvent(event: Event): event is (Event & { target?: EventTarget & { files: FileList, value: null } }) {
        return Boolean((event as any)?.target?.files?.length);
    }

    if(!isFileEvent(event)) {
        return;
    }

    file.value = null

    const files = event.target.files as FileList
    const firstFile = files[0]

    const reader = new FileReader();
    reader.onload = (e) => {
        if (!e.target || !e.target.result) {
            new CenteredMessage("Inlezen mislukt, kijk na of dit wel een geldig bestand is").addCloseButton().show()
            return
        }
        const data = new Uint8Array(e.target.result as any);
        const workbook = XLSX.read(data, { type: 'array', raw: true });

        /* DO SOMETHING WITH workbook HERE */
        const keys = Object.keys(workbook.Sheets)
        if (keys.length === 0) {
            new CenteredMessage("Dit bestand heeft geen werkbladen").addCloseButton().show()
            return
        }
        sheets.value = workbook.Sheets
        file.value = firstFile.name;
        setSheetKey(keys[0]);
    };
    reader.readAsArrayBuffer(firstFile);

    // Clear selection
    event.target.value = null;
}

function readColumns() {
    if (!sheet.value) {
        return
    }

    const sheetRef = sheet.value['!ref'];

    if (!sheetRef) {
        throw new Error("Missing ref in sheet")
    }

    const range = XLSX.utils.decode_range(sheetRef); // get the range
    const previousColumns = columns.value
    columns.value = []
    let skipAuto = previousColumns.length > 0

    const availableMatchers = matchers.value.slice()

    // Read all the names + some examples and try to match them to columns
    for (let colNum = range.s.c; colNum <= range.e.c; colNum++) {
        const cell = sheet.value[XLSX.utils.encode_cell({ r: range.s.r, c: colNum })] as XLSX.CellObject
        const columnName = (cell.w ?? cell.v ?? "") + ""
        const matched = new MatchedColumn(colNum, columnName, matchers.value)

        for (let row = range.s.r + 1; row <= range.e.r && row < 10; row++) {
            const valueCell = sheet.value[XLSX.utils.encode_cell({ r: row, c: colNum })]

            if (!valueCell) {
                continue
            }
            matched.examples.push((valueCell.w ?? valueCell.v ?? "") + "")
        }

        const previous = previousColumns.find(c => c.name === columnName)
        if (previous) {
            const uptodateMatcher = availableMatchers.find(m => m.id === previous.matcherCode)
            if (uptodateMatcher) {
                skipAuto = true;
                matched.matcher = uptodateMatcher
                matched.selected = true
                availableMatchers.splice(availableMatchers.indexOf(uptodateMatcher), 1)
            }
        }

        if (!matched.matcher && !skipAuto) {
            for (const [index, matcher] of availableMatchers.entries()) {

                if (matcher.doesMatch(columnName, matched.examples)) {
                    availableMatchers.splice(index, 1)

                    matched.matcher = matcher
                    matched.selected = true
                    break
                }
            }
        }

        columns.value.push(matched)
    }
}

function getColumnSelected(column: MatchedColumn) {
    return column.selected
}

function setColumnSelected(column: MatchedColumn, value: boolean) {
    column.selected = value

    if (value && column.matcher === null) {
        // Find best matching by default
        for (const matcher of matchers.value) {
            // Not yet used
            if (columns.value.find(c => c.matcher?.id === matcher.id)) {
                continue
            }
            if (matcher.doesMatch(column.name, column.examples)) {
                column.matcher = matcher
                break
            }
        }
    }

    if (!value) {
        column.matcher = null
    }
}

function didChangeColumn(column: MatchedColumn) {
    if (column.matcher === null) {
        return
    }

    column.selected = true
    // Check if others have the same matcher, then clear those
    for (const col of columns.value) {
        if (col === column) {
            continue
        }
        if (col.matcherCode === column.matcherCode) {
            col.matcher = null
            col.selected = false
        }
    }
}

async function goNext() {
    if (!sheet.value || saving.value) {
        return
    }

    saving.value = true

    if (!organization.value) {
        console.error("Organization not set.");
        return;
    }

    try {

        const result = await ImportingMember.importAll(sheet.value, columns.value, memberManager, organization.value)

        if (result.errors.length > 0) {
            await show(new ComponentWithProperties(ImportMembersErrorsView, {
                errors: result.errors
            }))
        } else {
            const probablyEqual = result.members.filter(m => !m.equal && m.probablyEqual)
            if (probablyEqual.length) {
                await show(new ComponentWithProperties(ImportVerifyProbablyEqualView, {
                    members: probablyEqual,
                    onVerified: (component: typeof NavigationMixin) => {
                        component.show(new ComponentWithProperties(ImportMembersQuestionsView, {
                            members: result.members
                        }))
                    }
                }))
                saving.value = false
                return
            }

            await show(new ComponentWithProperties(ImportMembersQuestionsView, {
                members: result.members
            }))
        }
    } catch (e: any) {
        console.error(e);
        errorBox.value = new ErrorBox(e);
    }

    saving.value = false
}
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

        >.icon:first-child {
            padding-right: 20px;
            flex-shrink: 0;
        }

        >.icon:last-child {
            padding-left: 20px;
            flex-shrink: 0;
            margin-left: auto;
        }
    }
}
</style>
