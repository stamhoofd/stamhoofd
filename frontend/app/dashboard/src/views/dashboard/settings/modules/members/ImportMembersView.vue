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
                <input type="file" multiple="multiple" style="display: none;" accept=".xlsx, .xls, .csv, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" @change="changedFile">
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
                            <Checkbox :checked="getColumnSelected(column)" @change="setColumnSelected(column, $event)">
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
                Het is aan te bevelen om ook de geboortedatum van leden toe te voegen. Op die manier kunnen we met zekerheid detecteren of een lid al bestaat in het systeem, en dan kunnen we de informatie met elkaar combineren i.p.v. een nieuw lid aan te maken.
            </p>

            <STErrorsDefault :error-box="errorBox" />
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

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, CenteredMessage, Checkbox, Dropdown, ErrorBox, LoadingButton, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, Toast, Validator } from "@stamhoofd/components";
import { Address, Organization, OrganizationPatch, RecordAddressAnswer, RecordDateAnswer, RecordTextAnswer, RecordType } from "@stamhoofd/structures";
import { Component, Mixins, Vue } from "vue-property-decorator";
import XLSX from "xlsx";

import { allMatchers } from "../../../../../classes/import/defaultMatchers";
import { ImportingMember } from "../../../../../classes/import/ImportingMember";
import { MatchedColumn } from "../../../../../classes/import/MatchedColumn";
import { MatcherCategory } from '../../../../../classes/import/MatcherCategory';
import { AddressColumnMatcher, DateColumnMatcher,TextColumnMatcher } from "../../../../../classes/import/matchers";

