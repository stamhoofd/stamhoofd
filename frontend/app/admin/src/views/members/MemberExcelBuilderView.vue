<template>
    <div class="st-view">
        <STNavigationBar title="Exporteren naar Excel" />

        <main>
            <h1>
                Exporteren naar Excel
            </h1>
            <p>Exporteer de gegevens van de geselecteerde leden naar een Excel-bestand. Kies hieronder welke gegevens je wilt opnemen in het bestand.</p>

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
import { Address, Gender, Group, MemberSummary, ParentTypeHelper } from '@stamhoofd/structures';
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
 * Properties that are displayed per member
 */
class ExcelMemberProperty {
    selected = false

    name = ""
    width = 10
    getValue: (member: MemberSummary) => any
    format?: string
    description?: string

    constructor(settings: {
        name: string, 
        selected?: boolean,
        getValue: (member: MemberSummary) => any,
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
export default class MemberExcelBuilderView extends Mixins(NavigationMixin) {
    loading = false
    errorBox: ErrorBox | null = null

    @Prop()
    members!: MemberSummary[];

    propertyGroups: ExcelMemberPropertyGroup[] = [
        new ExcelMemberPropertyGroup("Persoonsgegevens", undefined, [
            new ExcelMemberProperty({
                name: "Voornaam",
                getValue: (member: MemberSummary) => member.firstName,
                width: 15,
                selected: true
            }),
            new ExcelMemberProperty({
                name: "Achternaam",
                getValue: (member: MemberSummary) => member.lastName,
                width: 15,
                selected: true
            }),
            new ExcelMemberProperty({
                name: "Geboortedatum",
                getValue: (member: MemberSummary) => member.birthDay ?? "",
                width: 15
            }),
            new ExcelMemberProperty({
                name: "Geslacht",
                getValue: (member: MemberSummary) => member.gender === Gender.Male ? "Man" : (member.gender === Gender.Female ? "Vrouw" : ""),
                width: 10
            }),
            new ExcelMemberProperty({
                name: "GSM-nummer",
                getValue: (member: MemberSummary) => member.phone ?? "",
                width: 20,
                description: "GSM-nummer van lid zelf, niet van een ouder"
            }),
            new ExcelMemberProperty({
                name: "E-mailadres",
                getValue: (member: MemberSummary) => member.email ?? "",
                width: 30,
                description: "E-mailadres van lid zelf, niet van een ouder"
            }),
        ]),
        new ExcelMemberPropertyGroup("Adres 1", "Adres van het lid zelf, of van de eerste ouder", [
            new ExcelMemberProperty({
                name: "Straat",
                getValue: (member: MemberSummary) => this.firstAddress(member)?.street ?? "",
                width: 30,
            }),
            new ExcelMemberProperty({
                name: "Huisnummer",
                getValue: (member: MemberSummary) => this.firstAddress(member)?.number ?? "",
                width: 10,
            }),
            new ExcelMemberProperty({
                name: "Postcode",
                getValue: (member: MemberSummary) => this.firstAddress(member)?.postalCode ?? "",
                width: 10,
            }),
            new ExcelMemberProperty({
                name: "Gemeente",
                getValue: (member: MemberSummary) => this.firstAddress(member)?.city ?? "",
                width: 20,
            }),
            new ExcelMemberProperty({
                name: "Land",
                getValue: (member: MemberSummary) => this.firstAddress(member)?.country ?? "",
                width: 10,
            }),
        ]),
        new ExcelMemberPropertyGroup("Ouders",  "In Stamhoofd kan je meer dan twee ouders toevoegen, waaronder ook stiefouders/plusouders.", [
            new ExcelMemberProperty({
                name: "Benaming ouder 1",
                description: "Mama, papa, pluspapa...",
                getValue: (member: MemberSummary) => member.parents[0] ? ParentTypeHelper.getName(member.parents[0].type) : "",
                width: 10
            }),
            new ExcelMemberProperty({
                name: "Naam ouder 1",
                getValue: (member: MemberSummary) => member.parents[0]?.name ?? "",
                width: 20
            }),
            new ExcelMemberProperty({
                name: "GSM-nummer ouder 1",
                getValue: (member: MemberSummary) => member.parents[0]?.phone ?? "",
                width: 20
            }),
            new ExcelMemberProperty({
                name: "E-mailadres ouder 1",
                getValue: (member: MemberSummary) => member.parents[0]?.email ?? "",
                width: 30
            }),

            new ExcelMemberProperty({
                name: "Benaming ouder 2",
                description: "Mama, papa, pluspapa...",
                getValue: (member: MemberSummary) => member.parents[1] ? ParentTypeHelper.getName(member.parents[1].type) : "",
                width: 10
            }),
            new ExcelMemberProperty({
                name: "Naam ouder 2",
                getValue: (member: MemberSummary) => member.parents[1]?.name ?? "",
                width: 20
            }),
            new ExcelMemberProperty({
                name: "GSM-nummer ouder 2",
                getValue: (member: MemberSummary) => member.parents[1]?.phone ?? "",
                width: 20
            }),
            new ExcelMemberProperty({
                name: "E-mailadres ouder 2",
                getValue: (member: MemberSummary) => member.parents[1]?.email ?? "",
                width: 30
            }),

            new ExcelMemberProperty({
                name: "Benaming ouder 3",
                description: "Mama, papa, pluspapa...",
                getValue: (member: MemberSummary) => member.parents[2] ? ParentTypeHelper.getName(member.parents[2].type) : "",
                width: 10
            }),
            new ExcelMemberProperty({
                name: "Naam ouder 3",
                getValue: (member: MemberSummary) => member.parents[2]?.name ?? "",
                width: 20
            }),
            new ExcelMemberProperty({
                name: "GSM-nummer ouder 3",
                getValue: (member: MemberSummary) => member.parents[2]?.phone ?? "",
                width: 20
            }),
            new ExcelMemberProperty({
                name: "E-mailadres ouder 3",
                getValue: (member: MemberSummary) => member.parents[2]?.email ?? "",
                width: 30
            }),
        ]),
        new ExcelMemberPropertyGroup("Adres 2",  "Adres van een tweede ouder indien verschillend of eerste ouder indien lid op ander adres woont", [
            new ExcelMemberProperty({
                name: "Straat 2",
                getValue: (member: MemberSummary) => this.secondAddress(member)?.street ?? "",
                width: 30,
            }),
            new ExcelMemberProperty({
                name: "Huisnummer 2",
                getValue: (member: MemberSummary) => this.secondAddress(member)?.number ?? "",
                width: 10,
            }),
            new ExcelMemberProperty({
                name: "Postcode 2",
                getValue: (member: MemberSummary) => this.secondAddress(member)?.postalCode ?? "",
                width: 10,
            }),
            new ExcelMemberProperty({
                name: "Gemeente 2",
                getValue: (member: MemberSummary) => this.secondAddress(member)?.city ?? "",
                width: 20,
            }),
            new ExcelMemberProperty({
                name: "Land 2",
                getValue: (member: MemberSummary) => this.secondAddress(member)?.country ?? "",
                width: 10,
            }),
        ]),
        new ExcelMemberPropertyGroup("Adres 3",  "Zelden het geval, maar als er een derde (stief)ouder is met een ander adres. Of het adres van de tweede ouder als de ouders en het lid op een ander adres wonen.", [
            new ExcelMemberProperty({
                name: "Straat 3",
                getValue: (member: MemberSummary) => this.thirdAddress(member)?.street ?? "",
                width: 30,
            }),
            new ExcelMemberProperty({
                name: "Huisnummer 3",
                getValue: (member: MemberSummary) => this.thirdAddress(member)?.number ?? "",
                width: 10,
            }),
            new ExcelMemberProperty({
                name: "Postcode 3",
                getValue: (member: MemberSummary) => this.thirdAddress(member)?.postalCode ?? "",
                width: 10,
            }),
            new ExcelMemberProperty({
                name: "Gemeente 3",
                getValue: (member: MemberSummary) => this.thirdAddress(member)?.city ?? "",
                width: 20,
            }),
            new ExcelMemberProperty({
                name: "Land 3",
                getValue: (member: MemberSummary) => this.thirdAddress(member)?.country ?? "",
                width: 10,
            }),
        ])
    ];

    nthAddress(member: MemberSummary, n: number): Address | null {
        const s = new Set<string>()
        const list = [member.address, member.parents[0]?.address, member.parents[1]?.address, member.parents[2]?.address, member.parents[3]?.address]
        for (const address of list) {
            if (address !== null && address !== undefined && !s.has(address.toString())) {
                s.add(address.toString())
                if (n === 0) {
                    return address
                }
                n--
            }
        }
        return null
    }

    firstAddress(member: MemberSummary): Address | null {
        return this.nthAddress(member, 0)
    }

    secondAddress(member: MemberSummary): Address | null {
        return this.nthAddress(member, 1)
    }

    thirdAddress(member: MemberSummary): Address | null {
        return this.nthAddress(member, 2)
    }

    async exportExcel() {
        if (this.loading) {
            return;
        }
        this.loading = true;
        this.errorBox = null;

        try {
            await this.export(this.propertyGroups.flatMap(g => g.properties.filter(p => p.selected)), this.members)
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

    async export(columns: ExcelMemberProperty[], members: MemberSummary[]) {
        const wsName = "Leden";
        const wb = XLSX.utils.book_new();

        /* make worksheet */
        const wsData: any[][] = [
            columns.map(c => c.name),
        ];

        for (const member of members) {
            wsData.push(columns.map(c => c.getValue(member)))
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

        const fileName = Formatter.fileSlug("Leden")

        if (AppManager.shared.downloadFile) {
            const data = XLSX.write(wb, { type: 'base64' });
            await AppManager.shared.downloadFile(data, fileName+".xlsx")
        } else {
            XLSX.writeFile(wb, fileName+".xlsx");
        }
    }

}
</script>