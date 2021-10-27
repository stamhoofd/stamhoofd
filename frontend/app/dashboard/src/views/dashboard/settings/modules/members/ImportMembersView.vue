<template>
    <div id="import-members-settings-view" class="st-view background">
        <STNavigationBar title="Leden importeren">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-else slot="right" class="button icon close gray" @click="pop" />
        </STNavigationBar>

        <main>
            <h1>Leden importeren</h1>
            <p>
                Upload een Excel of CSV-bestand met de leden die je wilt importeren. Een Excel-bestand is aan te bevelen aangezien CSV-bestanden soms voor formateringsproblemen zorgen. Zorg dat je alle kolommen een naam geeft en koppel hieronder de kolom met een waarde in Stamhoofd.
            </p>

            <p class="info-box">
                Problemen, suggesties of vragen? Stuur een mailtje naar {{ $t('shared.emails.general') }} en we helpen je graag verder.
            </p>

            <label class="upload-box">
                <span v-if="!file" class="icon upload" />
                <span v-else class="icon file" />
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
                            <Checkbox v-model="column.selected">
                                <h2 class="style-title-list">
                                    {{ column.name }}
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
                                <optgroup v-for="cat in matcherCategories" :key="cat.name" :label="getCategoryName(cat.name)">
                                    <option v-for="(matcher, index) in cat.matchers" :key="index" :value="matcher.id">
                                        {{ matcher.getName() }} ({{ getCategoryName(cat.name) }})
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
            <template slot="right">
                <LoadingButton :loading="saving">
                    <button class="button primary" :disabled="!file || columns.length == 0 || rowCount === 0" @click="goNext">
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
import { BackButton, CenteredMessage, Checkbox, Dropdown,ErrorBox, LoadingButton, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components";
import { Organization, OrganizationPatch } from "@stamhoofd/structures"
import { Component, Mixins } from "vue-property-decorator";
import XLSX from "xlsx";

import { ImportingMember } from "../../../../../classes/import/ImportingMember"
import { MatchedColumn } from "../../../../../classes/import/MatchedColumn"
import { MatcherCategory, MatcherCategoryHelper } from '../../../../../classes/import/MatcherCategory';
import { allMathcers } from "../../../../../classes/import/matchers"
import { OrganizationManager } from "../../../../../classes/OrganizationManager"
import ImportMembersErrorsView from './ImportMembersErrorsView.vue';
import ImportMembersQuestionsView from './ImportMembersQuestionsView.vue';

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
    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({ id: OrganizationManager.organization.id })

    rowCount = 0
    columnCount = 0

    sheet: XLSX.WorkSheet | null = null

    matchers = allMathcers
    columns: MatchedColumn[] = []

    get organization() {
        return OrganizationManager.organization.patch(this.organizationPatch)
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

    getCategoryName(category: MatcherCategory) {
        return MatcherCategoryHelper.getName(category)
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

        /*for (const file of event.target.files as FileList) {
            this.files.push(new TmpFile(file.name, file))
        }*/

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
            if (keys.length != 1) {
                new CenteredMessage("Dit bestand heeft meer dan één werkblad, verwijder de werkbladen die we niet moeten importeren.").addCloseButton().show()
                return
            }

            const sheet = workbook.Sheets[keys[0]]

            if (!sheet['!ref']) {
                throw new Error("Missing ref in sheet")
            }
            const range = XLSX.utils.decode_range(sheet['!ref']); // get the range
            this.rowCount = range.e.r + 1
            this.columnCount = range.e.c + 1

            this.file = file.name
            this.sheet = sheet

            this.readColumns()
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
        this.columns = []

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

            for (const [index, matcher] of availableMatchers.entries()) {
                if (matcher.doesMatch(columnName, matched.examples)) {
                    availableMatchers.splice(index, 1)

                    matched.matcher = matcher
                    matched.selected = true
                    break
                }
            }

            this.columns.push(matched)
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
            const result = await ImportingMember.importAll(this.sheet, this.columns, this.organization)

            if (result.errors.length > 0) {
                this.show(new ComponentWithProperties(ImportMembersErrorsView, {
                    errors: result.errors
                }))
            } else {
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
        background: $color-white-shade;
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
            background-color: $color-gray-lighter;
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

    .data-table {


        select.input {
            width: auto;
        }
    }
}

</style>