import ImportMembersErrorsView from './ImportMembersErrorsView.vue';
import ImportMembersQuestionsView from './ImportMembersQuestionsView.vue';
import ImportVerifyProbablyEqualView from './ImportVerifyProbablyEqualView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        Checkbox,
        BackButton,
        LoadingButton,
        Dropdown
    },
})
export default class ImportMembersView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false
    file: null | string = null
    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({ id: this.$organization.id })

    rowCount = 0
    columnCount = 0

    sheets: Record<string, XLSX.WorkSheet> = {}
    internalSheetKey: string | null = null

    matchers = allMatchers.slice()
    columns: MatchedColumn[] = []

    mounted() {
        this.matchers = allMatchers.slice()

        // If parents are disabled, remove all parent categories
        if (this.organization.meta.recordsConfiguration.parents === null) {
            this.matchers = this.matchers.filter(m => m.category !== MatcherCategory.Parent1 && m.category !== MatcherCategory.Parent2)
        }

        // Include all custom fields
        for (const category of this.organization.meta.recordsConfiguration.recordCategories) {
            for (const record of category.getAllRecords()) {
                switch (record.type) {
                    case RecordType.Textarea:
                    case RecordType.Phone: 
                    case RecordType.Email: 
                    case RecordType.Text: {
                        this.matchers.push(new TextColumnMatcher({
                            name: record.name,
                            category: category.name,
                            required: false,
                            save(value: string, member: ImportingMember) {
                                if (!value) {
                                    return;
                                }

                                const index = member.details.recordAnswers.findIndex(a => a.settings.id === record.id)
                                if (index !== -1) {
                                    member.details.recordAnswers.splice(index, 1)
                                }

                                const answer = RecordTextAnswer.create({
                                    settings: record
                                })
                                answer.value = value
                                member.details.recordAnswers.push(answer);
                            }
                        }));
                        break;
                    }
                    case RecordType.Address: {
                        this.matchers.push(new AddressColumnMatcher({
                            name: record.name,
                            category: category.name,
                            required: false,
                            save(value: Address, member: ImportingMember) {
                                if (!value) {
                                    return;
                                }

                                const index = member.details.recordAnswers.findIndex(a => a.settings.id === record.id)
                                if (index !== -1) {
                                    member.details.recordAnswers.splice(index, 1)
                                }

                                const answer = RecordAddressAnswer.create({
                                    settings: record
                                })
                                answer.address = value
                                member.details.recordAnswers.push(answer);
                            }
                        }));
                        break;
                    }
                    case RecordType.Date: {
                        this.matchers.push(new DateColumnMatcher({
                            name: record.name,
                            category: category.name,
                            required: false,
                            save(value: Date, member: ImportingMember) {
                                if (!value) {
                                    return;
                                }
                                console.log(value)

                                const index = member.details.recordAnswers.findIndex(a => a.settings.id === record.id)
                                if (index !== -1) {
                                    member.details.recordAnswers.splice(index, 1)
                                }

                                const answer = RecordDateAnswer.create({
                                    settings: record
                                })
                                answer.dateValue = value
                                member.details.recordAnswers.push(answer);
                            }
                        }));
                        break;
                    }
                }
            }
        }
    }

    get sheet() {
        if (!this.sheetKey) {
            return null
        }
        return this.sheets[this.sheetKey] ?? null
    }

    get sheetKey() {
        return this.internalSheetKey
    }
    
    set sheetKey(key: string | null) {
        if (key === null) {
            this.internalSheetKey = null
            this.columns = []
            this.rowCount = 0
            this.columnCount = 0
            return
        }

        const sheet = this.sheets[key]
        if (!sheet) {
            return
        }

        if (!sheet['!ref']) {
            throw new Error("Missing ref in sheet")
        }
        const range = XLSX.utils.decode_range(sheet['!ref']); // get the range
        this.rowCount = range.e.r + 1
        this.columnCount = range.e.c + 1
        this.internalSheetKey = key
        this.readColumns()
    }

    get sheetSelectionList() {
        return Object.keys(this.sheets)
    }

    get organization() {
        return this.$organization.patch(this.organizationPatch)
    }

    get hasMembers() {
        const count = this.organization.adminCategoryTree.getMemberCount({})
        return this.organization.meta.packages.useMembers && !this.organization.meta.packages.isMembersTrial && count !== null && count > 30
    }

    get matcherCategories() {
        const arr = {}
        for (const matcher of this.matchers) {
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
    }

    async shouldNavigateAway() {
        if (!this.file) {
            return true;
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    changedFile(event) {
        if (!event.target.files || event.target.files.length == 0) {
            return;
        }

        this.file = null

        const files = event.target.files as FileList
        const file = files[0]

        const reader = new FileReader();
        reader.onload = (e) => {
            if (!e.target || !e.target.result) {
                new CenteredMessage("Inlezen mislukt, kijk na of dit wel een geldig bestand is").addCloseButton().show()
                return
            }
            const data = new Uint8Array(e.target.result as any);
            const workbook = XLSX.read(data, {type: 'array', raw: true });

            /* DO SOMETHING WITH workbook HERE */
            const keys = Object.keys(workbook.Sheets)
            if (keys.length === 0) {
                new CenteredMessage("Dit bestand heeft geen werkbladen").addCloseButton().show()
                return
            }
            this.sheets = workbook.Sheets
            this.file = file.name
            this.sheetKey = keys[0]
        };
        reader.readAsArrayBuffer(file);
        
        // Clear selection
        event.target.value = null;
    }

    readColumns() {
        if (!this.sheet) {
            return
        }

        if (!this.sheet['!ref']) {
            throw new Error("Missing ref in sheet")
        }

        const range = XLSX.utils.decode_range(this.sheet['!ref']); // get the range
        const previousColumns = this.columns
        this.columns = []
        let skipAuto = previousColumns.length > 0

        const availableMatchers = this.matchers.slice()

        // Read all the names + some examples and try to match them to columns
        for(let colNum = range.s.c; colNum <= range.e.c; colNum++){
            const cell = this.sheet[XLSX.utils.encode_cell({r: range.s.r, c: colNum})] as XLSX.CellObject
            const columnName = (cell.w ?? cell.v ?? "")+""
            const matched = new MatchedColumn(colNum, columnName, this.matchers)

            for(let row = range.s.r + 1; row <= range.e.r && row < 10; row++){
                const valueCell = this.sheet[XLSX.utils.encode_cell({r: row, c: colNum})]

                if (!valueCell) {
                    continue
                }
                matched.examples.push((valueCell.w ?? valueCell.v ?? "")+"")
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

            this.columns.push(matched)
        }
    }

    getColumnSelected(column: MatchedColumn) {
        return column.selected
    }

    setColumnSelected(column: MatchedColumn, value: boolean) {
        column.selected = value

        if (value && column.matcher === null) {
            // Find best matching by default
            for (const matcher of this.matchers) {
                // Not yet used
                if (this.columns.find(c => c.matcher?.id === matcher.id)) {
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

    didChangeColumn(column: MatchedColumn) {
        if (column.matcher === null) {
            return
        }

        column.selected = true
        // Check if others have the same matcher, then clear those
        for (const col of this.columns) {
            if (col === column) {
                continue
            }
            if (col.matcherCode === column.matcherCode) {
                col.matcher = null
                col.selected = false
            }
        }
    }

    async goNext() {
        if (!this.sheet || this.saving) {
            return
        }

        this.saving = true

        try {
            const result = await ImportingMember.importAll(this.sheet, this.columns, this.$memberManager, this.organization)

            if (result.errors.length > 0) {
                this.show(new ComponentWithProperties(ImportMembersErrorsView, {
                    errors: result.errors
                }))
            } else {
                const probablyEqual = result.members.filter(m => !m.equal && m.probablyEqual)
                if (probablyEqual.length) {
                    this.show(new ComponentWithProperties(ImportVerifyProbablyEqualView, {
                        members: probablyEqual,
                        onVerified: (component) => {
                            component.show(new ComponentWithProperties(ImportMembersQuestionsView, {
                                members: result.members
                            }))
                        }
                    }))
                    this.saving = false 
                    return
                }

                this.show(new ComponentWithProperties(ImportMembersQuestionsView, {
                    members: result.members
                }))
            }
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }

        this.saving = false 
    }
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
