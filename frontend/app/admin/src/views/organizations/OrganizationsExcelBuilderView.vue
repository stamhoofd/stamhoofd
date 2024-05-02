<template>
    <div class="st-view">
        <STNavigationBar title="Exporteren naar Excel" />

        <main>
            <h1>
                Exporteren naar Excel
            </h1>
            <p>Exporteer de gegevens van de geselecteerde verenigingen naar een Excel-bestand. Kies hieronder welke gegevens je wilt opnemen in het bestand.</p>

            <STErrorsDefault :error-box="errorBox" />
            
            <div v-for="(group, index) of propertyGroups" :key="index" class="container">
                <hr>
                <h2 class="style-with-button">
                    <div>{{ group.name }}</div>
                    <div>
                        <button v-if="group.selected" class="button text" type="button" @click="group.selected = false">
                            Deselecteren
                        </button>
                        <button v-else class="button text" type="button" @click="group.selected = true">
                            Selecteren
                        </button>
                    </div>
                </h2>
                <p v-if="group.description !== undefined" v-text="group.description" />

                <STList>
                    <STListItem v-for="(property, i) of group.properties" :key="i" :selectable="true" element-name="label">
                        <template #left>
                            <Checkbox v-model="property.selected" />
                        </template>
                        <h3 class="style-title-list">
                            {{ property.name }}
                        </h3>
                        <p v-if="property.description !== undefined" class="style-description-small">
                            {{ property.description }}
                        </p>
                    </STListItem>
                </STList>
            </div>
        </main>

        
        <STToolbar>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="button" @click="exportExcel">
                        <span class="icon download" />
                        <span v-if="!$isNative">Exporteren</span>
                        <span v-else>Opslaan</span>
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox, ErrorBox, LoadingButton, SegmentedControl, STErrorsDefault, STList, STListItem, STNavigationBar, STNavigationTitle, STToolbar, TooltipDirective } from "@stamhoofd/components";
import { AppManager } from "@stamhoofd/networking";
import { Address, Gender, OrganizationOverview, ParentTypeHelper } from '@stamhoofd/structures';
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";
import XLSX from "xlsx";

class ExcelMemberPropertyGroup {
    name: string;
    description?: string
    properties: ExcelMemberProperty[];

    constructor(name: string, description: string | undefined, properties: ExcelMemberProperty[]) {
        this.name = name;
        this.description = description;
        this.properties = properties;
    }

    get selected() {
        return !this.properties.find(p => !p.selected)
    }

    set selected(selected: boolean) {
        for (const p of this.properties) {
            p.selected = selected;
        }
    }
}

/**
 * Properties that are displayed per organization
 */
class ExcelMemberProperty {
    selected = false

    name = ""
    width = 10
    getValue: (organization: OrganizationOverview) => any
    format?: string
    description?: string

    constructor(settings: {
        name: string, 
        selected?: boolean,
        getValue: (organization: OrganizationOverview) => any,
        format?: string,
        width?: number,
        description?: string
    }) {
        this.name = settings.name
        this.selected = settings.selected ?? false
        this.getValue = settings.getValue
        this.format = settings.format
        this.width = settings.width ?? 10
        this.description = settings.description
    }
}

@Component({
    components: {
        STNavigationBar,
        STNavigationTitle,
        SegmentedControl,
        STToolbar,
        BackButton,
        LoadingButton,
        STErrorsDefault,
        Checkbox,
        STList,
        STListItem
    },
    directives: {
        tooltip: TooltipDirective
    }
})
export default class OrganizationsExcelBuilderView extends Mixins(NavigationMixin) {
    loading = false
    errorBox: ErrorBox | null = null

    @Prop()
    organizations!: OrganizationOverview[];

    propertyGroups: ExcelMemberPropertyGroup[] = [
        new ExcelMemberPropertyGroup("Gegevens", undefined, [
            new ExcelMemberProperty({
                name: "Naam",
                getValue: (organization: OrganizationOverview) => organization.name,
                width: 15,
                selected: true
            }),
            new ExcelMemberProperty({
                name: "Aantal leden",
                getValue: (organization: OrganizationOverview) => organization.stats.memberCount,
                width: 15,
                selected: true
            })
        ]),
        new ExcelMemberPropertyGroup("Adres", "Adres van de vereniging", [
            new ExcelMemberProperty({
                name: "Straat",
                getValue: (organization: OrganizationOverview) => organization.address.street,
                width: 30,
            }),
            new ExcelMemberProperty({
                name: "Huisnummer",
                getValue: (organization: OrganizationOverview) => organization.address.number,
                width: 10,
            }),
            new ExcelMemberProperty({
                name: "Postcode",
                getValue: (organization: OrganizationOverview) => organization.address.postalCode,
                width: 10,
            }),
            new ExcelMemberProperty({
                name: "Gemeente",
                getValue: (organization: OrganizationOverview) => organization.address.city,
                width: 20,
            }),
            new ExcelMemberProperty({
                name: "Land",
                getValue: (organization: OrganizationOverview) => organization.address.country,
                width: 10,
            }),
        ]),
        new ExcelMemberPropertyGroup("Beheerder 1", "Gegevens van de eerste hoofdbeheerder", [
            new ExcelMemberProperty({
                name: "Voornaam",
                getValue: (organization: OrganizationOverview) => organization.fullAccessAdmins[0]?.firstName ?? "",
                width: 30,
            }),
            new ExcelMemberProperty({
                name: "Achternaam",
                getValue: (organization: OrganizationOverview) => organization.fullAccessAdmins[0]?.lastName ?? "",
                width: 30,
            }),
            new ExcelMemberProperty({
                name: "E-mailadres",
                getValue: (organization: OrganizationOverview) => organization.fullAccessAdmins[0]?.email ?? "",
                width: 30,
            }),
        ]),

        new ExcelMemberPropertyGroup("Beheerder 2", "Gegevens van de tweede hoofdbeheerder", [
            new ExcelMemberProperty({
                name: "Voornaam",
                getValue: (organization: OrganizationOverview) => organization.fullAccessAdmins[1]?.firstName ?? "",
                width: 30,
            }),
            new ExcelMemberProperty({
                name: "Achternaam",
                getValue: (organization: OrganizationOverview) => organization.fullAccessAdmins[1]?.lastName ?? "",
                width: 30,
            }),
            new ExcelMemberProperty({
                name: "E-mailadres",
                getValue: (organization: OrganizationOverview) => organization.fullAccessAdmins[1]?.email ?? "",
                width: 30,
            }),
        ]),

        new ExcelMemberPropertyGroup("Beheerder 3", "Gegevens van de derde hoofdbeheerder", [
            new ExcelMemberProperty({
                name: "Voornaam",
                getValue: (organization: OrganizationOverview) => organization.fullAccessAdmins[2]?.firstName ?? "",
                width: 30,
            }),
            new ExcelMemberProperty({
                name: "Achternaam",
                getValue: (organization: OrganizationOverview) => organization.fullAccessAdmins[2]?.lastName ?? "",
                width: 30,
            }),
            new ExcelMemberProperty({
                name: "E-mailadres",
                getValue: (organization: OrganizationOverview) => organization.fullAccessAdmins[2]?.email ?? "",
                width: 30,
            }),
        ]),

        new ExcelMemberPropertyGroup("Beheerder 4", "Gegevens van de vierde hoofdbeheerder", [
            new ExcelMemberProperty({
                name: "Voornaam",
                getValue: (organization: OrganizationOverview) => organization.fullAccessAdmins[3]?.firstName ?? "",
                width: 30,
            }),
            new ExcelMemberProperty({
                name: "Achternaam",
                getValue: (organization: OrganizationOverview) => organization.fullAccessAdmins[3]?.lastName ?? "",
                width: 30,
            }),
            new ExcelMemberProperty({
                name: "E-mailadres",
                getValue: (organization: OrganizationOverview) => organization.fullAccessAdmins[3]?.email ?? "",
                width: 30,
            }),
        ]),
    ];

    async exportExcel() {
        if (this.loading) {
            return;
        }
        this.loading = true;
        this.errorBox = null;

        try {
            await this.export(this.propertyGroups.flatMap(g => g.properties.filter(p => p.selected)), this.organizations)
        } catch (e: unknown) {
            console.error(e)
            if (e instanceof Error) {
                this.errorBox = new ErrorBox(e)
            }
        }
      
        this.loading = false
       
    }

    formatColumn(colNum: number, fmt: string, worksheet: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        for(let i = range.s.r + 1; i <= range.e.r; ++i) {
            /* find the data cell (range.s.r + 1 skips the header row of the worksheet) */
            const ref = XLSX.utils.encode_cell({r:i, c:colNum});
            /* if the particular row did not contain data for the column, the cell will not be generated */
            if(!worksheet[ref]) continue;
            /* `.t == "n"` for number cells */
            if(worksheet[ref].t != 'n') continue;
            /* assign the `.z` number format */
            worksheet[ref].z = fmt;
        }
    }

    async export(columns: ExcelMemberProperty[], members: OrganizationOverview[]) {
        const wsName = "Leden";
        const wb = XLSX.utils.book_new();

        /* make worksheet */
        const wsData: any[][] = [
            columns.map(c => c.name),
        ];

        for (const organization of members) {
            wsData.push(columns.map(c => c.getValue(organization)))
        }

        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Set column width
        ws['!cols'] = []
        for (const [index, column] of columns.entries()) {
            ws['!cols'].push({width: column.width});
            if (column.format) {
                this.formatColumn(index, column.format, ws)
            }
        }

        /* Add the worksheet to the workbook */
        XLSX.utils.book_append_sheet(wb, ws, wsName);

        const fileName = Formatter.fileSlug("Verenigingen")

        if (AppManager.shared.downloadFile) {
            const data = XLSX.write(wb, { type: 'base64' });
            await AppManager.shared.downloadFile(data, fileName+".xlsx")
        } else {
            XLSX.writeFile(wb, fileName+".xlsx");
        }
    }

}
</script>